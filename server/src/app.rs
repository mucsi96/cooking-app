use crate::{
    controllers,
    middleware::{
        self as app_middleware,
        auth::{self, Auth},
    },
    models::settings::{self, Catalog},
    services::{ai::Ai, worker},
    settings::{self as configuration, Settings},
};
use async_trait::async_trait;
use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    middleware,
};
use loco_rs::{
    Result,
    app::{AppContext, Hooks},
    bgworker::Queue,
    boot::{self, BootResult, StartMode},
    config::Config,
    controller::AppRoutes,
    environment::Environment,
    task::Tasks,
};
use migration::Migrator;
use sea_orm::DatabaseConnection;
use std::{path::Path, time::Duration};
use tokio_util::sync::CancellationToken;

pub struct App;
#[async_trait]
impl Hooks for App {
    fn app_name() -> &'static str {
        env!("CARGO_PKG_NAME")
    }
    fn app_version() -> String {
        env!("CARGO_PKG_VERSION").into()
    }
    async fn load_config(environment: &Environment) -> Result<Config> {
        let mut config = environment.load()?;
        configuration::configure(&mut config)
            .await
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        Ok(config)
    }
    async fn boot(
        mode: StartMode,
        environment: &Environment,
        config: Config,
    ) -> Result<BootResult> {
        boot::create_app::<Self, Migrator>(mode, environment, config).await
    }
    fn routes(_ctx: &AppContext) -> AppRoutes {
        AppRoutes::empty().add_route(controllers::routes())
    }
    async fn before_routes(_ctx: &AppContext) -> Result<Router<AppContext>> {
        Ok(Router::new().fallback(|| async {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"message":"Az oldal nem található."})),
            )
        }))
    }
    async fn after_routes(router: Router, ctx: &AppContext) -> Result<Router> {
        let settings: Settings = ctx.config.settings()?;
        let catalog = Catalog::new(&settings);
        settings::initialize(&ctx.db, &settings)
            .await
            .map_err(loco_rs::Error::wrap)?;
        let auth = tokio::time::timeout(Duration::from_secs(90), async {
            loop {
                match Auth::new(settings.issuer.clone(), settings.audience.clone()).await {
                    Ok(auth) => return auth,
                    Err(error) => tracing::warn!(%error,"waiting for OIDC discovery"),
                }
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        })
        .await
        .map_err(loco_rs::Error::wrap)?;
        let ai = Ai::new(settings.clone(), catalog.clone(), ctx.db.clone())
            .map_err(|e| loco_rs::Error::Any(e.into()))?;
        Ok(router
            .layer(DefaultBodyLimit::max(1024 * 1024))
            .layer(Extension(ai))
            .layer(Extension(catalog))
            .layer(Extension(settings.clone()))
            .layer(middleware::from_fn_with_state(auth, auth::authorize))
            .layer(middleware::from_fn_with_state(
                settings.browser_origin,
                app_middleware::origin,
            )))
    }
    async fn serve(
        router: Router,
        ctx: &AppContext,
        params: &loco_rs::boot::ServeParams,
    ) -> Result<()> {
        let settings: Settings = ctx.config.settings()?;
        let ffmpeg = tokio::process::Command::new("ffmpeg")
            .arg("-version")
            .output()
            .await?;
        if !ffmpeg.status.success() {
            return Err(loco_rs::Error::Message("ffmpeg is required".into()));
        }
        tokio::fs::create_dir_all(Path::new(&settings.storage_directory).join("images")).await?;
        let api =
            tokio::net::TcpListener::bind(format!("{}:{}", params.binding, params.port)).await?;
        let management =
            tokio::net::TcpListener::bind(("0.0.0.0", settings.management_port)).await?;
        let health = Router::new()
            .route(
                "/health/liveness",
                axum::routing::get(|| async { Json(serde_json::json!({"status":"UP"})) }),
            )
            .route("/health/readiness", axum::routing::get(readiness))
            .with_state(ctx.db.clone());
        let stop = CancellationToken::new();
        let worker = tokio::spawn(worker::run(
            ctx.db.clone(),
            Ai::new(settings.clone(), Catalog::new(&settings), ctx.db.clone())
                .map_err(|e| loco_rs::Error::Any(e.into()))?,
            settings.storage_directory,
            stop.clone(),
        ));
        let api_stop = stop.clone();
        let health_stop = stop.clone();
        let mut servers = tokio::task::JoinSet::new();
        servers.spawn(async move {
            axum::serve(api, router)
                .with_graceful_shutdown(api_stop.cancelled_owned())
                .await
        });
        servers.spawn(async move {
            axum::serve(management, health)
                .with_graceful_shutdown(health_stop.cancelled_owned())
                .await
        });
        tracing::info!(port = params.port, "server ready");
        let result = tokio::select! {
            _ = shutdown() => Ok(()),
            result = servers.join_next() => match result { Some(Ok(result)) => result.map_err(loco_rs::Error::from), Some(Err(error)) => Err(loco_rs::Error::wrap(error)), None => Ok(()) },
        };
        stop.cancel();
        let _ = tokio::time::timeout(Duration::from_secs(20), async {
            while servers.join_next().await.is_some() {}
            let _ = worker.await;
        })
        .await;
        result
    }
    async fn connect_workers(_ctx: &AppContext, _queue: &Queue) -> Result<()> {
        Ok(())
    }
    fn register_tasks(_tasks: &mut Tasks) {}
    async fn truncate(_ctx: &AppContext) -> Result<()> {
        Err(loco_rs::Error::Message(
            "destructive database operations are disabled".into(),
        ))
    }
    async fn seed(_ctx: &AppContext, _path: &Path) -> Result<()> {
        Ok(())
    }
}
async fn readiness(State(db): State<DatabaseConnection>) -> (StatusCode, Json<serde_json::Value>) {
    if matches!(
        tokio::time::timeout(Duration::from_secs(2), db.ping()).await,
        Ok(Ok(()))
    ) {
        (StatusCode::OK, Json(serde_json::json!({"status":"UP"})))
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"status":"DOWN"})),
        )
    }
}
async fn shutdown() {
    let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("install SIGTERM handler");
    tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
}
