package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mucsi96/cooking-app/server/internal/config"
	"github.com/mucsi96/cooking-app/server/internal/media"
	"github.com/mucsi96/cooking-app/server/internal/recipe"
)

type Extractor interface {
	Extract(context.Context, string, []byte) (recipe.Content, error)
}
type API struct {
	Store   *recipe.Store
	AI      Extractor
	Storage media.Storage
}

func fail(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{"message": message})
}

func respond(c *gin.Context, value any, err error) {
	if err == nil {
		c.JSON(http.StatusOK, value)
		return
	}
	switch {
	case errors.Is(err, recipe.ErrNotFound):
		fail(c, 404, "A recept nem található.")
	case errors.Is(err, recipe.ErrInvalidImage):
		fail(c, 400, "A kép nem választható ehhez a recepthez.")
	default:
		slog.Error("API request failed", "method", c.Request.Method, "path", c.FullPath(), "error", err)
		fail(c, 500, "A művelet nem sikerült. Próbáld újra.")
	}
}

func decode(c *gin.Context, value any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024*1024)
	d := json.NewDecoder(c.Request.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(value); err != nil {
		fail(c, 400, "Érvénytelen kérés.")
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		fail(c, 400, "Érvénytelen kérés.")
		return false
	}
	return true
}

func validID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		fail(c, 400, "Érvénytelen azonosító.")
		return
	}
	// Canonical IDs also make storage paths independent of the URL spelling.
	c.Params = gin.Params{{Key: "id", Value: id.String()}}
	c.Next()
}

func Router(a API, environment config.Environment, authorize Authorizer) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.SetTrustedProxies(nil)
	r.Use(gin.CustomRecovery(func(c *gin.Context, _ any) { fail(c, 500, "Váratlan hiba történt.") }), func(c *gin.Context) {
		start := time.Now()
		c.Header("Cache-Control", "no-store")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Next()
		slog.Info("request", "method", c.Request.Method, "route", c.FullPath(), "status", c.Writer.Status(), "duration", time.Since(start))
	})
	r.NoRoute(func(c *gin.Context) { fail(c, 404, "Az oldal nem található.") })
	r.GET("/api/environment", func(c *gin.Context) { c.JSON(200, environment) })
	r.GET("/api/recipes", authorize("readRecipes"), func(c *gin.Context) { v, e := a.Store.List(c.Request.Context()); respond(c, v, e) })
	r.POST("/api/recipes/import", authorize("createRecipe"), a.importText)
	r.POST("/api/recipes/import/image", authorize("createRecipe"), a.importPhoto)
	r.GET("/api/recipes/:id", authorize("readRecipes"), validID, func(c *gin.Context) { v, e := a.Store.Get(c.Request.Context(), c.Param("id")); respond(c, v, e) })
	r.GET("/api/recipes/:id/images", authorize("readRecipes"), validID, func(c *gin.Context) { v, e := a.Store.Candidates(c.Request.Context(), c.Param("id")); respond(c, v, e) })
	r.POST("/api/recipes/:id/images", authorize("createRecipe"), validID, func(c *gin.Context) { v, e := a.Store.Generate(c.Request.Context(), c.Param("id")); respond(c, v, e) })
	r.PUT("/api/recipes/:id/image", authorize("createRecipe"), validID, func(c *gin.Context) {
		var body struct {
			ImageID string `json:"imageId"`
		}
		if !decode(c, &body) {
			return
		}
		id, err := uuid.Parse(body.ImageID)
		if err != nil {
			fail(c, 400, "Érvénytelen képazonosító.")
			return
		}
		if err := a.Store.SelectImage(c.Request.Context(), c.Param("id"), id.String()); err != nil {
			respond(c, nil, err)
			return
		}
		c.Status(http.StatusNoContent)
	})
	r.GET("/api/images/:id", authorize("readRecipes"), validID, func(c *gin.Context) {
		file, err := os.Open(a.Storage.ImagePath(c.Param("id")))
		if errors.Is(err, os.ErrNotExist) {
			fail(c, 404, "A kép nem található.")
			return
		}
		if err != nil {
			respond(c, nil, err)
			return
		}
		defer file.Close()
		stat, err := file.Stat()
		if err != nil {
			respond(c, nil, err)
			return
		}
		c.Header("Content-Type", "image/webp")
		c.Header("Cache-Control", "private, max-age=31536000, immutable")
		http.ServeContent(c.Writer, c.Request, stat.Name(), stat.ModTime(), file)
	})
	return r
}

func (a API) importText(c *gin.Context) {
	var body struct {
		Text string `json:"text"`
	}
	if !decode(c, &body) {
		return
	}
	if strings.TrimSpace(body.Text) == "" || utf8.RuneCountInString(body.Text) > recipe.MaxSourceCharacters {
		fail(c, 400, "A recept szövege üres vagy túl hosszú.")
		return
	}
	text, err := recipe.ResolvePage(c.Request.Context(), body.Text)
	if err != nil {
		fail(c, 400, "A weboldal nem olvasható. Ellenőrizd a hivatkozást, vagy másold be a recept szövegét.")
		return
	}
	a.extract(c, text, nil)
}

func (a API) importPhoto(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, media.MaxPhotoBytes+1024*1024)
	if err := c.Request.ParseMultipartForm(1024 * 1024); err != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			fail(c, 413, "A fénykép legfeljebb 15 MB lehet.")
		} else {
			fail(c, 400, "Érvénytelen fényképfeltöltés.")
		}
		return
	}
	defer c.Request.MultipartForm.RemoveAll()
	file, header, err := c.Request.FormFile("image")
	if err != nil {
		fail(c, 400, "Válassz egy fényképet a receptről.")
		return
	}
	defer file.Close()
	if header.Size > media.MaxPhotoBytes {
		fail(c, 413, "A fénykép legfeljebb 15 MB lehet.")
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, media.MaxPhotoBytes+1))
	if err != nil {
		fail(c, 400, "A fénykép nem olvasható.")
		return
	}
	if len(data) == 0 {
		fail(c, 400, "A fénykép üres.")
		return
	}
	photo, err := media.NormalizePhoto(c.Request.Context(), data)
	if err != nil {
		fail(c, 415, "A fénykép formátuma nem támogatott vagy sérült.")
		return
	}
	a.extract(c, "Extract the single recipe visible in this photo. Ignore unrelated surrounding text.", photo)
}

func (a API) extract(c *gin.Context, text string, photo []byte) {
	content, err := a.AI.Extract(c.Request.Context(), text, photo)
	if err != nil {
		slog.Error("recipe extraction failed", "error", err)
		fail(c, 502, "A recept felismerése nem sikerült. Próbáld újra.")
		return
	}
	result, err := a.Store.Create(c.Request.Context(), content)
	respond(c, result, err)
}

func Health(ping func(context.Context) error) http.Handler {
	r := http.NewServeMux()
	r.HandleFunc("GET /actuator/health/liveness", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"status":"UP"}`)
	})
	r.HandleFunc("GET /actuator/health/readiness", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json")
		if err := ping(ctx); err != nil {
			w.WriteHeader(503)
			io.WriteString(w, `{"status":"DOWN"}`)
			return
		}
		io.WriteString(w, `{"status":"UP"}`)
	})
	return r
}
