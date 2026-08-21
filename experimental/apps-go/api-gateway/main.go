// apps/api-gateway/main.go
// API Gateway HTTP Server
//
// This is the main entry point for the API Gateway service.
// It handles HTTP requests for flight search, booking, and user authentication.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"

	"flight-booking/pkg/application/dto"
	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/application/usecases"
	"flight-booking/pkg/domain/entities"
	"flight-booking/pkg/domain/services"
	"flight-booking/pkg/infrastructure/adapters/aviationstack"
	"flight-booking/pkg/infrastructure/adapters/postgres"
	"flight-booking/pkg/infrastructure/adapters/redis"
	"flight-booking/pkg/infrastructure/adapters/rabbitmq"
	"flight-booking/pkg/shared/config"
	"flight-booking/pkg/shared/logger"
	"flight-booking/pkg/shared/middleware"
	apperrors "flight-booking/pkg/shared/errors"
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
	log := logger.New("api-gateway", cfg.Log.Format, cfg.Log.Level)
	log.Info("Starting API Gateway", logger.Fields{
		"version": version,
		"env":     cfg.App.Env,
	})

	// Initialize infrastructure with graceful context
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

	// Initialize Aviationstack client
	avClient := aviationstack.NewClient(aviationstack.Config{
		APIKey:        cfg.Aviation.APIKey,
		BaseURL:       cfg.Aviation.BaseURL,
		Timeout:       time.Duration(cfg.Aviation.Timeout) * time.Second,
		RetryAttempts: cfg.Aviation.RetryAttempts,
	}, log)

	if cfg.Aviation.APIKey == "" {
		log.Info("No Aviationstack API key configured, running in MOCK mode", nil)
	} else {
		log.Info("Aviationstack API configured", logger.Fields{
			"base_url": cfg.Aviation.BaseURL,
		})
	}

	// Initialize cache port from Redis
	var cachePort ports.CachePort
	if redisClient != nil {
		cachePort = redisClient
	}

	// Initialize repositories from PostgreSQL
	var flightRepo ports.FlightRepositoryPort
	var airportRepo ports.AirportRepositoryPort
	var bookingRepo ports.BookingRepositoryPort

	if pgPool != nil {
		flightRepo = postgres.NewFlightRepository(pgPool)
		airportRepo = postgres.NewAirportRepository(pgPool)
		bookingRepo = postgres.NewBookingRepository(pgPool)
		log.Info("Repositories initialized", nil)
	}

	// Initialize fare calculation service
	fareSvc := services.NewFareCalculationService()

	// Initialize booking code generator
	bookingGen := services.NewBookingCodeGenerator()

	// Initialize use cases
	var searchUC *usecases.SearchFlightsUseCase
	if avClient != nil {
		searchUC = usecases.NewSearchFlightsUseCase(avClient, flightRepo, fareSvc, cachePort, log)
	}

	createBookingUC := usecases.NewCreateBookingUseCase(
		bookingRepo,
		flightRepo,
		nil, // paymentPort - will be initialized in booking service
		nil, // notifPort
		bookingGen,
		nil, // validationSvc
		log,
	)

	getBookingUC := usecases.NewGetBookingUseCase(bookingRepo, log)

	// Build HTTP router
	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /ready", handleReady(pgPool, redisClient))

	// Flight endpoints
	mux.HandleFunc("GET /api/v1/flights/search", handleSearchFlights(searchUC, log))
	mux.HandleFunc("GET /api/v1/airports", handleListAirports(airportRepo, log))
	mux.HandleFunc("GET /api/v1/flights/{id}", handleGetFlight(flightRepo, log))

	// Booking endpoints
	mux.HandleFunc("POST /api/v1/bookings", handleCreateBooking(createBookingUC, log))
	mux.HandleFunc("GET /api/v1/bookings/{code}", handleGetBooking(getBookingUC, log))
	mux.HandleFunc("DELETE /api/v1/bookings/{code}", handleCancelBooking(getBookingUC, log))

	// Payment callback (mock)
	mux.HandleFunc("GET /payment/callback", handleMockPaymentCallback)

	// Auth endpoints
	mux.HandleFunc("POST /api/v1/auth/login", handleLogin(log))
	mux.HandleFunc("POST /api/v1/auth/register", handleRegister(log))

	// Apply middleware stack
	handler := mux
	handler = middleware.NewRecoverMiddleware(log).Handler(handler)
	handler = middleware.NewTracingMiddleware(log).Handler(handler)
	handler = middleware.NewCORSMiddleware(middleware.CORSConfig{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   cfg.CORS.AllowedMethods,
		AllowedHeaders:   cfg.CORS.AllowedHeaders,
		ExposeHeaders:   cfg.CORS.ExposeHeaders,
		MaxAge:          cfg.CORS.MaxAge,
		AllowCredentials: cfg.CORS.AllowCredentials,
	}).Handler(handler)
	handler = middleware.NewRateLimiterMiddleware(cfg.RateLimit.RequestsPerMinute, cfg.RateLimit.Burst).Handler(handler)
	handler = middleware.NewTimeoutMiddleware(30*time.Second).Handler(handler)

	// Create HTTP server
	addr := fmt.Sprintf(":%s", cfg.App.GatewayPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
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

	log.Info("Shutting down server...", nil)

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
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
	if rabbitClient != nil {
		rabbitClient.Stop()
	}

	log.Info("Server exited", nil)
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// handleHealth returns the health status of the service
func handleHealth(w http.ResponseWriter, r *http.Request) {
	response := dto.HealthResponse{
		Status:    "ok",
		Version:   version,
		Timestamp: time.Now(),
	}
	respondJSON(w, http.StatusOK, response)
}

// handleReady checks the readiness of dependencies
func handleReady(pgPool interface{ Ping(ctx context.Context) error }, redisClient interface{ Ping(ctx context.Context) error }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		status := make(map[string]string)

		// Check PostgreSQL
		if pgPool != nil {
			if err := pgPool.Ping(ctx); err != nil {
				status["postgres"] = "unhealthy"
			} else {
				status["postgres"] = "ok"
			}
		} else {
			status["postgres"] = "not configured"
		}

		// Check Redis
		if redisClient != nil {
			if err := redisClient.Ping(ctx); err != nil {
				status["redis"] = "unhealthy"
			} else {
				status["redis"] = "ok"
			}
		} else {
			status["redis"] = "not configured"
		}

		response := map[string]interface{}{
			"status":   "ready",
			"services": status,
		}

		// Check if any critical service is unhealthy
		for k, v := range status {
			if v == "unhealthy" {
				response["status"] = "degraded"
				break
			}
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleSearchFlights handles flight search requests
func handleSearchFlights(searchUC *usecases.SearchFlightsUseCase, log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Parse query parameters
		req := dto.SearchFlightsRequest{
			Origin:        r.URL.Query().Get("origin"),
			Destination:   r.URL.Query().Get("destination"),
			DepartureDate: r.URL.Query().Get("departure_date"),
			ReturnDate:    r.URL.Query().Get("return_date"),
			CabinClass:    r.URL.Query().Get("cabin_class"),
			DirectOnly:    r.URL.Query().Get("direct_only") == "true",
		}

		// Parse passengers
		if passengers := r.URL.Query().Get("passengers"); passengers != "" {
			fmt.Sscanf(passengers, "%d", &req.Passengers)
		} else {
			req.Passengers = 1
		}

		// Normalize input
		req.ToLowerCase()

		// Validate request
		if errors := req.Validate(); len(errors) > 0 {
			respondError(w, r, apperrors.ValidationFailed("validation failed").WithFields(flattenErrors(errors)))
			return
		}

		// Execute search
		input := usecases.SearchFlightsInput{
			Origin:        req.Origin,
			Destination:   req.Destination,
			DepartureDate: req.DepartureDate,
			ReturnDate:    req.ReturnDate,
			Passengers:    req.Passengers,
			CabinClass:    req.CabinClass,
			DirectOnly:    req.DirectOnly,
		}

		response, err := searchUC.Execute(ctx, input)
		if err != nil {
			log.Error("Flight search failed", logger.Fields{"error": err.Error()})
			respondError(w, r, toAppError(err))
			return
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleListAirports returns all available airports
func handleListAirports(airportRepo ports.AirportRepositoryPort, log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		var airports []entities.Airport
		var err error

		if airportRepo != nil {
			airports, err = airportRepo.FindAll(ctx)
			if err != nil {
				log.Warn("Failed to fetch airports from DB", logger.Fields{"error": err.Error()})
				// Return mock airports
				airports = getMockAirports()
			}
		} else {
			airports = getMockAirports()
		}

		// Convert to DTOs
		airportDTOs := make([]dto.AirportDTO, 0, len(airports))
		for _, a := range airports {
			airportDTOs = append(airportDTOs, dto.AirportDTO{
				IATACode:    a.IATACode,
				Name:        a.Name,
				City:        a.City,
				Country:     a.Country,
				CountryCode: a.CountryCode,
				Latitude:    a.Latitude,
				Longitude:   a.Longitude,
				Timezone:    a.Timezone,
			})
		}

		response := dto.AirportListResponse{
			Airports: airportDTOs,
			Total:    len(airportDTOs),
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleGetFlight returns a specific flight by ID
func handleGetFlight(flightRepo ports.FlightRepositoryPort, log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Extract flight ID from URL
		flightIDStr := r.PathValue("id")
		flightID, err := uuid.Parse(flightIDStr)
		if err != nil {
			respondError(w, r, apperrors.BadRequest("invalid flight ID format"))
			return
		}

		if flightRepo == nil {
			respondError(w, r, apperrors.Internal("flight repository not available"))
			return
		}

		// Find flight
		flight, err := flightRepo.FindByID(ctx, flightID)
		if err != nil {
			log.Warn("Flight not found", logger.Fields{"id": flightIDStr, "error": err.Error()})
			respondError(w, r, apperrors.NotFound(fmt.Sprintf("flight %s not found", flightIDStr)))
			return
		}

		// Convert to response
		response := dto.FlightResultDTO{
			ID:              flight.ID,
			FlightNumber:    flight.FlightNumber,
			AirlineCode:     flight.AirlineCode,
			Origin:          flight.OriginCode,
			Destination:     flight.DestinationCode,
			DepartureDate:   flight.ScheduledDeparture.Format("2006-01-02"),
			DepartureTime:   flight.ScheduledDeparture.Format("15:04"),
			ArrivalDate:     flight.ScheduledArrival.Format("2006-01-02"),
			ArrivalTime:     flight.ScheduledArrival.Format("15:04"),
			AircraftType:    flight.AircraftType,
			SeatsAvailable:  flight.AvailableSeats,
			Status:          string(flight.Status),
			CabinClass:      string(flight.CabinClass),
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleCreateBooking handles booking creation
func handleCreateBooking(createBookingUC *usecases.CreateBookingUseCase, log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Decode request body
		var req dto.CreateBookingRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, apperrors.BadRequest(fmt.Sprintf("invalid request body: %v", err)))
			return
		}

		// Extract user ID from context (set by JWT middleware)
		var userID *uuid.UUID
		if userIDStr, ok := ctx.Value("user_id").(string); ok && userIDStr != "" {
			uid, err := uuid.Parse(userIDStr)
			if err == nil {
				userID = &uid
			}
		}

		// Execute booking creation
		response, err := createBookingUC.Execute(ctx, &req, userID)
		if err != nil {
			log.Error("Booking creation failed", logger.Fields{"error": err.Error()})
			respondError(w, r, toAppError(err))
			return
		}

		respondJSON(w, http.StatusCreated, response)
	}
}

// handleGetBooking retrieves booking details
func handleGetBooking(getBookingUC *usecases.GetBookingUseCase, log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Extract booking code from URL
		code := r.PathValue("code")
		if code == "" {
			respondError(w, r, apperrors.BadRequest("booking code is required"))
			return
		}

		// Extract user ID from context
		var userID *uuid.UUID
		if userIDStr, ok := ctx.Value("user_id").(string); ok && userIDStr != "" {
			uid, err := uuid.Parse(userIDStr)
			if err == nil {
				userID = &uid
			}
		}

		// Get booking
		response, err := getBookingUC.Execute(ctx, code, userID)
		if err != nil {
			log.Warn("Booking not found", logger.Fields{"code": code, "error": err.Error()})
			respondError(w, r, apperrors.NotFound(fmt.Sprintf("booking %s not found", code)))
			return
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleCancelBooking handles booking cancellation
func handleCancelBooking(getBookingUC *usecases.GetBookingUseCase, log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Extract booking code from URL
		code := r.PathValue("code")
		if code == "" {
			respondError(w, r, apperrors.BadRequest("booking code is required"))
			return
		}

		// In a real implementation, this would call a cancel use case
		// For now, return a mock response
		response := dto.CancelBookingResponse{
			BookingCode:     code,
			Status:          "CANCELLED",
			RefundAmountVND: 0,
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleMockPaymentCallback returns an HTML page for payment result
func handleMockPaymentCallback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}

	bookingCode := r.URL.Query().Get("booking_code")
	if bookingCode == "" {
		bookingCode = "MOCK123"
	}

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Result - Flight Booking</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 48px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            text-align: center;
            max-width: 480px;
        }
        h1 { color: #333; margin-bottom: 16px; }
        .status { font-size: 24px; font-weight: 600; margin-bottom: 24px; }
        .status.success { color: #10b981; }
        .status.failed { color: #ef4444; }
        .status.pending { color: #f59e0b; }
        .booking-code { font-size: 18px; color: #666; margin-bottom: 32px; }
        .btn {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #764ba2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Payment Result</h1>
        <div class="status %s">%s</div>
        <div class="booking-code">Booking Code: %s</div>
        <a href="/" class="btn">Return to Home</a>
    </div>
</body>
</html>
`, status, strings.ToUpper(status), bookingCode)

	w.Write([]byte(html))
}

// handleLogin handles user login (mock implementation)
func handleLogin(log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req dto.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, apperrors.BadRequest("invalid request body"))
			return
		}

		// Mock login - in production, validate against database
		if req.Email == "" || req.Password == "" {
			respondError(w, r, apperrors.BadRequest("email and password are required"))
			return
		}

		// Return mock response
		response := dto.LoginResponse{
			AccessToken:  "mock_access_token_" + uuid.New().String(),
			RefreshToken: "mock_refresh_token_" + uuid.New().String(),
			ExpiresIn:    86400,
			User: dto.UserDTO{
				ID:        uuid.New(),
				Email:     req.Email,
				FirstName: "Test",
				LastName:  "User",
				Role:      "customer",
			},
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// handleRegister handles user registration (mock implementation)
func handleRegister(log *logger.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req dto.RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, apperrors.BadRequest("invalid request body"))
			return
		}

		// Validate request
		if errors := req.Validate(); len(errors) > 0 {
			respondError(w, r, apperrors.ValidationFailed("validation failed").WithFields(flattenErrors(errors)))
			return
		}

		// Mock registration - in production, save to database
		response := dto.UserDTO{
			ID:        uuid.New(),
			Email:     req.Email,
			FirstName: req.FirstName,
			LastName:  req.LastName,
			Role:      "customer",
		}

		respondJSON(w, http.StatusCreated, response)
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

// respondJSON writes a JSON response
func respondJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode response", "error", err)
	}
}

// respondError writes an error response
func respondError(w http.ResponseWriter, r *http.Request, err error) {
	requestID := middleware.GetRequestID(r.Context())

	var appErr *apperrors.AppError
	if errors, ok := err.(*apperrors.AppError); ok {
		appErr = errors
	} else {
		appErr = apperrors.Internal(err.Error())
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Request-ID", requestID)
	w.WriteHeader(appErr.HTTPStatus)

	response := map[string]interface{}{
		"code":       appErr.Code,
		"message":    appErr.Message,
		"request_id": requestID,
	}

	if appErr.Detail != "" {
		response["detail"] = appErr.Detail
	}

	json.NewEncoder(w).Encode(response)
}

// toAppError converts a regular error to an AppError
func toAppError(err error) *apperrors.AppError {
	if err == nil {
		return apperrors.Internal("unknown error")
	}
	return apperrors.FromError(err)
}

// flattenErrors converts a map of errors to a slice of strings
func flattenErrors(errors map[string]string) []string {
	result := make([]string, 0, len(errors))
	for field, msg := range errors {
		result = append(result, fmt.Sprintf("%s: %s", field, msg))
	}
	return result
}

// getMockAirports returns a list of mock airports
func getMockAirports() []entities.Airport {
	return []entities.Airport{
		{IATACode: "HAN", Name: "Noi Bai International Airport", City: "Hanoi", Country: "Vietnam", CountryCode: "VN", Latitude: 21.2212, Longitude: 105.8069, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "SGN", Name: "Tan Son Nhat International Airport", City: "Ho Chi Minh City", Country: "Vietnam", CountryCode: "VN", Latitude: 10.8188, Longitude: 106.6519, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "DAD", Name: "Da Nang International Airport", City: "Da Nang", Country: "Vietnam", CountryCode: "VN", Latitude: 16.0439, Longitude: 108.1994, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "CXR", Name: "Cam Ranh International Airport", City: "Cam Ranh", Country: "Vietnam", CountryCode: "VN", Latitude: 11.9983, Longitude: 109.2194, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "PQC", Name: "Phu Quoc International Airport", City: "Phu Quoc", Country: "Vietnam", CountryCode: "VN", Latitude: 10.1696, Longitude: 103.9931, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "HPH", Name: "Cat Bi International Airport", City: "Hai Phong", Country: "Vietnam", CountryCode: "VN", Latitude: 20.8194, Longitude: 106.7250, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "VII", Name: "Vinh Airport", City: "Vinh", Country: "Vietnam", CountryCode: "VN", Latitude: 18.7379, Longitude: 105.6708, Timezone: "Asia/Ho_Chi_Minh"},
		{IATACode: "DLI", Name: "Lien Khuong Airport", City: "Da Lat", Country: "Vietnam", CountryCode: "VN", Latitude: 11.7500, Longitude: 108.3667, Timezone: "Asia/Ho_Chi_Minh"},
	}
}
