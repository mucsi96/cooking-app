pub mod auth;

use axum::{
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

pub async fn origin(State(origin): State<String>, request: Request, next: Next) -> Response {
    let safe = matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    ) && !request
        .headers()
        .get("upgrade")
        .is_some_and(|v| v.as_bytes().eq_ignore_ascii_case(b"websocket"));
    let origins: Vec<_> = request.headers().get_all("origin").iter().collect();
    if !safe && (origins.len() != 1 || origins[0].as_bytes() != origin.as_bytes()) {
        return (
            StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({"message":"Érvénytelen kérésforrás."})),
        )
            .into_response();
    }
    next.run(request).await
}
