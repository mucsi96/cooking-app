package httpapi

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
)

type Authorizer func(string) gin.HandlerFunc

func NewAuthorizer(ctx context.Context, issuer, audience string) (Authorizer, error) {
	// The remote key set outlives startup and refreshes signing keys as they rotate.
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, &http.Client{Timeout: 10 * time.Second}), issuer)
	if err != nil {
		return nil, err
	}
	verifier := provider.Verifier(&oidc.Config{ClientID: audience, SupportedSigningAlgs: []string{"RS256"}})
	return func(role string) gin.HandlerFunc {
		return func(c *gin.Context) {
			parts := strings.Fields(c.GetHeader("Authorization"))
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				c.Header("WWW-Authenticate", "Bearer")
				fail(c, 401, "Bejelentkezés szükséges.")
				return
			}
			token, err := verifier.Verify(c.Request.Context(), parts[1])
			if err != nil {
				c.Header("WWW-Authenticate", `Bearer error="invalid_token"`)
				fail(c, 401, "A bejelentkezés lejárt vagy érvénytelen.")
				return
			}
			var claims struct {
				Roles      []string `json:"roles"`
				Scope      string   `json:"scp"`
				OAuthScope string   `json:"scope"`
			}
			if err := token.Claims(&claims); err != nil {
				fail(c, 401, "Érvénytelen bejelentkezés.")
				return
			}
			scope := claims.Scope
			if scope == "" {
				scope = claims.OAuthScope
			}
			if !slices.Contains(strings.Fields(scope), "api-access") || !slices.Contains(claims.Roles, role) {
				fail(c, 403, "Nincs jogosultságod ehhez a művelethez.")
				return
			}
			c.Next()
		}
	}, nil
}
