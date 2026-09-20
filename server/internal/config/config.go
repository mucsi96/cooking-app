package config

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/azsecrets"
)

type Environment struct {
	TenantID            string `json:"tenantId"`
	ClientID            string `json:"clientId"`
	APIClientID         string `json:"apiClientId"`
	MockOAuth2ServerURI string `json:"mockOAuth2ServerUri"`
	ClientLogURL        string `json:"clientLogUrl"`
	ClientAppName       string `json:"clientAppName"`
}

type Config struct {
	Environment      Environment
	Port             string
	ManagementPort   string
	DatabaseURL      string
	DatabaseUser     string
	DatabasePassword string
	Issuer           string
	StorageDirectory string
	AnthropicKey     string
	AnthropicURL     string
	AnthropicModel   string
	OpenAIKey        string
	OpenAIURL        string
	OpenAIModel      string
}

// Load resolves secrets before constructing dependencies. Environment variables
// explicitly override Key Vault values, so the same binary runs in every environment.
func Load(ctx context.Context) (Config, error) {
	values := map[string]string{}
	if endpoint := os.Getenv("AZURE_KEYVAULT_ENDPOINT"); endpoint != "" {
		credential, err := azidentity.NewDefaultAzureCredential(nil)
		if err != nil {
			return Config{}, err
		}
		client, err := azsecrets.NewClient(endpoint, credential, nil)
		if err != nil {
			return Config{}, err
		}
		for _, name := range []string{"db-url", "db-username", "db-password", "tenant-id", "api-client-id", "spa-client-id", "claude-api-key", "openai-api-key", "client-log-url"} {
			env := strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
			if name == "claude-api-key" {
				env = "ANTHROPIC_API_KEY"
			}
			if _, overridden := os.LookupEnv(env); overridden {
				continue
			}
			secret, err := client.GetSecret(ctx, name, "", nil)
			if err != nil {
				return Config{}, fmt.Errorf("load secret %s: %w", name, err)
			}
			if secret.Value == nil {
				return Config{}, fmt.Errorf("secret %s is empty", name)
			}
			values[name] = *secret.Value
		}
	}
	get := func(env, secret, defaultValue string) string {
		if value, ok := os.LookupEnv(env); ok {
			return value
		}
		if value, ok := values[secret]; ok {
			return value
		}
		return defaultValue
	}
	c := Config{
		Environment: Environment{
			TenantID: get("TENANT_ID", "tenant-id", ""), ClientID: get("SPA_CLIENT_ID", "spa-client-id", ""),
			APIClientID: get("API_CLIENT_ID", "api-client-id", ""), MockOAuth2ServerURI: os.Getenv("MOCK_OAUTH2_SERVER_URI"),
			ClientLogURL: get("CLIENT_LOG_URL", "client-log-url", ""), ClientAppName: get("CLIENT_APP_NAME", "", "cooking-client"),
		},
		Port: get("SERVER_PORT", "", "8063"), ManagementPort: get("MANAGEMENT_PORT", "", "8162"),
		DatabaseURL:  strings.TrimPrefix(get("DB_URL", "db-url", ""), "jdbc:"),
		DatabaseUser: get("DB_USERNAME", "db-username", ""), DatabasePassword: get("DB_PASSWORD", "db-password", ""),
		StorageDirectory: get("STORAGE_DIRECTORY", "", "./storage"),
		AnthropicKey:     get("ANTHROPIC_API_KEY", "claude-api-key", ""), AnthropicURL: get("ANTHROPIC_BASE_URL", "", "https://api.anthropic.com"),
		AnthropicModel: get("ANTHROPIC_MODEL", "", "claude-sonnet-4-6"),
		OpenAIKey:      get("OPENAI_API_KEY", "openai-api-key", ""), OpenAIURL: get("OPENAI_BASE_URL", "", "https://api.openai.com"),
		OpenAIModel: get("OPENAI_IMAGE_MODEL", "", "gpt-image-2.5-sunburst"),
	}
	c.Issuer = get("OIDC_ISSUER", "", "https://login.microsoftonline.com/"+c.Environment.TenantID+"/v2.0")
	for name, value := range map[string]string{"DB_URL": c.DatabaseURL, "API_CLIENT_ID": c.Environment.APIClientID, "ANTHROPIC_API_KEY": c.AnthropicKey, "OPENAI_API_KEY": c.OpenAIKey} {
		if strings.TrimSpace(value) == "" {
			return Config{}, fmt.Errorf("%s is required", name)
		}
	}
	if c.Environment.TenantID == "" && os.Getenv("OIDC_ISSUER") == "" {
		return Config{}, fmt.Errorf("TENANT_ID or OIDC_ISSUER is required")
	}
	return c, nil
}
