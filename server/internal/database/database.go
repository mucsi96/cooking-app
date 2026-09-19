package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/mucsi96/cooking-app/server/internal/config"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

//go:embed migrations/*.sql
var migrations embed.FS

func Open(ctx context.Context, c config.Config) (*pgxpool.Pool, error) {
	databaseURL, err := url.Parse(c.DatabaseURL)
	if err != nil {
		return nil, err
	}
	// The previous JDBC URL may contain this driver-specific parameter. Every
	// application query is schema-qualified; migration bookkeeping uses public.
	query := databaseURL.Query()
	query.Del("currentSchema")
	databaseURL.RawQuery = query.Encode()
	pc, err := pgxpool.ParseConfig(databaseURL.String())
	if err != nil {
		return nil, err
	}
	if c.DatabaseUser != "" {
		pc.ConnConfig.User = c.DatabaseUser
	}
	if c.DatabasePassword != "" {
		pc.ConnConfig.Password = c.DatabasePassword
	}
	pc.MaxConns = 10
	pc.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		return nil, err
	}
	// Pod containers start concurrently; wait within the caller's startup deadline.
	for {
		if err = pool.Ping(ctx); err == nil {
			break
		}
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, fmt.Errorf("database startup: %w", ctx.Err())
		case <-time.After(time.Second):
		}
	}
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()
	migrationFS, err := fs.Sub(migrations, "migrations")
	if err != nil {
		pool.Close()
		return nil, err
	}
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		pool.Close()
		return nil, err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrationFS, goose.WithSessionLocker(locker))
	if err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := provider.Up(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}
