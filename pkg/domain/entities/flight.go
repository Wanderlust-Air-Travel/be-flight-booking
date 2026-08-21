package entities

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidIATACode    = errors.New("invalid IATA code: must be 3 uppercase letters")
	ErrInvalidRoute       = errors.New("invalid route: origin and destination must be different")
	ErrEmptyAirlineCode   = errors.New("airline code cannot be empty")
	ErrInvalidDistance    = errors.New("distance must be positive")
	ErrInvalidDuration    = errors.New("average duration must be positive")
)

// Airport represents an airport entity with its geographic and timezone information
type Airport struct {
	IATACode    string  `json:"iatacode" db:"iata_code"`
	Name        string  `json:"name" db:"name"`
	City        string  `json:"city" db:"city"`
	Country     string  `json:"country" db:"country"`
	CountryCode string  `json:"country_code" db:"country_code"`
	Latitude    float64 `json:"latitude" db:"latitude"`
	Longitude   float64 `json:"longitude" db:"longitude"`
	Timezone    string  `json:"timezone" db:"timezone"`
	Altitude    float64 `json:"altitude" db:"altitude"`
}

// NewAirport creates a new Airport with validation
func NewAirport(iataCode, name, city, country, countryCode string, latitude, longitude float64, timezone string, altitude float64) (*Airport, error) {
	if len(iataCode) != 3 {
		return nil, ErrInvalidIATACode
	}
	for _, c := range iataCode {
		if c < 'A' || c > 'Z' {
			return nil, ErrInvalidIATACode
		}
	}

	return &Airport{
		IATACode:    iataCode,
		Name:        name,
		City:        city,
		Country:     country,
		CountryCode:  countryCode,
		Latitude:    latitude,
		Longitude:   longitude,
		Timezone:    timezone,
		Altitude:    altitude,
	}, nil
}

// Airline represents an airline entity
type Airline struct {
	IATACode    string `json:"iatacode" db:"iata_code"`
	Name        string `json:"name" db:"name"`
	Country     string `json:"country" db:"country"`
	CountryCode string `json:"country_code" db:"country_code"`
	LogoURL     string `json:"logo_url" db:"logo_url"`
	Active      bool   `json:"active" db:"active"`
}

// Route represents a flight route between two airports operated by an airline
type Route struct {
	ID              uuid.UUID `json:"id" db:"id"`
	OriginCode      string    `json:"origin_code" db:"origin_code"`
	DestinationCode string    `json:"destination_code" db:"destination_code"`
	AirlineCode     string    `json:"airline_code" db:"airline_code"`
	DistanceKm      float64   `json:"distance_km" db:"distance_km"`
	AvgDurationMin  int       `json:"avg_duration_min" db:"avg_duration_min"`
	Active          bool      `json:"active" db:"active"`
}

// NewRoute creates a new Route with validation
func NewRoute(originCode, destinationCode, airlineCode string, distanceKm float64, avgDurationMin int) (*Route, error) {
	if len(originCode) != 3 || len(destinationCode) != 3 {
		return nil, ErrInvalidIATACode
	}
	if originCode == destinationCode {
		return nil, ErrInvalidRoute
	}
	if airlineCode == "" {
		return nil, ErrEmptyAirlineCode
	}
	if distanceKm <= 0 {
		return nil, ErrInvalidDistance
	}
	if avgDurationMin <= 0 {
		return nil, ErrInvalidDuration
	}

	return &Route{
		ID:              uuid.New(),
		OriginCode:      originCode,
		DestinationCode: destinationCode,
		AirlineCode:     airlineCode,
		DistanceKm:      distanceKm,
		AvgDurationMin:  avgDurationMin,
		Active:          true,
	}, nil
}

// FlightStatus represents the status of a flight
type FlightStatus string

