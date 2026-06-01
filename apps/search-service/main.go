// apps/search-service/main.go
// Search Service
//
// This service handles flight search operations and provides search capabilities
// to other services via internal APIs. It queries the Aviationstack API
// or returns mock data when no API key is configured.

package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/application/usecases"
	"flight-booking/pkg/domain/services"
	"flight-booking/pkg/infrastructure/adapters/aviationstack"
	"flight-booking/pkg/infrastructure/adapters/postgres"
	"flight-booking/pkg/infrastructure/adapters/redis"
	"flight-booking/pkg/shared/config"
	"flight-booking/pkg/shared/logger"
)

var (
	version = "1.0.0"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Create logger
	log := logger.New("search-service", cfg.Log.Format, cfg.Log.Level)
	log.Info("Starting Search Service", logger.Fields{
		"version": version,
		"env":     cfg.App.Env,
	})

	// Initialize context with cancel
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize PostgreSQL connection pool
	pgPool, err := postgres.NewPool(ctx, cfg.DB.DSNWithPool(), log)
	if err != nil {
		log.Warn("Failed to connect to PostgreSQL, running in degraded mode", logger.Fields{
			"error": err.Error(),
		})
		pgPool = nil
	} else {
		log.Info("Connected to PostgreSQL", logger.Fields{
			"host": cfg.DB.Host,
			"port": cfg.DB.Port,
		})
	}

	// Initialize Redis client
	redisClient, err := redis.NewClient(redis.Config{
		Host:     cfg.Redis.Host,
		Port:     cfg.Redis.Port,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	}, log)
	if err != nil {
		log.Warn("Failed to connect to Redis, running without cache", logger.Fields{
			"error": err.Error(),
		})
		redisClient = nil
	} else {
		log.Info("Connected to Redis", logger.Fields{
			"addr": cfg.Redis.Addr(),
		})
	}

	// Initialize Aviationstack client
	avClient := aviationstack.NewClient(aviationstack.Config{
		APIKey:        cfg.Aviation.APIKey,
		BaseURL:       cfg.Aviation.BaseURL,
		Timeout:       time.Duration(cfg.Aviation.Timeout) * time.Second,
		RetryAttempts: cfg.Aviation.RetryAttempts,
	}, log)

	provider := "aviationstack"
	if cfg.Aviation.APIKey == "" {
		log.Info("No Aviationstack API key configured, running in MOCK mode", nil)
		provider = "mock"
	}

	// Initialize cache from Redis
	var cache ports.CachePort
	if redisClient != nil {
		cache = redisClient
	}

	// Initialize flight repository from PostgreSQL
	var flightRepo ports.FlightRepositoryPort
	if pgPool != nil {
		flightRepo = postgres.NewFlightRepository(pgPool)
		log.Info("Flight repository initialized", nil)
	}

	// Initialize fare calculation service
	fareSvc := services.NewFareCalculationService()

	// Initialize search use case
	searchUC := usecases.NewSearchFlightsUseCase(avClient, flightRepo, fareSvc, cache, log)
	_ = searchUC // Use case is available for internal service calls

	// Build HTTP router for health checks
	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /ready", handleReady(pgPool, redisClient, provider))

	// Note: In production, gRPC server would be initialized here for inter-service communication
	// Example:
	// grpcServer := grpc.NewServer()
	// searchpb.RegisterSearchServiceServer(grpcServer, &searchServer{...})
	// lis, _ := net.Listen("tcp", fmt.Sprintf(":%d", cfg.App.SearchPort))
	// go grpcServer.Serve(lis)

	// Create HTTP server
	addr := fmt.Sprintf(":%d", cfg.App.SearchPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Start HTTP server
	go func() {
		log.Info("HTTP server starting", logger.Fields{"addr": addr})
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("HTTP server failed", logger.Fields{"error": err.Error()})
			cancel()
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down search service...", nil)

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("Server forced to shutdown", logger.Fields{"error": err.Error()})
	}

	// Close connections
	if pgPool != nil {
		pgPool.Close()
	}
	if redisClient != nil {
		redisClient.Close()
	}

	log.Info("Search service exited", nil)
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// handleHealth returns the health status
func handleHealth(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":  "ok",
		"service": "search-service",
		"version": version,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","service":"search-service","version":"%s"}`, version)
}

// handleReady returns the readiness status
func handleReady(pgPool interface{ Ping(ctx context.Context) error }, redisClient interface{ Ping(ctx context.Context) error }, provider string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		response := map[string]interface{}{
			"status":   "ready",
			"service":  "search-service",
			"provider": provider,
		}

		// Check dependencies
		if pgPool != nil {
			if err := pgPool.Ping(ctx); err != nil {
				response["postgres"] = "unhealthy"
				response["status"] = "degraded"
			} else {
				response["postgres"] = "ok"
			}
		} else {
			response["postgres"] = "not configured"
		}

		if redisClient != nil {
			if err := redisClient.Ping(ctx); err != nil {
				response["redis"] = "unhealthy"
				response["status"] = "degraded"
			} else {
				response["redis"] = "ok"
			}
		} else {
			response["redis"] = "not configured"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ready","service":"search-service","provider":"`+provider+`"}`)
	}
}
