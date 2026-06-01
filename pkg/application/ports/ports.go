// pkg/application/ports/ports.go
// Hexagonal Architecture - Port Interfaces
//
// This file defines all the port interfaces for the flight booking system.
// Ports are the boundaries between the application core and external adapters.

package ports

import (
	"context"
	"time"

	"github.com/google/uuid"

	"flight-booking/pkg/domain/entities/booking"
	"flight-booking/pkg/domain/entities/flight"
	"flight-booking/pkg/domain/entities/user"
	"flight-booking/pkg/domain/valueobjects"
	"flight-booking/pkg/domain/valueobjects/vo"
)

// ============================================================================
// Flight Provider Port - External flight data provider (Aviationstack)
// ============================================================================

// FlightProviderPort defines the interface for external flight data providers.
type FlightProviderPort interface {
	// SearchFlights searches for available flights based on the request criteria.
	SearchFlights(ctx context.Context, req SearchFlightRequest) (*SearchFlightResponse, error)

	// GetFlightByNumber retrieves a specific flight instance by flight number and date.
	GetFlightByNumber(ctx context.Context, flightNumber, date string) (*flight.FlightInstance, error)

	// GetFlightStatus retrieves the current status of a flight.
	GetFlightStatus(ctx context.Context, flightNumber, date string) (flight.FlightStatus, error)

	// IsAvailable checks if the flight provider service is currently available.
	IsAvailable(ctx context.Context) bool
}

// SearchFlightRequest represents a request to search for flights.
type SearchFlightRequest struct {
	Origin        string              `json:"origin"`
	Destination   string              `json:"destination"`
	DepartureDate string              `json:"departure_date"`
	Passengers    int                 `json:"passengers"`
	CabinClass    valueobjects.CabinClass `json:"cabin_class"`
	DirectOnly    bool                `json:"direct_only"`
}

// SearchFlightResponse represents the response from a flight search.
type SearchFlightResponse struct {
	Flights    []FlightSearchResult `json:"flights"`
	Provider   string               `json:"provider"`
	QueriedAt  time.Time            `json:"queried_at"`
	DurationMs int64                `json:"duration_ms"`
}

// FlightSearchResult represents a single flight result in a search response.
type FlightSearchResult struct {
	Flight      *flight.FlightInstance     `json:"flight"`
	Price       vo.PriceBreakdown         `json:"price"`
	SeatsLeft   int                       `json:"seats_left"`
	Stops       int                       `json:"stops"`
	Connection  string                    `json:"connection,omitempty"`
}

// ============================================================================
// Flight Repository Port - Internal flight data storage
// ============================================================================

// FlightRepositoryPort defines the interface for flight data persistence.
type FlightRepositoryPort interface {
	// FindByID retrieves a flight instance by its unique identifier.
	FindByID(ctx context.Context, id uuid.UUID) (*flight.FlightInstance, error)

	// FindByNumberAndDate retrieves a flight instance by flight number and date.
	FindByNumberAndDate(ctx context.Context, number string, date time.Time) (*flight.FlightInstance, error)

	// SearchAvailable searches for available flights matching the criteria.
	SearchAvailable(ctx context.Context, req SearchFlightRequest) ([]flight.FlightInstance, error)

	// Save persists a flight instance.
	Save(ctx context.Context, fl *flight.FlightInstance) error

	// UpdateStatus updates the status of a flight.
	UpdateStatus(ctx context.Context, id uuid.UUID, status flight.FlightStatus) error

	// UpdateAvailability updates the seat availability for a flight.
	UpdateAvailability(ctx context.Context, id uuid.UUID, delta int) error

	// FindSchedules retrieves flight schedules for a route.
	FindSchedules(ctx context.Context, origin, dest, airline string) ([]flight.FlightSchedule, error)

	// FindRoute retrieves route information between two airports.
	FindRoute(ctx context.Context, origin, dest, airline string) (*flight.Route, error)
}

