// pkg/application/dto/dto.go
// Data Transfer Objects
//
// This file contains all DTOs used for communication between application
// layer and external interfaces (HTTP handlers, gRPC, etc.)

package dto

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"flight-booking/pkg/domain/entities/booking"
	"flight-booking/pkg/domain/entities/flight"
	"flight-booking/pkg/domain/valueobjects"
	"flight-booking/pkg/domain/valueobjects/vo"
)

// ============================================================================
// Search Flights DTOs
// ============================================================================

// SearchFlightsRequest represents a request to search for flights.
type SearchFlightsRequest struct {
	Origin        string         `json:"origin" validate:"required,len=3"`
	Destination   string         `json:"destination" validate:"required,len=3"`
	DepartureDate string         `json:"departure_date" validate:"required"`
	ReturnDate    string         `json:"return_date,omitempty"`
	Passengers    int            `json:"passengers" validate:"required,min=1,max=9"`
	CabinClass    string         `json:"cabin_class" validate:"required,oneof=economy business first premium_economy"`
	DirectOnly    bool           `json:"direct_only"`
}

// Validate validates the SearchFlightsRequest and returns validation errors.
func (r *SearchFlightsRequest) Validate() map[string]string {
	errors := make(map[string]string)

	// Validate IATA codes
	rx := regexp.MustCompile(`^[A-Z]{3}$`)
	if !rx.MatchString(strings.ToUpper(r.Origin)) {
		errors["origin"] = "origin must be a valid 3-letter IATA airport code"
	}
	if !rx.MatchString(strings.ToUpper(r.Destination)) {
		errors["destination"] = "destination must be a valid 3-letter IATA airport code"
	}
	if strings.ToUpper(r.Origin) == strings.ToUpper(r.Destination) {
		errors["origin"] = "origin and destination cannot be the same"
	}

	// Validate departure date
	if r.DepartureDate == "" {
		errors["departure_date"] = "departure_date is required"
	} else {
		departureDate, err := time.Parse("2006-01-02", r.DepartureDate)
		if err != nil {
			errors["departure_date"] = "departure_date must be in YYYY-MM-DD format"
		} else if departureDate.Before(time.Now().Truncate(24 * time.Hour)) {
			errors["departure_date"] = "departure_date cannot be in the past"
		}
	}

	// Validate return date (optional for one-way)
	if r.ReturnDate != "" {
		returnDate, err := time.Parse("2006-01-02", r.ReturnDate)
		if err != nil {
			errors["return_date"] = "return_date must be in YYYY-MM-DD format"
		} else {
			departureDate, _ := time.Parse("2006-01-02", r.DepartureDate)
			if returnDate.Before(departureDate) {
				errors["return_date"] = "return_date cannot be before departure_date"
			}
		}
	}

	// Validate passenger count
	if r.Passengers < 1 {
		errors["passengers"] = "at least 1 passenger is required"
	} else if r.Passengers > 9 {
		errors["passengers"] = "maximum 9 passengers allowed"
	}

	// Validate cabin class
	validCabins := map[string]bool{
		"economy": true, "business": true, "first": true, "premium_economy": true,
	}
	if !validCabins[strings.ToLower(r.CabinClass)] {
		errors["cabin_class"] = "cabin_class must be one of: economy, business, first, premium_economy"
	}

	return errors
}

// ToLowerCase normalizes the request fields to lowercase.
func (r *SearchFlightsRequest) ToLowerCase() {
	r.Origin = strings.ToUpper(r.Origin)
	r.Destination = strings.ToUpper(r.Destination)
	r.CabinClass = strings.ToLower(r.CabinClass)
}

// SearchFlightsResponse represents the response for a flight search.
type SearchFlightsResponse struct {
	SearchID        uuid.UUID         `json:"search_id"`
	Origin          string            `json:"origin"`
	Destination     string            `json:"destination"`
	DepartureDate   string            `json:"departure_date"`
	ReturnDate      string            `json:"return_date,omitempty"`
	OutboundFlights []FlightResultDTO `json:"outbound_flights"`
	ReturnFlights   []FlightResultDTO `json:"return_flights,omitempty"`
	Provider        string            `json:"provider"`
	DurationMs      int64             `json:"duration_ms"`
	QueriedAt       time.Time         `json:"queried_at"`
}

