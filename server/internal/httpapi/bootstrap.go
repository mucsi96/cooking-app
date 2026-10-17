package httpapi

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mucsi96/cooking-app/server/internal/config"
)

func environmentBootstrap(environment config.Environment, sessionURL, signInURL string) gin.HandlerFunc {
	client := &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	return func(c *gin.Context) {
		target := bootstrapReturnTarget(c.Query("returnTo"))
		login, _ := url.Parse(signInURL) // Validated at startup.
		request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, sessionURL, nil)
		if err != nil {
			fail(c, http.StatusServiceUnavailable, "Az oldal átmenetileg nem tölthető be.")
			return
		}
		request.Header.Set("Cookie", c.GetHeader("Cookie"))
		request.Header.Set("Accept", "application/json")
		request.Header.Set("X-Forwarded-Host", login.Host)
		request.Header.Set("X-Forwarded-Proto", login.Scheme)
		request.Header.Set("X-Forwarded-Uri", target)
		response, err := client.Do(request)
		if err != nil {
			fail(c, http.StatusServiceUnavailable, "Az oldal átmenetileg nem tölthető be.")
			return
		}
		defer response.Body.Close()
		for _, cookie := range response.Header.Values("Set-Cookie") {
			c.Writer.Header().Add("Set-Cookie", cookie)
		}
		switch {
		case response.StatusCode >= 200 && response.StatusCode < 300:
			c.JSON(http.StatusOK, environment)
		case response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden:
			query := login.Query()
			query.Set("rd", target)
			login.RawQuery = query.Encode()
			c.JSON(http.StatusOK, gin.H{"redirectTo": login.String()})
		default:
			fail(c, http.StatusServiceUnavailable, "Az oldal átmenetileg nem tölthető be.")
		}
	}
}

func bootstrapReturnTarget(value string) string {
	target, err := url.Parse(value)
	if err != nil || target.IsAbs() || target.Host != "" || !strings.HasPrefix(target.Path, "/") || strings.HasPrefix(target.Path, "//") || strings.Contains(target.Path, "\\") {
		return "/"
	}
	return target.String()
}
