use super::{execute, statement};
use crate::services::Error;
use sea_orm::{ConnectionTrait, DatabaseConnection, FromQueryResult, TransactionTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize, FromQueryResult)]
#[serde(deny_unknown_fields)]
pub struct Ingredient {
    pub name: String,
    pub amount: Option<f64>,
    pub unit: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Content {
    pub title: String,
    pub description: String,
    pub category: String,
    pub servings: i32,
    pub ingredients: Vec<Ingredient>,
    pub steps: Vec<String>,
}

impl Content {
    pub fn validate(&self) -> Result<(), Error> {
        if self.title.trim().is_empty()
            || self.description.trim().is_empty()
            || self.servings < 1
            || self.ingredients.is_empty()
            || self.steps.is_empty()
            || ![
                "Reggeli",
                "Leves",
                "Főétel",
                "Köret",
                "Saláta",
                "Desszert",
                "Sütemény",
                "Ital",
                "Egyéb",
            ]
            .contains(&self.category.as_str())
            || self.ingredients.iter().any(|i| {
                i.name.trim().is_empty()
                    || i.amount
                        .is_some_and(|a| !a.is_finite() || !(0.0..=99_999_999.99).contains(&a))
            })
            || self.steps.iter().any(|s| s.trim().is_empty())
        {
            return Err(Error::Invalid(
                "Érvénytelen recept. Töltsd ki a recept adatait, a hozzávalókat és az elkészítés lépéseit.",
            ));
        }
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: Uuid,
    #[serde(flatten)]
    pub content: Content,
    pub image_id: Option<Uuid>,
}

#[derive(Serialize, FromQueryResult)]
#[serde(rename_all = "camelCase")]
pub struct ListItem {
    pub id: Uuid,
    pub title: String,
    pub category: String,
    pub image_id: Option<Uuid>,
}

#[derive(Serialize, FromQueryResult)]
pub struct Candidate {
    pub id: Uuid,
    pub status: String,
    pub error: Option<String>,
}

#[derive(FromQueryResult)]
struct Record {
    id: Uuid,
    title: String,
    description: String,
    category: String,
    servings: i32,
    image_id: Option<Uuid>,
}

pub async fn list(db: &DatabaseConnection) -> Result<Vec<ListItem>, Error> {
    Ok(ListItem::find_by_statement(statement(
        "SELECT id, title, category, image_id FROM cooking.recipes ORDER BY created_at, id",
        vec![],
    ))
    .all(db)
    .await?)
}

pub async fn get(db: &impl ConnectionTrait, id: Uuid) -> Result<Recipe, Error> {
    let r = Record::find_by_statement(statement("SELECT id, title, description, category, servings, image_id FROM cooking.recipes WHERE id=$1", vec![id.into()])).one(db).await?.ok_or(Error::NotFound)?;
    let ingredients = Ingredient::find_by_statement(statement("SELECT name, amount::float8 AS amount, unit FROM cooking.recipe_ingredients WHERE recipe_id=$1 ORDER BY position", vec![id.into()])).all(db).await?;
    let steps = db
        .query_all_raw(statement(
            "SELECT step FROM cooking.recipe_steps WHERE recipe_id=$1 ORDER BY position",
            vec![id.into()],
        ))
        .await?
        .iter()
        .map(|row| row.try_get("", "step"))
        .collect::<Result<Vec<String>, _>>()?;
    Ok(Recipe {
        id: r.id,
        image_id: r.image_id,
        content: Content {
            title: r.title,
            description: r.description,
            category: r.category,
            servings: r.servings,
            ingredients,
            steps,
        },
    })
}

async fn children(db: &impl ConnectionTrait, id: Uuid, content: &Content) -> Result<(), Error> {
    for (position, ingredient) in content.ingredients.iter().enumerate() {
        execute(db, "INSERT INTO cooking.recipe_ingredients(recipe_id, position, name, amount, unit) VALUES($1,$2,$3,$4,$5)", vec![id.into(), (position as i32).into(), ingredient.name.clone().into(), ingredient.amount.into(), ingredient.unit.clone().into()]).await?;
    }
    for (position, step) in content.steps.iter().enumerate() {
        execute(
            db,
            "INSERT INTO cooking.recipe_steps(recipe_id, position, step) VALUES($1,$2,$3)",
            vec![id.into(), (position as i32).into(), step.clone().into()],
        )
        .await?;
    }
    Ok(())
}

pub async fn create(db: &DatabaseConnection, content: Content) -> Result<Recipe, Error> {
    content.validate()?;
    let tx = db.begin().await?;
    let id = Uuid::new_v4();
    execute(&tx, "INSERT INTO cooking.recipes(id,title,description,category,servings,created_at) VALUES($1,$2,$3,$4,$5,now())", vec![id.into(), content.title.clone().into(), content.description.clone().into(), content.category.clone().into(), content.servings.into()]).await?;
    children(&tx, id, &content).await?;
    tx.commit().await?;
    Ok(Recipe {
        id,
        content,
        image_id: None,
    })
}

pub async fn update(db: &DatabaseConnection, id: Uuid, content: Content) -> Result<(), Error> {
    content.validate()?;
    let tx = db.begin().await?;
    let count = execute(
        &tx,
        "UPDATE cooking.recipes SET title=$2,description=$3,category=$4,servings=$5 WHERE id=$1",
        vec![
            id.into(),
            content.title.clone().into(),
            content.description.clone().into(),
            content.category.clone().into(),
            content.servings.into(),
        ],
    )
    .await?;
    if count != 1 {
        return Err(Error::NotFound);
    }
    execute(
        &tx,
        "DELETE FROM cooking.recipe_ingredients WHERE recipe_id=$1",
        vec![id.into()],
    )
    .await?;
    execute(
        &tx,
        "DELETE FROM cooking.recipe_steps WHERE recipe_id=$1",
        vec![id.into()],
    )
    .await?;
    children(&tx, id, &content).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn require(db: &impl ConnectionTrait, id: Uuid) -> Result<(), Error> {
    if db
        .query_one_raw(statement(
            "SELECT id FROM cooking.recipes WHERE id=$1 FOR KEY SHARE",
            vec![id.into()],
        ))
        .await?
        .is_none()
    {
        return Err(Error::NotFound);
    }
    Ok(())
}

pub async fn candidates(db: &DatabaseConnection, id: Uuid) -> Result<Vec<Candidate>, Error> {
    require(db, id).await?;
    Ok(Candidate::find_by_statement(statement("SELECT id,status,error FROM cooking.image_generation_jobs WHERE recipe_id=$1 ORDER BY created_at,id", vec![id.into()])).all(db).await?)
}

pub async fn generate(
    db: &DatabaseConnection,
    id: Uuid,
    photo: Vec<u8>,
) -> Result<Vec<Candidate>, Error> {
    let tx = db.begin().await?;
    require(&tx, id).await?;
    let settings = super::settings::get(&tx).await?;
    let mut result = Vec::new();
    for image in settings.images {
        for _ in 0..image.count {
            let job = Uuid::new_v4();
            execute(&tx, "INSERT INTO cooking.image_generation_jobs(id,recipe_id,status,model_id,source_photo,created_at) VALUES($1,$2,'PENDING',$3,$4,now())", vec![job.into(), id.into(), image.id.clone().into(), photo.clone().into()]).await?;
            result.push(Candidate {
                id: job,
                status: "PENDING".into(),
                error: None,
            });
        }
    }
    if result.is_empty() {
        return Err(Error::Invalid(
            "A képmodellek ki vannak kapcsolva. Engedélyezz legalább egy képet a Beállításokban.",
        ));
    }
    tx.commit().await?;
    Ok(result)
}

pub async fn select(db: &DatabaseConnection, id: Uuid, image: Uuid) -> Result<(), Error> {
    require(db, id).await?;
    if execute(db, "UPDATE cooking.recipes SET image_id=$2 WHERE id=$1 AND EXISTS(SELECT 1 FROM cooking.image_generation_jobs WHERE id=$2 AND recipe_id=$1 AND status='COMPLETED')", vec![id.into(), image.into()]).await? != 1 {
        return Err(Error::Invalid("A kép nem választható ehhez a recepthez."));
    }
    Ok(())
}
