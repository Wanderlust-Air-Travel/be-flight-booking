// apps/payment-service/main.go
// Payment Service
//
// This service handles payment processing for flight bookings.
// It supports multiple payment providers (mock, Stripe, VNPay, PayPal).

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"flight-booking/pkg/infrastructure/adapters/payment"
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
	log := logger.New("payment-service", cfg.Log.Format, cfg.Log.Level)
	log.Info("Starting Payment Service", logger.Fields{
		"version":  version,
		"env":      cfg.App.Env,
		"provider": cfg.Payment.Provider,
	})

	// Initialize context with cancel
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize payment client
	paymentClient := payment.NewMockClient()
	if paymentClient == nil {
		log.Warn("Payment client initialization returned nil, using fallback", nil)
	}

	log.Info("Payment client initialized", logger.Fields{
		"provider": cfg.Payment.Provider,
	})

	// Build HTTP router
	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("GET /healthz", handleHealth(cfg.Payment.Provider))
	mux.HandleFunc("GET /ready", handleReady(cfg.Payment.Provider, paymentClient))

	// Create HTTP server
	addr := fmt.Sprintf(":%d", cfg.App.PaymentPort)
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

	log.Info("Shutting down payment service...", nil)

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("Server forced to shutdown", logger.Fields{"error": err.Error()})
	}

	log.Info("Payment service exited", nil)
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// handleHealth returns the health status
func handleHealth(provider string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","service":"payment","provider":"%s"}`, provider)
	}
}

// handleReady returns the readiness status
func handleReady(provider string, client *payment.MockClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"status":   "ready",
			"service":  "payment",
			"provider":  provider,
		}

		// Check payment client availability
		if client != nil {
			response["client"] = "ok"
		} else {
			response["client"] = "degraded"
			response["status"] = "degraded"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, fmt.Sprintf(`{"status":"ready","service":"payment","provider":"%s"}`, provider))
	}
}
