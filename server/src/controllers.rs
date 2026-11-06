use crate::{
    models::{
        recipes,
        settings::{self, Catalog, Selection},
    },
    services::{Error, ai::Ai, media, page},
    settings::Settings,
};
use axum::{
    Extension, Json,
    extract::{DefaultBodyLimit, Multipart, Path, State, rejection::JsonRejection},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use loco_rs::{app::AppContext, controller::Routes};
use serde::Deserialize;
use uuid::Uuid;

pub struct ApiError(StatusCode, &'static str);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({"message":self.1}))).into_response()
    }
}
impl From<Error> for ApiError {
    fn from(error: Error) -> Self {
        match error {
            Error::NotFound => Self(StatusCode::NOT_FOUND, "A recept nem található."),
            Error::Invalid(message) => Self(StatusCode::BAD_REQUEST, message),
            error => {
                tracing::error!(%error,"API request failed");
                Self(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "A művelet nem sikerült. Próbáld újra.",
                )
            }
        }
    }
}
type Result<T> = std::result::Result<T, ApiError>;
fn json<T>(body: std::result::Result<Json<T>, JsonRejection>) -> Result<T> {
    body.map(|Json(v)| v)
        .map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Érvénytelen kérés."))
}
fn id(value: &str) -> Result<Uuid> {
    Uuid::parse_str(value).map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Érvénytelen azonosító."))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api")
        .add("/models", axum::routing::get(catalog))
        .add(
            "/settings/models",
            axum::routing::get(get_settings).put(put_settings),
        )
        .add("/recipes", axum::routing::get(list))
        .add("/recipes/import", axum::routing::post(import_text))
        .add(
            "/recipes/import/image",
            axum::routing::post(import_photo)
                .layer(DefaultBodyLimit::max(media::MAX_PHOTO_BYTES + 1024 * 1024)),
        )
        .add("/recipes/{id}", axum::routing::get(get).put(update))
        .add(
            "/recipes/{id}/images",
            axum::routing::get(candidates)
                .post(generate)
                .layer(DefaultBodyLimit::max(media::MAX_PHOTO_BYTES + 1024 * 1024)),
        )
        .add("/recipes/{id}/image", axum::routing::put(select))
        .add("/images/{id}", axum::routing::get(image))
}
async fn catalog(Extension(catalog): Extension<Catalog>) -> Json<Catalog> {
    Json(catalog)
}
async fn get_settings(State(ctx): State<AppContext>) -> Result<Json<Selection>> {
    Ok(Json(settings::get(&ctx.db).await?))
}
async fn put_settings(
    State(ctx): State<AppContext>,
    Extension(catalog): Extension<Catalog>,
    body: std::result::Result<Json<Selection>, JsonRejection>,
) -> Result<StatusCode> {
    settings::put(&ctx.db, &catalog, json(body)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn list(State(ctx): State<AppContext>) -> Result<Json<Vec<recipes::ListItem>>> {
    Ok(Json(recipes::list(&ctx.db).await?))
}
async fn get(
    State(ctx): State<AppContext>,
    Path(value): Path<String>,
) -> Result<Json<recipes::Recipe>> {
    Ok(Json(recipes::get(&ctx.db, id(&value)?).await?))
}
async fn update(
    State(ctx): State<AppContext>,
    Path(value): Path<String>,
    body: std::result::Result<Json<recipes::Content>, JsonRejection>,
) -> Result<StatusCode> {
    recipes::update(&ctx.db, id(&value)?, json(body)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn candidates(
    State(ctx): State<AppContext>,
    Path(value): Path<String>,
) -> Result<Json<Vec<recipes::Candidate>>> {
    Ok(Json(recipes::candidates(&ctx.db, id(&value)?).await?))
}
async fn generate(
    State(ctx): State<AppContext>,
    Path(value): Path<String>,
    photo: Multipart,
) -> Result<Json<Vec<recipes::Candidate>>> {
    let id = id(&value)?;
    Ok(Json(
        recipes::generate(&ctx.db, id, read_photo(photo).await?).await?,
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ImageSelection {
    image_id: String,
}
async fn select(
    State(ctx): State<AppContext>,
    Path(value): Path<String>,
    body: std::result::Result<Json<ImageSelection>, JsonRejection>,
) -> Result<StatusCode> {
    recipes::select(&ctx.db, id(&value)?, id(&json(body)?.image_id)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn image(
    Extension(settings): Extension<Settings>,
    Path(value): Path<String>,
) -> Result<Response> {
    let file = media::image_path(&settings.storage_directory, id(&value)?);
    let data = tokio::fs::read(file).await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            ApiError(StatusCode::NOT_FOUND, "A kép nem található.")
        } else {
            Error::Internal(e.into()).into()
        }
    })?;
    Ok((
        [
            ("Content-Type", "image/webp"),
            ("Cache-Control", "private, max-age=31536000, immutable"),
        ],
        data,
    )
        .into_response())
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TextImport {
    text: String,
}
async fn import_text(
    State(ctx): State<AppContext>,
    Extension(ai): Extension<Ai>,
    body: std::result::Result<Json<TextImport>, JsonRejection>,
) -> Result<Json<recipes::Recipe>> {
    let text = json(body)?.text;
    if text.trim().is_empty() || text.chars().count() > page::MAX_SOURCE_CHARACTERS {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "A recept szövege üres vagy túl hosszú.",
        ));
    }
    let text = page::resolve(&text).await.map_err(|_| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "A weboldal nem olvasható. Ellenőrizd a hivatkozást, vagy másold be a recept szövegét.",
        )
    })?;
    extract(&ctx, &ai, &text, None).await
}
async fn import_photo(
    State(ctx): State<AppContext>,
    Extension(ai): Extension<Ai>,
    photo: Multipart,
) -> Result<Json<recipes::Recipe>> {
    let photo = read_photo(photo).await?;
    extract(
        &ctx,
        &ai,
        "Extract the single recipe visible in this photo. Ignore unrelated surrounding text.",
        Some(&photo),
    )
    .await
}
async fn extract(
    ctx: &AppContext,
    ai: &Ai,
    text: &str,
    photo: Option<&[u8]>,
) -> Result<Json<recipes::Recipe>> {
    let content = ai.extract(text, photo).await.map_err(|error| {
        tracing::error!(%error,"recipe extraction failed");
        ApiError(
            StatusCode::BAD_GATEWAY,
            "A recept felismerése nem sikerült. Próbáld újra.",
        )
    })?;
    Ok(Json(recipes::create(&ctx.db, content).await?))
}
async fn read_photo(mut multipart: Multipart) -> Result<Vec<u8>> {
    while let Some(field) = multipart.next_field().await.map_err(multipart_error)? {
        if field.name() != Some("image") {
            continue;
        }
        let bytes = field.bytes().await.map_err(multipart_error)?;
        if bytes.len() > media::MAX_PHOTO_BYTES {
            return Err(ApiError(
                StatusCode::PAYLOAD_TOO_LARGE,
                "A fénykép legfeljebb 15 MB lehet.",
            ));
        }
        if bytes.is_empty() {
            return Err(ApiError(StatusCode::BAD_REQUEST, "A fénykép üres."));
        }
        return media::convert(&bytes, "jpg").await.map_err(|_| {
            ApiError(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "A fénykép formátuma nem támogatott vagy sérült.",
            )
        });
    }
    Err(ApiError(StatusCode::BAD_REQUEST, "Válassz egy fényképet."))
}
fn multipart_error(error: axum::extract::multipart::MultipartError) -> ApiError {
    if error.status() == StatusCode::PAYLOAD_TOO_LARGE {
        ApiError(
            StatusCode::PAYLOAD_TOO_LARGE,
            "A fénykép legfeljebb 15 MB lehet.",
        )
    } else {
        ApiError(StatusCode::BAD_REQUEST, "Érvénytelen fényképfeltöltés.")
    }
}
