pub mod ai;
pub mod media;
pub mod page;
pub mod worker;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("recipe not found")]
    NotFound,
    #[error("{0}")]
    Invalid(&'static str),
    #[error("database operation failed")]
    Database(#[from] sea_orm::DbErr),
    #[error("invalid structured data")]
    Json(#[from] serde_json::Error),
    #[error("service failed")]
    Internal(#[from] anyhow::Error),
}