// ============================================================================
// Airport Repository Port - Airport data storage
// ============================================================================

// AirportRepositoryPort defines the interface for airport data persistence.
type AirportRepositoryPort interface {
	// FindByIATA retrieves an airport by its IATA code.
	FindByIATA(ctx context.Context, iata string) (*flight.Airport, error)

	// FindAll retrieves all airports.
	FindAll(ctx context.Context) ([]flight.Airport, error)

	// Search searches airports by a query string (name, city, IATA code).
	Search(ctx context.Context, query string) ([]flight.Airport, error)

	// Save persists an airport.
	Save(ctx context.Context, airport *flight.Airport) error
}

// ============================================================================
// Booking Repository Port - Booking data storage
// ============================================================================

// BookingRepositoryPort defines the interface for booking data persistence.
type BookingRepositoryPort interface {
	// FindByID retrieves a booking by its unique identifier.
	FindByID(ctx context.Context, id uuid.UUID) (*booking.Booking, error)

	// FindByCode retrieves a booking by its booking code.
	FindByCode(ctx context.Context, code string) (*booking.Booking, error)

	// FindByUser retrieves bookings for a specific user with pagination.
	FindByUser(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]booking.Booking, int, error)

	// Save persists a booking.
	Save(ctx context.Context, b *booking.Booking) error

	// UpdateStatus updates the status of a booking.
	UpdateStatus(ctx context.Context, id uuid.UUID, status booking.BookingStatus) error

	// SavePassengers saves passenger information for a booking.
	SavePassengers(ctx context.Context, passengers []booking.BookingPassenger) error

	// SaveFlights saves flight segments for a booking.
	SaveFlights(ctx context.Context, flights []booking.BookingFlight) error

	// WithTx executes a function within a database transaction.
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// ============================================================================
// Payment Port - External payment gateway
// ============================================================================

// PaymentPort defines the interface for payment processing.
type PaymentPort interface {
	// CreatePayment initiates a new payment transaction.
	CreatePayment(ctx context.Context, bookingID uuid.UUID, amountVND int64, currency string) (*PaymentResult, error)

	// GetPaymentStatus retrieves the status of an existing payment.
	GetPaymentStatus(ctx context.Context, providerTxnID string) (*PaymentStatusResult, error)

	// RefundPayment processes a refund for a previous payment.
	RefundPayment(ctx context.Context, providerTxnID string, amountVND int64) error
}

// PaymentResult represents the result of creating a payment.
type PaymentResult struct {
	ProviderTxnID string    `json:"provider_txn_id"`
	PaymentURL    string    `json:"payment_url"`
	ExpiresAt     time.Time `json:"expires_at"`
}

// PaymentStatusResult represents the status of a payment.
type PaymentStatusResult struct {
	Status    vo.PaymentStatus `json:"status"`
	UpdatedAt time.Time       `json:"updated_at"`
	Message   string          `json:"message"`
}

// ============================================================================
// Notification Port - Email and SMS services
// ============================================================================

// NotificationPort defines the interface for sending notifications.
type NotificationPort interface {
	// SendEmail sends an email notification.
	SendEmail(ctx context.Context, req SendEmailRequest) error

	// SendSMS sends an SMS notification.
	SendSMS(ctx context.Context, req SendSMSRequest) error
}

// SendEmailRequest represents an email to be sent.
type SendEmailRequest struct {
	To          string `json:"to"`
	Subject     string `json:"subject"`
	HTMLBody    string `json:"html_body"`
	TextBody    string `json:"text_body"`
	BookingCode string `json:"booking_code,omitempty"`
}

// SendSMSRequest represents an SMS to be sent.
type SendSMSRequest struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

// ============================================================================
// Cache Port - Redis caching
// ============================================================================

