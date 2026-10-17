package config

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/azsecrets"
)

type Environment struct {
	ClientLogURL  string `json:"clientLogUrl"`
	ClientAppName string `json:"clientAppName"`
}

type Config struct {
	Environment          Environment
	APIClientID          string
	BrowserOrigin        string
	AuthSessionURL       string
	AuthSignInURL        string
	Port                 string
	ManagementPort       string
	DatabaseURL          string
	DatabaseUser         string
	DatabasePassword     string
	Issuer               string
	StorageDirectory     string
	AnthropicKey         string
	AnthropicURL         string
	AnthropicModel       string
	OpenAIKey            string
	OpenAIURL            string
	OpenAIModel          string
	OpenAIAllowLocalHTTP bool
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
		for _, name := range []string{"db-url", "db-username", "db-password", "tenant-id", "api-client-id", "claude-api-key", "openai-api-key", "client-log-url"} {
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
	allowLocalHTTP, err := strconv.ParseBool(get("OPENAI_ALLOW_LOCAL_HTTP", "", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("OPENAI_ALLOW_LOCAL_HTTP: %w", err)
	}
	c := Config{
		Environment: Environment{
			ClientLogURL: get("CLIENT_LOG_URL", "client-log-url", ""), ClientAppName: get("CLIENT_APP_NAME", "", "cooking-client"),
		},
		APIClientID:    get("API_CLIENT_ID", "api-client-id", ""),
		BrowserOrigin:  os.Getenv("BROWSER_ORIGIN"),
		AuthSessionURL: os.Getenv("AUTH_SESSION_URL"),
		AuthSignInURL:  os.Getenv("AUTH_SIGN_IN_URL"),
		Port:           get("SERVER_PORT", "", "8063"), ManagementPort: get("MANAGEMENT_PORT", "", "8162"),
		DatabaseURL:  strings.TrimPrefix(get("DB_URL", "db-url", ""), "jdbc:"),
		DatabaseUser: get("DB_USERNAME", "db-username", ""), DatabasePassword: get("DB_PASSWORD", "db-password", ""),
		StorageDirectory: get("STORAGE_DIRECTORY", "", "./storage"),
		AnthropicKey:     get("ANTHROPIC_API_KEY", "claude-api-key", ""), AnthropicURL: get("ANTHROPIC_BASE_URL", "", "https://api.anthropic.com"),
		AnthropicModel: get("ANTHROPIC_MODEL", "", "claude-sonnet-4-6"),
		OpenAIKey:      get("OPENAI_API_KEY", "openai-api-key", ""), OpenAIURL: get("OPENAI_BASE_URL", "", "https://api.openai.com"),
		OpenAIModel:          get("OPENAI_IMAGE_MODEL", "", "gpt-image-2.5-sunburst"),
		OpenAIAllowLocalHTTP: allowLocalHTTP,
	}
	tenantID := get("TENANT_ID", "tenant-id", "")
	c.Issuer = get("OIDC_ISSUER", "", "https://login.microsoftonline.com/"+tenantID+"/v2.0")
	for name, value := range map[string]string{"DB_URL": c.DatabaseURL, "API_CLIENT_ID": c.APIClientID, "BROWSER_ORIGIN": c.BrowserOrigin, "ANTHROPIC_API_KEY": c.AnthropicKey, "OPENAI_API_KEY": c.OpenAIKey} {
		if strings.TrimSpace(value) == "" {
			return Config{}, fmt.Errorf("%s is required", name)
		}
	}
	if tenantID == "" && os.Getenv("OIDC_ISSUER") == "" {
		return Config{}, fmt.Errorf("TENANT_ID or OIDC_ISSUER is required")
	}
	for name, value := range map[string]string{"AUTH_SESSION_URL": c.AuthSessionURL, "AUTH_SIGN_IN_URL": c.AuthSignInURL} {
		endpoint, err := url.Parse(value)
		if err != nil || (endpoint.Scheme != "https" && endpoint.Scheme != "http") || endpoint.Host == "" || endpoint.User != nil || endpoint.Fragment != "" {
			return Config{}, fmt.Errorf("%s must be an absolute HTTP(S) URL", name)
		}
	}
	origin, err := url.Parse(c.BrowserOrigin)
	if err != nil || (origin.Scheme != "https" && origin.Scheme != "http") || origin.Host == "" || origin.User != nil || origin.Path != "" || origin.RawQuery != "" || origin.Fragment != "" {
		return Config{}, fmt.Errorf("BROWSER_ORIGIN must be an exact HTTP(S) origin without a path")
	}
	return c, nil
}
