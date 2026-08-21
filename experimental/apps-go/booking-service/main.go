// apps/booking-service/main.go
// Booking Service
//
// This service handles booking operations including creation, retrieval,
// and cancellation of flight bookings. It communicates with other services
// via RabbitMQ message queue.

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/application/usecases"
	"flight-booking/pkg/domain/services"
	"flight-booking/pkg/infrastructure/adapters/postgres"
	"flight-booking/pkg/infrastructure/adapters/rabbitmq"
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
	log := logger.New("booking-service", cfg.Log.Format, cfg.Log.Level)
	log.Info("Starting Booking Service", logger.Fields{
		"version": version,
		"env":     cfg.App.Env,
	})

	// Initialize context with cancel
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize PostgreSQL connection pool
	pgPool, err := postgres.NewPool(ctx, cfg.DB.DSNWithPool(), log)
	dbStatus := "ok"
	if err != nil {
		log.Warn("Failed to connect to PostgreSQL, running in degraded mode", logger.Fields{
			"error": err.Error(),
		})
		pgPool = nil
		dbStatus = "unavailable"
	} else {
		log.Info("Connected to PostgreSQL", logger.Fields{
			"host": cfg.DB.Host,
			"port": cfg.DB.Port,
		})
	}

	// Initialize RabbitMQ client
	rabbitClient, err := rabbitmq.NewClient(rabbitmq.Config{
		Host:     cfg.RabbitMQ.Host,
		Port:     cfg.RabbitMQ.Port,
		User:     cfg.RabbitMQ.User,
		Password: cfg.RabbitMQ.Password,
		VHost:    cfg.RabbitMQ.VHost,
		Exchange: cfg.RabbitMQ.Exchange,
	}, log)
	if err != nil {
		log.Warn("Failed to connect to RabbitMQ, running without messaging", logger.Fields{
			"error": err.Error(),
		})
		rabbitClient = nil
	} else {
		log.Info("Connected to RabbitMQ", logger.Fields{
			"host": cfg.RabbitMQ.Host,
			"port": cfg.RabbitMQ.Port,
		})
	}

	// Initialize booking repository from PostgreSQL
	var bookingRepo ports.BookingRepositoryPort
	if pgPool != nil {
		bookingRepo = postgres.NewBookingRepository(pgPool)
		log.Info("Booking repository initialized", nil)
	}

	// Initialize booking code generator
	bookingGen := services.NewBookingCodeGenerator()

	// Initialize use cases
	_ = usecases.NewCreateBookingUseCase(
		bookingRepo,
		nil, // flightRepo
		nil, // paymentPort
		nil, // notifPort
		bookingGen,
		nil, // validationSvc
		log,
	)

	_ = usecases.NewGetBookingUseCase(bookingRepo, log)

	// Note: In production, gRPC server would be initialized here for inter-service communication
	// Example:
	// grpcServer := grpc.NewServer()
	// bookingpb.RegisterBookingServiceServer(grpcServer, &bookingServer{...})
	// lis, _ := net.Listen("tcp", fmt.Sprintf(":%d", cfg.App.BookingPort))
	// go grpcServer.Serve(lis)

	// Build HTTP router for health checks
	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /ready", handleReady(dbStatus, rabbitClient != nil))

	// Create HTTP server
	addr := fmt.Sprintf(":%d", cfg.App.BookingPort)
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

	log.Info("Shutting down booking service...", nil)

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
	if rabbitClient != nil {
		rabbitClient.Stop()
	}

	log.Info("Booking service exited", nil)
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// handleHealth returns the health status
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","service":"booking-service","version":"%s"}`, version)
}

// handleReady returns the readiness status
func handleReady(dbStatus string, rabbitAvailable bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "ready"
		if dbStatus == "unavailable" {
			status = "degraded"
		}

		response := map[string]interface{}{
			"status":  status,
			"service": "booking-service",
			"database": dbStatus,
		}

		if rabbitAvailable {
			response["rabbitmq"] = "ok"
		} else {
			response["rabbitmq"] = "unavailable"
			status = "degraded"
		}

		response["status"] = status

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, fmt.Sprintf(`{"status":"%s","service":"booking-service","database":"%s"}`, status, dbStatus))
	}
}
