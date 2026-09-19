package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-jose/go-jose/v4"
	"github.com/golang-jwt/jwt/v5"
)

func TestBearerAuthorization(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var issuer string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/.well-known/openid-configuration" {
			json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "jwks_uri": issuer + "/keys", "id_token_signing_alg_values_supported": []string{"RS256"}})
			return
		}
		json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "test", Algorithm: "RS256", Use: "sig"}}})
	}))
	defer provider.Close()
	issuer = provider.URL
	authorize, err := NewAuthorizer(context.Background(), issuer, "cooking-api")
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/recipes", authorize("readRecipes"), func(c *gin.Context) { c.Status(204) })
	for _, tc := range []struct {
		name   string
		change func(jwt.MapClaims)
		status int
	}{
		{"valid", func(c jwt.MapClaims) {}, 204},
		{"wrong audience", func(c jwt.MapClaims) { c["aud"] = "other" }, 401},
		{"wrong issuer", func(c jwt.MapClaims) { c["iss"] = "https://other.example" }, 401},
		{"expired", func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Hour).Unix() }, 401},
		{"missing scope", func(c jwt.MapClaims) { delete(c, "scp") }, 403},
		{"missing role", func(c jwt.MapClaims) { c["roles"] = []string{"createRecipe"} }, 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := jwt.MapClaims{"iss": issuer, "aud": "cooking-api", "sub": "user", "exp": time.Now().Add(time.Hour).Unix(), "scp": "api-access", "roles": []string{"readRecipes"}}
			tc.change(claims)
			token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
			token.Header["kid"] = "test"
			signed, err := token.SignedString(key)
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest("GET", "/recipes", nil)
			req.Header.Set("Authorization", "Bearer "+signed)
			response := httptest.NewRecorder()
			r.ServeHTTP(response, req)
			if response.Code != tc.status {
				t.Fatalf("got %d want %d: %s", response.Code, tc.status, response.Body)
			}
		})
	}
	for _, header := range []string{"", "Bearer broken", "Basic abc"} {
		req := httptest.NewRequest("GET", "/recipes", nil)
		req.Header.Set("Authorization", header)
		response := httptest.NewRecorder()
		r.ServeHTTP(response, req)
		if response.Code != 401 {
			t.Fatalf("accepted %q", header)
		}
	}
}
