use crate::{services::Error, settings::Settings};
use sea_orm::{ActiveValue::Set, entity::prelude::*, sea_query::OnConflict};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "model_settings", schema_name = "cooking")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: i32,
    pub value: Json,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ImageSetting {
    pub id: String,
    pub count: i32,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub extraction: String,
    pub scene: String,
    pub images: Vec<ImageSetting>,
}
#[derive(Clone, Serialize)]
pub struct DataModel {
    pub id: String,
    pub provider: String,
}
#[derive(Clone, Serialize)]
pub struct ImageModel {
    pub id: String,
    pub name: String,
    pub model: String,
    pub quality: String,
}
#[derive(Clone, Serialize)]
pub struct Catalog {
    pub data: Vec<DataModel>,
    pub images: Vec<ImageModel>,
}

impl Catalog {
    pub fn new(settings: &Settings) -> Self {
        let mut data: Vec<_> = [
            "gpt-6-astra",
            "gpt-6-sol",
            "gpt-5.5",
            "gpt-5.6-sol",
            "gpt-5.6-terra",
            "gpt-5.6-luna",
        ]
        .into_iter()
        .map(|id| DataModel {
            id: id.into(),
            provider: "openai".into(),
        })
        .collect();
        data.extend(
            [
                "claude-sonnet-4-5",
                "claude-sonnet-5",
                "claude-haiku-4-5",
                "claude-opus-4-8",
                "claude-opus-5-5",
            ]
            .into_iter()
            .map(|id| DataModel {
                id: id.into(),
                provider: "anthropic".into(),
            }),
        );
        if !data.iter().any(|m| m.id == settings.anthropic_model) {
            data.push(DataModel {
                id: settings.anthropic_model.clone(),
                provider: "anthropic".into(),
            });
        }
        let image = |model: &str, quality: &str| ImageModel {
            id: format!("{model}-{quality}"),
            name: format!("{model} ({quality})"),
            model: model.into(),
            quality: quality.into(),
        };
        let mut images: Vec<_> = [
            "gpt-image-2",
            "gpt-image-2.5-sunburst",
            "gpt-image-2.5-flare",
        ]
        .into_iter()
        .flat_map(|model| {
            ["low", "medium", "high", "xhigh", "max", "auto"]
                .into_iter()
                .filter(move |q| model != "gpt-image-2" || ["low", "medium", "high"].contains(q))
                .map(move |q| image(model, q))
        })
        .collect();
        if !images
            .iter()
            .any(|m| m.id == format!("{}-medium", settings.openai_model))
        {
            images.push(image(&settings.openai_model, "medium"));
        }
        Self { data, images }
    }

    pub fn validate(&self, value: &Selection) -> Result<(), Error> {
        let mut seen = std::collections::HashSet::new();
        if ![&value.extraction, &value.scene]
            .iter()
            .all(|id| self.data.iter().any(|m| &m.id == *id))
            || value.images.iter().any(|i| {
                !(0..=10).contains(&i.count)
                    || !seen.insert(&i.id)
                    || !self.images.iter().any(|m| m.id == i.id)
            })
            || value.images.iter().map(|i| i.count).sum::<i32>() > 30
        {
            return Err(Error::Invalid(
                "Érvénytelen modellbeállítás. Modellenként legfeljebb 10, összesen legfeljebb 30 kép kérhető.",
            ));
        }
        Ok(())
    }
}

pub async fn initialize(db: &DatabaseConnection, settings: &Settings) -> Result<(), Error> {
    let value = Selection {
        extraction: settings.anthropic_model.clone(),
        scene: settings.anthropic_model.clone(),
        images: vec![ImageSetting {
            id: format!("{}-medium", settings.openai_model),
            count: 3,
        }],
    };
    Entity::insert(ActiveModel {
        id: Set(1),
        value: Set(serde_json::to_value(value)?),
    })
    .on_conflict(OnConflict::column(Column::Id).do_nothing().to_owned())
    .try_insert()
    .exec(db)
    .await?;
    Ok(())
}
pub async fn get(db: &impl ConnectionTrait) -> Result<Selection, Error> {
    let row = Entity::find_by_id(1)
        .one(db)
        .await?
        .ok_or_else(|| Error::Internal(anyhow::anyhow!("model settings missing")))?;
    Ok(serde_json::from_value(row.value)?)
}
pub async fn put(
    db: &DatabaseConnection,
    catalog: &Catalog,
    value: Selection,
) -> Result<(), Error> {
    catalog.validate(&value)?;
    ActiveModel {
        id: Set(1),
        value: Set(serde_json::to_value(value)?),
    }
    .update(db)
    .await?;
    Ok(())
}