// FlightResultDTO represents a flight in the search response.
type FlightResultDTO struct {
	ID                  uuid.UUID        `json:"id"`
	FlightNumber        string           `json:"flight_number"`
	AirlineCode         string           `json:"airline_code"`
	AirlineName         string           `json:"airline_name"`
	Origin              string           `json:"origin"`
	Destination         string           `json:"destination"`
	DepartureDate       string           `json:"departure_date"`
	DepartureTime       string           `json:"departure_time"`
	ArrivalDate         string           `json:"arrival_date"`
	ArrivalTime         string           `json:"arrival_time"`
	Duration            string           `json:"duration"`
	DurationMinutes     int              `json:"duration_minutes"`
	AircraftType        string           `json:"aircraft_type"`
	Stops               int              `json:"stops"`
	Connection          string           `json:"connection,omitempty"`
	SeatsAvailable      int              `json:"seats_available"`
	Status              string           `json:"status"`
	CabinClass          string           `json:"cabin_class"`
	Price               PriceDTO         `json:"price"`
	BaggageAllowance    BaggageAllowance `json:"baggage_allowance,omitempty"`
}

// BaggageAllowance represents baggage allowance information.
type BaggageAllowance struct {
	CheckedBag int `json:"checked_bag"`
	CabinBag   int `json:"cabin_bag"`
	WeightKg   int `json:"weight_kg,omitempty"`
}

// PriceDTO represents pricing breakdown.
type PriceDTO struct {
	BaseFareVND      int64  `json:"base_fare_vnd"`
	FuelSurchargeVND int64  `json:"fuel_surcharge_vnd"`
	AirportTaxVND    int64  `json:"airport_tax_vnd"`
	ServiceFeeVND    int64  `json:"service_fee_vnd"`
	SubtotalVND     int64  `json:"subtotal_vnd"`
	TotalVND        int64  `json:"total_vnd"`
	Currency        string `json:"currency"`
}

// ToPriceDTO converts a PriceBreakdown to PriceDTO.
func ToPriceDTO(pb vo.PriceBreakdown) PriceDTO {
	return PriceDTO{
		BaseFareVND:       pb.BaseFareVND,
		FuelSurchargeVND: pb.FuelSurchargeVND,
		AirportTaxVND:     pb.AirportTaxVND,
		ServiceFeeVND:     pb.ServiceFeeVND,
		SubtotalVND:       pb.SubtotalVND,
		TotalVND:          pb.TotalVND,
		Currency:          pb.Currency,
	}
}

// ============================================================================
// Booking DTOs
// ============================================================================

// CreateBookingRequest represents a request to create a new booking.
type CreateBookingRequest struct {
	SearchID      string            `json:"search_id" validate:"required"`
	FlightIDs     []string         `json:"flight_ids" validate:"required,min=1"`
	CabinClass    string           `json:"cabin_class" validate:"required"`
	Passengers    []PassengerDTO   `json:"passengers" validate:"required,min=1,max=9"`
	ContactEmail  string           `json:"contact_email" validate:"required,email"`
	ContactPhone  string           `json:"contact_phone" validate:"required"`
	ContactName   string           `json:"contact_name" validate:"required"`
	PaymentMethod string           `json:"payment_method" validate:"required"`
	BookingSource string           `json:"booking_source"`
}