const (
	StatusScheduled  FlightStatus = "SCHEDULED"
	StatusBoarding   FlightStatus = "BOARDING"
	StatusDeparted   FlightStatus = "DEPARTED"
	StatusInAir      FlightStatus = "IN_AIR"
	StatusLanded     FlightStatus = "LANDED"
	StatusArrived    FlightStatus = "ARRIVED"
	StatusCancelled  FlightStatus = "CANCELLED"
	StatusDelayed    FlightStatus = "DELAYED"
)

// IsTerminal returns true if the flight status is terminal (no further transitions possible)
func (s FlightStatus) IsTerminal() bool {
	return s == StatusArrived || s == StatusCancelled
}

// CabinClass represents the cabin class type
type CabinClass string

const (
	CabinEconomy        CabinClass = "ECONOMY"
	CabinPremiumEconomy CabinClass = "PREMIUM_ECONOMY"
	CabinBusiness       CabinClass = "BUSINESS"
	CabinFirst          CabinClass = "FIRST"
)

// Multiplier returns the price multiplier for the cabin class
func (c CabinClass) Multiplier() float64 {
	switch c {
	case CabinEconomy:
		return 1.0
	case CabinPremiumEconomy:
		return 1.5
	case CabinBusiness:
		return 3.5
	case CabinFirst:
		return 5.0
	default:
		return 1.0
	}
}

// FareClass represents the fare class within a cabin
type FareClass string

const (
	FareClassEconomyFlex    FareClass = "ECONOMY_FLEX"
	FareClassEconomyStandard FareClass = "ECONOMY_STANDARD"
	FareClassEconomySaver   FareClass = "ECONOMY_SAVER"
	FareClassBusinessFlex   FareClass = "BUSINESS_FLEX"
	FareClassBusinessStandard FareClass = "BUSINESS_STANDARD"
)

// SeatStatus represents the status of a seat
type SeatStatus string

const (
	SeatAvailable   SeatStatus = "AVAILABLE"
	SeatReserved    SeatStatus = "RESERVED"
	SeatBooked      SeatStatus = "BOOKED"
	SeatLocked      SeatStatus = "LOCKED"
	SeatMaintenance SeatStatus = "MAINTENANCE"
)

// FlightInstance represents a specific flight instance (scheduled flight on a specific date)
type FlightInstance struct {
	ID                  uuid.UUID   `json:"id" db:"id"`
	FlightNumber        string      `json:"flight_number" db:"flight_number"`
	RouteID             uuid.UUID   `json:"route_id" db:"route_id"`
	AirlineCode         string      `json:"airline_code" db:"airline_code"`
	OriginCode          string      `json:"origin_code" db:"origin_code"`
	DestinationCode     string      `json:"destination_code" db:"destination_code"`
	ScheduledDeparture  time.Time   `json:"scheduled_departure" db:"scheduled_departure"`
	ScheduledArrival    time.Time   `json:"scheduled_arrival" db:"scheduled_arrival"`
	ActualDeparture     *time.Time  `json:"actual_departure,omitempty" db:"actual_departure"`
	ActualArrival       *time.Time  `json:"actual_arrival,omitempty" db:"actual_arrival"`
	DepartureTerminal   string      `json:"departure_terminal" db:"departure_terminal"`
	ArrivalTerminal     string      `json:"arrival_terminal" db:"arrival_terminal"`
	AircraftType        string      `json:"aircraft_type" db:"aircraft_type"`
	AvailableSeats      int         `json:"available_seats" db:"available_seats"`
	TotalSeats          int         `json:"total_seats" db:"total_seats"`
	Status              FlightStatus `json:"status" db:"status"`
	CabinClass          CabinClass  `json:"cabin_class" db:"cabin_class"`
	Gate                string      `json:"gate" db:"gate"`
	CreatedAt           time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time   `json:"updated_at" db:"updated_at"`
}

// CanBook returns true if the flight can be booked
func (f *FlightInstance) CanBook() bool {
	if f.Status == StatusCancelled || f.Status == StatusBoarding || f.Status == StatusDeparted || f.Status == StatusInAir {
		return false
	}
	if f.AvailableSeats <= 0 {
		return false
	}
	return true
}

