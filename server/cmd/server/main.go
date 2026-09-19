package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/mucsi96/cooking-app/server/internal/ai"
	"github.com/mucsi96/cooking-app/server/internal/config"
	"github.com/mucsi96/cooking-app/server/internal/database"
	"github.com/mucsi96/cooking-app/server/internal/httpapi"
	"github.com/mucsi96/cooking-app/server/internal/media"
	"github.com/mucsi96/cooking-app/server/internal/recipe"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Println("cooking-server go")
		return
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := run(ctx); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	startup, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	c, err := config.Load(startup)
	if err != nil {
		return err
	}
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(c.StorageDirectory, "images"), 0750); err != nil {
		return err
	}
	pool, err := database.Open(startup, c)
	if err != nil {
		return err
	}
	defer pool.Close()
	var authorize httpapi.Authorizer
	for {
		authorize, err = httpapi.NewAuthorizer(ctx, c.Issuer, c.Environment.APIClientID)
		if err == nil {
			break
		}
		select {
		case <-startup.Done():
			return fmt.Errorf("OIDC startup: %w", err)
		case <-time.After(time.Second):
		}
	}
	store := &recipe.Store{DB: pool}
	client := ai.New(c)
	storage := media.Storage{Directory: c.StorageDirectory}
	api := httpapi.API{Store: store, AI: client, Storage: storage}
	server := &http.Server{
		Addr:              ":" + c.Port,
		Handler:           httpapi.Router(api, c.Environment, authorize),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      3 * time.Minute,
		IdleTimeout:       60 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return ctx },
	}
	management := &http.Server{
		Addr:              ":" + c.ManagementPort,
		Handler:           httpapi.Health(pool.Ping),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      5 * time.Second,
	}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return err
	}
	defer listener.Close()
	managementListener, err := net.Listen("tcp", management.Addr)
	if err != nil {
		return err
	}
	defer managementListener.Close()
	workerCtx, stopWorker := context.WithCancel(ctx)
	defer stopWorker()
	workerDone := make(chan struct{})
	go func() {
		defer close(workerDone)
		(&recipe.Worker{Store: store, Generator: client, Storage: storage}).Run(workerCtx)
	}()
	errorsCh := make(chan error, 2)
	go func() { errorsCh <- server.Serve(listener) }()
	go func() { errorsCh <- management.Serve(managementListener) }()
	slog.Info("server ready", "port", c.Port, "managementPort", c.ManagementPort)
	select {
	case <-ctx.Done():
	case err = <-errorsCh:
	}
	shutdown, cancelShutdown := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelShutdown()
	stopWorker()
	serverErr := server.Shutdown(shutdown)
	if serverErr != nil {
		server.Close()
	}
	managementErr := management.Shutdown(shutdown)
	if managementErr != nil {
		management.Close()
	}
	<-workerDone
	if errors.Is(err, http.ErrServerClosed) {
		err = nil
	}
	return errors.Join(err, serverErr, managementErr)
}