// Validate validates the CreateBookingRequest and returns validation errors.
func (r *CreateBookingRequest) Validate() map[string]string {
	errors := make(map[string]string)

	// Validate flight IDs
	if len(r.FlightIDs) == 0 {
		errors["flight_ids"] = "at least one flight is required"
	}

	// Validate passengers
	if len(r.Passengers) == 0 {
		errors["passengers"] = "at least one passenger is required"
	} else if len(r.Passengers) > 9 {
		errors["passengers"] = "maximum 9 passengers allowed"
	}

	// Validate email
	emailRx := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRx.MatchString(r.ContactEmail) {
		errors["contact_email"] = "invalid email format"
	}

	// Validate contact phone
	phoneRx := regexp.MustCompile(`^\+?[0-9]{10,15}$`)
	phone := strings.ReplaceAll(r.ContactPhone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	if !phoneRx.MatchString(phone) {
		errors["contact_phone"] = "invalid phone number format"
	}

	// Validate contact name
	if strings.TrimSpace(r.ContactName) == "" {
		errors["contact_name"] = "contact name is required"
	}

	// Validate payment method
	if r.PaymentMethod == "" {
		errors["payment_method"] = "payment method is required"
	}

	// Validate passengers
	for i, p := range r.Passengers {
		pErrors := p.Validate()
		for k, v := range pErrors {
			errors[fmt.Sprintf("passengers[%d].%s", i, k)] = v
		}
	}

	return errors
}

// CreateBookingResponse represents the response after creating a booking.
type CreateBookingResponse struct {
	BookingCode     string            `json:"booking_code"`
	Status          string            `json:"status"`
	TotalAmountVND  int64             `json:"total_amount_vnd"`
	PaymentURL      string            `json:"payment_url,omitempty"`
	PaymentDeadline time.Time         `json:"payment_deadline"`
	ExpiresIn       int               `json:"expires_in"`
	Passengers      []PassengerDTO    `json:"passengers"`
	Flights         []FlightResultDTO `json:"flights"`
}

// PassengerDTO represents passenger information.
type PassengerDTO struct {
	Title           string `json:"title" validate:"required,oneof=Mr Ms Mrs Miss Dr"`
	FirstName       string `json:"first_name" validate:"required"`
	LastName        string `json:"last_name" validate:"required"`
	Gender          string `json:"gender" validate:"required,oneof=male female other"`
	DateOfBirth     string `json:"date_of_birth" validate:"required"`
	Nationality     string `json:"nationality" validate:"required,len=2"`
	PassportNumber  string `json:"passport_number,omitempty"`
	PassportExpiry  string `json:"passport_expiry,omitempty"`
	Type            string `json:"type" validate:"required,oneof=adult child infant"`
	Email           string `json:"email,omitempty"`
	Phone           string `json:"phone,omitempty"`
}

// Validate validates the PassengerDTO and returns validation errors.
func (p *PassengerDTO) Validate() map[string]string {
	errors := make(map[string]string)

	// Validate title
	validTitles := map[string]bool{"Mr": true, "Ms": true, "Mrs": true, "Miss": true, "Dr": true}
	if !validTitles[p.Title] {
		errors["title"] = "title must be one of: Mr, Ms, Mrs, Miss, Dr"
	}

	// Validate first name
	if strings.TrimSpace(p.FirstName) == "" {
		errors["first_name"] = "first name is required"
	}

	// Validate last name
	if strings.TrimSpace(p.LastName) == "" {
		errors["last_name"] = "last name is required"
	}

	// Validate gender
	validGenders := map[string]bool{"male": true, "female": true, "other": true}
	if !validGenders[strings.ToLower(p.Gender)] {
		errors["gender"] = "gender must be one of: male, female, other"
	}

	// Validate date of birth
	if p.DateOfBirth == "" {
		errors["date_of_birth"] = "date of birth is required"
	} else {
		dob, err := time.Parse("2006-01-02", p.DateOfBirth)
		if err != nil {
			errors["date_of_birth"] = "date of birth must be in YYYY-MM-DD format"
		} else if dob.After(time.Now()) {
			errors["date_of_birth"] = "date of birth cannot be in the future"
		}
	}

	// Validate nationality (ISO 3166-1 alpha-2)
	nationalityRx := regexp.MustCompile(`^[A-Z]{2}$`)
	if !nationalityRx.MatchString(strings.ToUpper(p.Nationality)) {
		errors["nationality"] = "nationality must be a 2-letter country code"
	}

	// Validate passenger type
	validTypes := map[string]bool{"adult": true, "child": true, "infant": true}
	if !validTypes[strings.ToLower(p.Type)] {
		errors["type"] = "type must be one of: adult, child, infant"
	}

	return errors
}

// ToBookingPassenger converts PassengerDTO to BookingPassenger entity.
func (p *PassengerDTO) ToBookingPassenger() (*booking.BookingPassenger, error) {
	dob, err := time.Parse("2006-01-02", p.DateOfBirth)
	if err != nil {
		return nil, fmt.Errorf("invalid date of birth: %w", err)
	}

	var passportExpiry *time.Time
	if p.PassportExpiry != "" {
		pe, err := time.Parse("2006-01-02", p.PassportExpiry)
		if err != nil {
			return nil, fmt.Errorf("invalid passport expiry: %w", err)
		}
		passportExpiry = &pe
	}

	gender, _ := valueobjects.NewGender(p.Gender)
	passengerType, _ := valueobjects.NewPassengerType(p.Type)

	return &booking.BookingPassenger{
		ID:              uuid.New(),
		Title:           p.Title,
		FirstName:       p.FirstName,
		LastName:        p.LastName,
		Gender:          gender,
		DateOfBirth:     dob,
		Nationality:     p.Nationality,
		PassportNumber:  p.PassportNumber,
		PassportExpiry:  passportExpiry,
		Type:            passengerType,
	}, nil
}

// GetBookingRequest represents a request to get booking details.
type GetBookingRequest struct {
	BookingCode string `json:"booking_code"`
	UserID      string `json:"user_id,omitempty"`
}

// BookingDetailDTO represents detailed booking information.
type BookingDetailDTO struct {
	BookingCode    string                 `json:"booking_code"`
	Status         string                 `json:"status"`
	TripType       string                 `json:"trip_type"`
	TotalAmountVND int64                  `json:"total_amount_vnd"`
	Price          PriceDTO               `json:"price"`
	Contact        ContactDTO             `json:"contact"`
	Passengers     []PassengerDetailDTO   `json:"passengers"`
	Flights        []FlightResultDTO      `json:"flights"`
	Payment        *PaymentDetailDTO      `json:"payment,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// ContactDTO represents contact information.
type ContactDTO struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
	Name  string `json:"name"`
}

// PassengerDetailDTO represents detailed passenger information.
type PassengerDetailDTO struct {
	PassengerDTO
	SeatNumber   string `json:"seat_number,omitempty"`
	TicketNumber string `json:"ticket_number,omitempty"`
}

// PaymentDetailDTO represents payment details.
type PaymentDetailDTO struct {
	Status        string    `json:"status"`
	Provider      string    `json:"provider"`
	ProviderTxnID string    `json:"provider_txn_id"`
	AmountVND     int64     `json:"amount_vnd"`
	PaidAt        time.Time `json:"paid_at,omitempty"`
}

// CancelBookingRequest represents a request to cancel a booking.
type CancelBookingRequest struct {
	BookingCode  string `json:"booking_code" validate:"required"`
	Reason       string `json:"reason"`
	CancelledBy  string `json:"cancelled_by" validate:"required"`
}

// Validate validates the CancelBookingRequest and returns validation errors.
func (r *CancelBookingRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if r.BookingCode == "" {
		errors["booking_code"] = "booking code is required"
	}

	if r.CancelledBy == "" {
		errors["cancelled_by"] = "cancelled_by is required"
	}

	return errors
}

// CancelBookingResponse represents the response after cancelling a booking.
type CancelBookingResponse struct {
	BookingCode     string `json:"booking_code"`
	Status          string `json:"status"`
	RefundAmountVND int64  `json:"refund_amount_vnd"`
}

// ============================================================================
// Auth DTOs
// ============================================================================

// LoginRequest represents a login request.
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// Validate validates the LoginRequest and returns validation errors.
func (r *LoginRequest) Validate() map[string]string {
	errors := make(map[string]string)

	emailRx := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRx.MatchString(r.Email) {
		errors["email"] = "invalid email format"
	}

	if r.Password == "" {
		errors["password"] = "password is required"
	}

	return errors
}

// LoginResponse represents a login response.
type LoginResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn    int64    `json:"expires_in"`
	User         UserDTO  `json:"user"`
}

// RegisterRequest represents a registration request.
type RegisterRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Phone     string `json:"phone" validate:"required"`
}

// Validate validates the RegisterRequest and returns validation errors.
func (r *RegisterRequest) Validate() map[string]string {
	errors := make(map[string]string)

	emailRx := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRx.MatchString(r.Email) {
		errors["email"] = "invalid email format"
	}

	if len(r.Password) < 8 {
		errors["password"] = "password must be at least 8 characters"
	}

	if strings.TrimSpace(r.FirstName) == "" {
		errors["first_name"] = "first name is required"
	}

	if strings.TrimSpace(r.LastName) == "" {
		errors["last_name"] = "last name is required"
	}

	phoneRx := regexp.MustCompile(`^\+?[0-9]{10,15}$`)
	phone := strings.ReplaceAll(r.Phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	if !phoneRx.MatchString(phone) {
		errors["phone"] = "invalid phone number format"
	}

	return errors
}

// UserDTO represents user information.
type UserDTO struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"`
}

// ToUserDTO converts a User entity to UserDTO.
func ToUserDTO(u *flight.User) UserDTO {
	return UserDTO{
		ID:        u.ID,
		Email:     u.Email,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Role:      string(u.Role),
	}
}

// ============================================================================
// Airport DTOs
// ============================================================================

// AirportDTO represents airport information.
type AirportDTO struct {
	IATACode    string  `json:"iata_code"`
	Name        string  `json:"name"`
	City        string  `json:"city"`
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Timezone    string  `json:"timezone"`
}

// AirportListResponse represents a list of airports.
type AirportListResponse struct {
	Airports []AirportDTO `json:"airports"`
	Total    int          `json:"total"`
}

// ToAirportDTO converts an Airport entity to AirportDTO.
func ToAirportDTO(a *flight.Airport) AirportDTO {
	return AirportDTO{
		IATACode:    a.IATACode,
		Name:        a.Name,
		City:        a.City,
		Country:     a.Country,
		CountryCode: a.CountryCode,
		Latitude:    a.Latitude,
		Longitude:   a.Longitude,
		Timezone:    a.Timezone,
	}
}

// ============================================================================
// Common DTOs
// ============================================================================

// PaginatedResponse represents a paginated response.
type PaginatedResponse struct {
	Data        any    `json:"data"`
	Page        int    `json:"page"`
	PageSize    int    `json:"page_size"`
	TotalCount  int    `json:"total_count"`
	TotalPages  int    `json:"total_pages"`
}

// NewPaginatedResponse creates a new paginated response.
func NewPaginatedResponse(data any, page, pageSize, totalCount int) PaginatedResponse {
	totalPages := totalCount / pageSize
	if totalCount%pageSize > 0 {
		totalPages++
	}

	return PaginatedResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		TotalCount: totalCount,
		TotalPages: totalPages,
	}
}

