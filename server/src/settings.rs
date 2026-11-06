use anyhow::{Context, ensure};
use azure_identity::{AzureCliCredential, WorkloadIdentityCredential};
use azure_security_keyvault_secrets::SecretClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub issuer: String,
    pub audience: String,
    pub browser_origin: String,
    pub management_port: u16,
    pub storage_directory: String,
    pub anthropic_key: String,
    pub anthropic_url: String,
    pub anthropic_model: String,
    pub openai_key: String,
    pub openai_url: String,
    pub openai_model: String,
}

pub async fn configure(config: &mut loco_rs::config::Config) -> anyhow::Result<()> {
    let mut secrets = HashMap::new();
    if let Ok(endpoint) = std::env::var("AZURE_KEYVAULT_ENDPOINT") {
        let client = if std::env::var_os("AZURE_FEDERATED_TOKEN_FILE").is_some() {
            SecretClient::new(&endpoint, WorkloadIdentityCredential::new(None)?, None)?
        } else {
            SecretClient::new(&endpoint, AzureCliCredential::new(None)?, None)?
        };
        for (name, env) in [
            ("db-url", "DB_URL"),
            ("db-username", "DB_USERNAME"),
            ("db-password", "DB_PASSWORD"),
            ("tenant-id", "TENANT_ID"),
            ("api-client-id", "API_CLIENT_ID"),
            ("claude-api-key", "ANTHROPIC_API_KEY"),
            ("openai-api-key", "OPENAI_API_KEY"),
        ] {
            if std::env::var_os(env).is_none() {
                let value = client
                    .get_secret(name, None)
                    .await?
                    .into_model()?
                    .value
                    .with_context(|| format!("empty Key Vault secret {name}"))?;
                secrets.insert(env, value);
            }
        }
    }
    let get = |name: &str, default: &str| {
        std::env::var(name)
            .unwrap_or_else(|_| secrets.get(name).cloned().unwrap_or_else(|| default.into()))
    };
    let database = get("DB_URL", "");
    let mut uri = url::Url::parse(database.strip_prefix("jdbc:").unwrap_or(&database))
        .context("DB_URL must be a PostgreSQL URL")?;
    ensure!(
        matches!(uri.scheme(), "postgres" | "postgresql"),
        "DB_URL must be PostgreSQL"
    );
    let pairs: Vec<_> = uri
        .query_pairs()
        .filter(|(k, _)| k != "currentSchema")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    uri.set_query(None);
    uri.query_pairs_mut().extend_pairs(pairs);
    for (name, password) in [("DB_USERNAME", false), ("DB_PASSWORD", true)] {
        let value = get(name, "");
        if !value.is_empty() {
            let value = value.replace('%', "%25");
            if password {
                uri.set_password(Some(&value))
            } else {
                uri.set_username(&value)
            }
            .map_err(|_| anyhow::anyhow!("invalid database credentials"))?;
        }
    }
    config.database.uri = uri.into();
    config.server.port = get("SERVER_PORT", "8063").parse()?;
    let tenant = get("TENANT_ID", "");
    let settings = Settings {
        issuer: get(
            "OIDC_ISSUER",
            &format!("https://login.microsoftonline.com/{tenant}/v2.0"),
        ),
        audience: get("API_CLIENT_ID", ""),
        browser_origin: get("BROWSER_ORIGIN", ""),
        management_port: get("MANAGEMENT_PORT", "8162").parse()?,
        storage_directory: get("STORAGE_DIRECTORY", "./storage"),
        anthropic_key: get("ANTHROPIC_API_KEY", ""),
        anthropic_url: get("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
        anthropic_model: get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        openai_key: get("OPENAI_API_KEY", ""),
        openai_url: get("OPENAI_BASE_URL", "https://api.openai.com"),
        openai_model: get("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst"),
    };
    ensure!(
        !tenant.is_empty() || std::env::var_os("OIDC_ISSUER").is_some(),
        "TENANT_ID or OIDC_ISSUER is required"
    );
    ensure!(
        [
            &settings.audience,
            &settings.anthropic_key,
            &settings.openai_key,
            &settings.anthropic_model,
            &settings.openai_model
        ]
        .iter()
        .all(|s| !s.trim().is_empty()),
        "API audience, AI keys and models are required"
    );
    let origin = url::Url::parse(&settings.browser_origin)?;
    ensure!(
        matches!(origin.scheme(), "http" | "https")
            && origin.origin().ascii_serialization() == settings.browser_origin,
        "BROWSER_ORIGIN must be an exact HTTP(S) origin"
    );
    crate::middleware::auth::validate_endpoint(&settings.issuer)?;
    crate::middleware::auth::validate_endpoint(&settings.anthropic_url)?;
    crate::middleware::auth::validate_endpoint(&settings.openai_url)?;
    let allow_http: bool = get("OPENAI_ALLOW_LOCAL_HTTP", "false").parse()?;
    ensure!(
        settings.openai_url.starts_with("https://") || allow_http,
        "OpenAI HTTP requires OPENAI_ALLOW_LOCAL_HTTP=true"
    );
    config.settings = Some(serde_json::to_value(settings)?);
    Ok(())
}
