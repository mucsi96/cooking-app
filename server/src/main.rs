use cooking_server::app::App;
use migration::Migrator;

#[tokio::main]
async fn main() -> loco_rs::Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("install TLS provider");
    if std::env::args().any(|arg| arg == "--version") {
        println!("cooking-server {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if std::env::args().any(|arg| arg == "--healthcheck") {
        let port = std::env::var("MANAGEMENT_PORT").unwrap_or_else(|_| "8162".into());
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(loco_rs::Error::wrap)?
            .get(format!("http://127.0.0.1:{port}/health/readiness"))
            .send()
            .await
            .map_err(loco_rs::Error::wrap)?
            .error_for_status()
            .map_err(loco_rs::Error::wrap)?;
        return Ok(());
    }
    loco_rs::cli::main::<App, Migrator>().await
}
