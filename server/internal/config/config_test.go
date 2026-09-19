package config

import (
	"context"
	"testing"
)

func TestRuntimeConfiguration(t *testing.T) {
	for name, value := range map[string]string{
		"AZURE_KEYVAULT_ENDPOINT": "", "TENANT_ID": "", "OIDC_ISSUER": "http://localhost:8060/default",
		"DB_URL":        "jdbc:postgresql://localhost/cooking?currentSchema=cooking",
		"API_CLIENT_ID": "test-api", "ANTHROPIC_API_KEY": "test", "OPENAI_API_KEY": "test",
		"SERVER_PORT": "9063", "MANAGEMENT_PORT": "9162",
	} {
		t.Setenv(name, value)
	}
	c, err := Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "9063" || c.ManagementPort != "9162" || c.DatabaseURL != "postgresql://localhost/cooking?currentSchema=cooking" || c.Environment.APIClientID != "test-api" {
		t.Fatalf("unexpected configuration: ports %s/%s", c.Port, c.ManagementPort)
	}
	t.Setenv("API_CLIENT_ID", "")
	if _, err := Load(context.Background()); err == nil {
		t.Fatal("accepted missing audience")
	}
}