// ErrorResponse represents an error response.
type ErrorResponse struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Detail    string `json:"detail,omitempty"`
	RequestID string `json:"request_id,omitempty"`
}

// NewErrorResponse creates a new error response.
func NewErrorResponse(code, message, detail string) ErrorResponse {
	return ErrorResponse{
		Code:    code,
		Message: message,
		Detail:  detail,
	}
}

// HealthResponse represents a health check response.
type HealthResponse struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Services  map[string]string `json:"services"`
	Timestamp time.Time         `json:"timestamp"`
}

// NewHealthResponse creates a new health response.
func NewHealthResponse(version string, services map[string]string) HealthResponse {
	status := "healthy"
	for _, v := range services {
		if v != "ok" && v != "healthy" {
			status = "degraded"
			break
		}
	}

	return HealthResponse{
		Status:    status,
		Version:   version,
		Services:  services,
		Timestamp: time.Now(),
	}
}

// ============================================================================
// Helper functions
// ============================================================================

// ToFlightResultDTO converts a FlightInstance to FlightResultDTO.
func ToFlightResultDTO(f *flight.FlightInstance, price vo.PriceBreakdown, stops int, connection string) FlightResultDTO {
	return FlightResultDTO{
		ID:              f.ID,
		FlightNumber:    f.FlightNumber,
		AirlineCode:     f.AirlineCode,
		AirlineName:     f.AirlineName,
		Origin:          f.OriginCode,
		Destination:     f.DestinationCode,
		DepartureDate:   f.DepartureDate.Format("2006-01-02"),
		DepartureTime:   f.DepartureTime.Format("15:04"),
		ArrivalDate:     f.ArrivalDate.Format("2006-01-02"),
		ArrivalTime:     f.ArrivalTime.Format("15:04"),
		Duration:        f.Duration.String(),
		DurationMinutes: int(f.Duration.Minutes()),
		AircraftType:    f.AircraftType,
		Stops:           stops,
		Connection:      connection,
		SeatsAvailable:  f.SeatsAvailable,
		Status:          string(f.Status),
		CabinClass:      string(f.CabinClass),
		Price:           ToPriceDTO(price),
		BaggageAllowance: BaggageAllowance{
			CheckedBag: 1,
			CabinBag:   1,
			WeightKg:   23,
		},
	}
}

// ToBookingDetailDTO converts a Booking to BookingDetailDTO.
func ToBookingDetailDTO(b *booking.Booking) BookingDetailDTO {
	return BookingDetailDTO{
		BookingCode:    b.BookingCode,
		Status:         string(b.Status),
		TripType:       string(b.TripType),
		TotalAmountVND: b.TotalAmountVND,
		Contact: ContactDTO{
			Email: b.ContactEmail,
			Phone: b.ContactPhone,
			Name:  b.ContactName,
		},
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}
