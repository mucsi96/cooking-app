pub mod recipes;
pub mod settings;

use sea_orm::{ConnectionTrait, DatabaseBackend, Statement, Value};

pub fn statement(sql: &str, values: Vec<Value>) -> Statement {
    Statement::from_sql_and_values(DatabaseBackend::Postgres, sql, values)
}

pub async fn execute(
    db: &impl ConnectionTrait,
    sql: &str,
    values: Vec<Value>,
) -> Result<u64, sea_orm::DbErr> {
    Ok(db
        .execute_raw(statement(sql, values))
        .await?
        .rows_affected())
}