// CachePort defines the interface for caching operations.
type CachePort interface {
	// Get retrieves a value from cache by key.
	Get(ctx context.Context, key string) ([]byte, bool, error)

	// Set stores a value in cache with TTL.
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error

	// Delete removes a value from cache.
	Delete(ctx context.Context, key string) error

	// Exists checks if a key exists in cache.
	Exists(ctx context.Context, key string) (bool, error)
}

// ============================================================================
// Fare Rule Repository Port - Fare rules storage
// ============================================================================

// FareRuleRepositoryPort defines the interface for fare rule persistence.
type FareRuleRepositoryPort interface {
	// FindByRoute retrieves fare rules for a specific route.
	FindByRoute(ctx context.Context, origin, dest, airline string) ([]vo.FareRule, error)

	// FindByCabinClass retrieves fare rules for a cabin class.
	FindByCabinClass(ctx context.Context, airline string, cabin valueobjects.CabinClass) ([]vo.FareRule, error)

	// Save persists a fare rule.
	Save(ctx context.Context, rule *vo.FareRule) error
}

// ============================================================================
// User Repository Port - User data storage
// ============================================================================

// UserRepositoryPort defines the interface for user data persistence.
type UserRepositoryPort interface {
	// FindByID retrieves a user by their unique identifier.
	FindByID(ctx context.Context, id uuid.UUID) (*user.User, error)

	// FindByEmail retrieves a user by their email address.
	FindByEmail(ctx context.Context, email string) (*user.User, error)

	// Save persists a user.
	Save(ctx context.Context, u *user.User) error

	// UpdateLastLogin updates the last login timestamp for a user.
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
}

// ============================================================================
// Audit Port - Audit logging
// ============================================================================

// AuditPort defines the interface for audit logging.
type AuditPort interface {
	// Log records an audit log entry.
	Log(ctx context.Context, log *AuditLog) error
}

// AuditLog represents an audit log entry.
type AuditLog struct {
	ID           uuid.UUID `json:"id"`
	Timestamp    time.Time `json:"timestamp"`
	UserID       uuid.UUID `json:"user_id,omitempty"`
	Action       string    `json:"action"`
	EntityType   string    `json:"entity_type"`
	EntityID     uuid.UUID `json:"entity_id,omitempty"`
	Details      string    `json:"details,omitempty"`
	IPAddress    string    `json:"ip_address,omitempty"`
	UserAgent    string    `json:"user_agent,omitempty"`
	RequestID    string    `json:"request_id,omitempty"`
}

// ============================================================================
// Fare Service Port - Internal fare calculation service
// ============================================================================

// FareServicePort defines the interface for fare calculation.
type FareServicePort interface {
	// Calculate calculates the fare for a flight search result.
	Calculate(ctx context.Context, routeInfo RouteInfo, cabinClass valueobjects.CabinClass, passengers int) (*vo.PriceBreakdown, error)
}

// RouteInfo contains route information for fare calculation.
type RouteInfo struct {
	Origin        string
	Destination   string
	Airline       string
	FlightNumber  string
	DepartureTime time.Time
	Duration      time.Duration
}

// ============================================================================
// Booking Code Generator Port
// ============================================================================

// BookingCodeGeneratorPort defines the interface for generating booking codes.
type BookingCodeGeneratorPort interface {
	// Generate generates a unique booking code.
	Generate() (string, error)
}

// ============================================================================
// Validation Service Port
// ============================================================================

// ValidationServicePort defines the interface for validation services.
type ValidationServicePort interface {
	// ValidatePassengers validates passenger information.
	ValidatePassengers(ctx context.Context, passengers []PassengerInfo) map[string]string
}

// PassengerInfo contains passenger information for validation.
type PassengerInfo struct {
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	DateOfBirth     string `json:"date_of_birth"`
	Nationality     string `json:"nationality"`
	PassportNumber  string `json:"passport_number"`
	PassportExpiry  string `json:"passport_expiry"`
	Type            string `json:"type"`
}