// IsDeparted returns true if the flight has departed
func (f *FlightInstance) IsDeparted() bool {
	return f.Status == StatusDeparted || f.Status == StatusInAir || f.Status == StatusLanded || f.Status == StatusArrived
}

// DaysUntilDeparture returns the number of days until departure (can be negative if already departed)
func (f *FlightInstance) DaysUntilDeparture() int {
	now := time.Now()
	departure := f.ScheduledDeparture
	if f.ActualDeparture != nil {
		departure = *f.ActualDeparture
	}
	
	duration := departure.Sub(now)
	days := int(duration.Hours() / 24)
	return days
}

// Seat represents a seat on a flight
type Seat struct {
	SeatNumber  string     `json:"seat_number" db:"seat_number"`
	SeatRow     int        `json:"seat_row" db:"seat_row"`
	SeatColumn  string     `json:"seat_column" db:"seat_column"`
	CabinClass  CabinClass `json:"cabin_class" db:"cabin_class"`
	FareClass   FareClass  `json:"fare_class" db:"fare_class"`
	FareVND     int64      `json:"fare_vnd" db:"fare_vnd"`
	Status      SeatStatus `json:"status" db:"status"`
}

// IsAvailable returns true if the seat can be booked
func (s *Seat) IsAvailable() bool {
	return s.Status == SeatAvailable
}

// FareRule represents pricing rules for a flight
type FareRule struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	FlightInstanceID uuid.UUID  `json:"flight_instance_id" db:"flight_instance_id"`
	CabinClass       CabinClass `json:"cabin_class" db:"cabin_class"`
	FareClass        FareClass  `json:"fare_class" db:"fare_class"`
	BaseFareVND      int64      `json:"base_fare_vnd" db:"base_fare_vnd"`
	FuelSurchargeVND int64     `json:"fuel_surcharge_vnd" db:"fuel_surcharge_vnd"`
	AirportTaxVND    int64      `json:"airport_tax_vnd" db:"airport_tax_vnd"`
	ServiceFeeVND    int64      `json:"service_fee_vnd" db:"service_fee_vnd"`
	Refundable       bool       `json:"refundable" db:"refundable"`
	ChangeFeeVND     int64      `json:"change_fee_vnd" db:"change_fee_vnd"`
	CancellationFeeVND int64    `json:"cancellation_fee_vnd" db:"cancellation_fee_vnd"`
	LuggageAllowance int        `json:"luggage_allowance" db:"luggage_allowance"`
	CabinBaggage     int        `json:"cabin_baggage" db:"cabin_baggage"`
	ValidFrom        time.Time  `json:"valid_from" db:"valid_from"`
	ValidTo          time.Time  `json:"valid_to" db:"valid_to"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// ExternalFlightSource represents flight data from an external provider
type ExternalFlightSource struct {
	ExternalID   string       `json:"external_id" db:"external_id"`
	Provider     string       `json:"provider" db:"provider"`
	FlightNumber string       `json:"flight_number" db:"flight_number"`
	DepIATA      string       `json:"dep_iata" db:"dep_iata"`
	ArrIATA      string       `json:"arr_iata" db:"arr_iata"`
	DepTimeUTC   time.Time    `json:"dep_time_utc" db:"dep_time_utc"`
	ArrTimeUTC   time.Time    `json:"arr_time_utc" db:"arr_time_utc"`
	Status       FlightStatus `json:"status" db:"status"`
}

// String returns a human-readable representation of the external flight source
func (e *ExternalFlightSource) String() string {
	return fmt.Sprintf("[%s] %s: %s -> %s at %s", e.Provider, e.FlightNumber, e.DepIATA, e.ArrIATA, e.DepTimeUTC.Format(time.RFC3339))
}

// DurationMinutes returns the flight duration in minutes
func (e *ExternalFlightSource) DurationMinutes() int {
	return int(e.ArrTimeUTC.Sub(e.DepTimeUTC).Minutes())
}
