package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func browserOrigin(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodPost && c.Request.URL.Path == "/api/integrations/recipes/import" {
			c.Next()
			return
		}
		safe := c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions
		if safe && !strings.EqualFold(c.GetHeader("Upgrade"), "websocket") {
			c.Next()
			return
		}
		origins := c.Request.Header.Values("Origin")
		if len(origins) != 1 || origins[0] != origin {
			fail(c, http.StatusForbidden, "Érvénytelen kérésforrás.")
			return
		}
		c.Next()
	}
}
