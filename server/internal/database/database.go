package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/mucsi96/cooking-app/server/internal/config"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open owns a single database/sql pool shared by GORM and Goose. The caller
// closes the pool obtained through DB() when the application shuts down.
func Open(ctx context.Context, c config.Config) (_ *gorm.DB, err error) {
	databaseURL, err := url.Parse(c.DatabaseURL)
	if err != nil {
		return nil, err
	}
	// The previous JDBC URL may contain this driver-specific parameter. Every
	// application query is schema-qualified; migration bookkeeping uses public.
	query := databaseURL.Query()
	query.Del("currentSchema")
	databaseURL.RawQuery = query.Encode()
	pc, err := pgx.ParseConfig(databaseURL.String())
	if err != nil {
		return nil, err
	}
	if c.DatabaseUser != "" {
		pc.User = c.DatabaseUser
	}
	if c.DatabasePassword != "" {
		pc.Password = c.DatabasePassword
	}
	pc.ConnectTimeout = 5 * time.Second
	pool := stdlib.OpenDB(*pc)
	pool.SetMaxOpenConns(10)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxIdleTime(5 * time.Minute)
	pool.SetConnMaxLifetime(30 * time.Minute)
	defer func() {
		if err != nil {
			pool.Close()
		}
	}()
	// Pod containers start concurrently; wait within the caller's startup deadline.
	for {
		if err = pool.PingContext(ctx); err == nil {
			break
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("database startup: %w", ctx.Err())
		case <-time.After(time.Second):
		}
	}
	migrationFS, err := fs.Sub(migrations, "migrations")
	if err != nil {
		return nil, err
	}
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return nil, err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, pool, migrationFS, goose.WithSessionLocker(locker))
	if err != nil {
		return nil, err
	}
	if _, err := provider.Up(ctx); err != nil {
		return nil, err
	}
	// Goose is the sole schema authority: do not call AutoMigrate here.
	return gorm.Open(postgres.New(postgres.Config{Conn: pool}), &gorm.Config{
		DisableAutomaticPing: true, // The bounded startup loop already checked it.
		Logger: logger.New(slog.NewLogLogger(slog.Default().Handler(), slog.LevelWarn), logger.Config{
			LogLevel:                  logger.Warn,
			SlowThreshold:             time.Second,
			IgnoreRecordNotFoundError: true,
			ParameterizedQueries:      true,
			Colorful:                  false,
		}),
	})
}
