use sea_orm_migration::prelude::*;
use sea_orm_migration::{IntoSchemaManagerConnection, sea_orm::TransactionTrait};

mod m20261106_000001_cooking;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20261106_000001_cooking::Migration)]
    }

    async fn up<'c, C>(db: C, steps: Option<u32>) -> Result<(), DbErr>
    where
        C: IntoSchemaManagerConnection<'c>,
    {
        let connection = db.into_database_executor();
        let transaction = connection.begin().await?;
        transaction
            .execute_unprepared("SELECT pg_advisory_xact_lock(746319026)")
            .await?;
        // Lock before reading or creating migration metadata, including fresh installs.
        OrderedMigrations::up(&transaction, steps).await?;
        transaction.commit().await
    }
}

struct OrderedMigrations;
#[async_trait::async_trait]
impl MigratorTrait for OrderedMigrations {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        Migrator::migrations()
    }
}
