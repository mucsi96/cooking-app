use super::{ai::Ai, media};
use crate::models::{execute, statement};
use sea_orm::{DatabaseConnection, FromQueryResult, TransactionTrait};
use std::time::Duration;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(FromQueryResult)]
struct Job {
    id: Uuid,
    title: String,
    description: String,
    model_id: Option<String>,
    source_photo: Option<Vec<u8>>,
}

pub async fn run(db: DatabaseConnection, ai: Ai, directory: String, stop: CancellationToken) {
    let mut workers = tokio::task::JoinSet::new();
    for _ in 0..3 {
        let (db, ai, directory, stop) = (db.clone(), ai.clone(), directory.clone(), stop.clone());
        workers.spawn(async move {
            loop {
                let result = tokio::select! { biased; _ = stop.cancelled() => break, result = process(&db,&ai,&directory) => result };
                match result { Ok(true) => continue, Ok(false) => {}, Err(error) => tracing::error!(%error,"image worker failed") }
                tokio::select! { _ = stop.cancelled() => break, _ = tokio::time::sleep(Duration::from_secs(1)) => {} }
            }
        });
    }
    while let Some(result) = workers.join_next().await {
        if let Err(error) = result {
            tracing::error!(%error,"image worker task failed");
        }
    }
}

async fn process(db: &DatabaseConnection, ai: &Ai, directory: &str) -> anyhow::Result<bool> {
    // Holding the lease transaction makes cancellation/crashes return the job to PENDING.
    let tx = db.begin().await?;
    let job = Job::find_by_statement(statement("SELECT j.id,r.title,r.description,j.model_id,j.source_photo FROM cooking.image_generation_jobs j JOIN cooking.recipes r ON r.id=j.recipe_id WHERE j.status='PENDING' ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED",vec![])).one(&tx).await?;
    let Some(job) = job else {
        tx.rollback().await?;
        return Ok(false);
    };
    let result = tokio::time::timeout(Duration::from_secs(300), async {
        let bytes = ai
            .generate(
                &job.title,
                &job.description,
                job.model_id.as_deref(),
                job.source_photo.as_deref(),
            )
            .await?;
        media::save(directory, job.id, &bytes).await
    })
    .await;
    let (status, error) = match result {
        Ok(Ok(())) => ("COMPLETED", None),
        failure => {
            tracing::error!(job=%job.id,error=?failure,"image generation failed");
            ("FAILED", Some("A kép elkészítése nem sikerült."))
        }
    };
    execute(
        &tx,
        "UPDATE cooking.image_generation_jobs SET status=$2,error=$3,source_photo=NULL WHERE id=$1",
        vec![job.id.into(), status.into(), error.into()],
    )
    .await?;
    tx.commit().await?;
    Ok(true)
}
