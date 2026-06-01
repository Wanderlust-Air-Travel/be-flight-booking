package services

import (
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"be-flight-booking/pkg/domain/entities"
	"be-flight-booking/pkg/domain/vo"
)

var (
	ErrInvalidDistance     = errors.New("distance must be positive")
	ErrInvalidPassengers  = errors.New("passenger count must be positive")
	ErrInvalidAdvanceDays = errors.New("advance days cannot be negative")
	ErrInvalidFareClass   = errors.New("invalid fare class")
	ErrNoAdultPassenger  = errors.New("at least one adult passenger is required")
	ErrInvalidEmail       = errors.New("invalid email address")
	ErrInvalidName        = errors.New("passenger name cannot be empty")
	ErrFlightNotFound     = errors.New("flight not found")
	ErrNoSeatsAvailable   = errors.New("no seats available on flight")
	ErrFlightDeparted     = errors.New("flight has already departed")
	ErrFlightCancelled    = errors.New("flight has been cancelled")
	ErrInvalidPassengerType = errors.New("invalid passenger type")
)

// FareCalculationService handles fare calculations for flights
type FareCalculationService struct {
	FuelSurchargeVND int64
	AirportTaxVND    int64
	ServiceFeeVND    int64
}

// NewFareCalculationService creates a new FareCalculationService with default values
func NewFareCalculationService() *FareCalculationService {
	return &FareCalculationService{
		FuelSurchargeVND: 330000,
		AirportTaxVND:    400000,
		ServiceFeeVND:    200000,
	}
}

// FareParams contains parameters for fare calculation
type FareParams struct {
	DistanceKm     float64
	AirlineCode    string
	CabinClass     entities.CabinClass
	AdvanceDays    int
	PassengerCount int
	FareClass      entities.FareClass
	FareRule       *entities.FareRule
}

// distanceRates contains the base fare rate per km for each airline (VND per km)
var distanceRates = map[string]float64{
	"VN": 7.5,
	"VJ": 6.0,
	"QH": 6.5,
	"VU": 5.5,
}

// baseFareClassMultipliers contains multipliers for different fare classes
var baseFareClassMultipliers = map[entities.FareClass]float64{
	entities.FareClassEconomyFlex:     1.3,
	entities.FareClassEconomyStandard:  1.0,
	entities.FareClassEconomySaver:     0.8,
	entities.FareClassBusinessFlex:     1.2,
	entities.FareClassBusinessStandard: 1.0,
}

// advanceBookingMultipliers maps advance booking days to price multipliers
var advanceBookingMultipliers = map[int]float64{
	0:  1.3,  // 0-3 days
	1:  1.3,
	2:  1.3,
	3:  1.3,
	4:  1.1,  // 4-7 days
	5:  1.1,
	6:  1.1,
	7:  1.1,
	8:  1.0,  // 8-14 days
	9:  1.0,
	10: 1.0,
	11: 1.0,
	12: 1.0,
	13: 1.0,
	14: 1.0,
	15: 0.9,  // 15-30 days
	16: 0.9,
	17: 0.9,
	18: 0.9,
	19: 0.9,
	20: 0.9,
	21: 0.9,
	22: 0.9,
	23: 0.9,
	24: 0.9,
	25: 0.9,
	26: 0.9,
	27: 0.9,
	28: 0.9,
	29: 0.9,
	30: 0.8,  // 30+ days
}

// advanceBookingMultiplier returns the multiplier based on advance booking days
func (s *FareCalculationService) advanceBookingMultiplier(advanceDays int) float64 {
	if advanceDays < 0 {
		advanceDays = 0
	}
	if advanceDays > 30 {
		return 0.8
	}
	return advanceBookingMultipliers[advanceDays]
}

// baseFare calculates the base fare for a flight
func (s *FareCalculationService) baseFare(params FareParams) int64 {
	rate := distanceRates["VN"] // Default rate
	if r, exists := distanceRates[params.AirlineCode]; exists {
		rate = r
	}

	base := int64(params.DistanceKm * rate)
	
	// Apply fare class multiplier
	classMultiplier := baseFareClassMultipliers[params.FareClass]
	if classMultiplier == 0 {
		classMultiplier = 1.0
	}
	base = int64(float64(base) * classMultiplier)

	// Apply advance booking multiplier
	advanceMultiplier := s.advanceBookingMultiplier(params.AdvanceDays)
	base = int64(float64(base) * advanceMultiplier)

	// Apply cabin class multiplier
	cabinMultiplier := params.CabinClass.Multiplier()
	base = int64(float64(base) * cabinMultiplier)

	// Multiply by passenger count
	base *= int64(params.PassengerCount)

	return base
}

// Calculate calculates the complete price breakdown for a fare
func (s *FareCalculationService) Calculate(params FareParams) (*vo.PriceBreakdown, error) {
	if params.DistanceKm <= 0 {
		return nil, ErrInvalidDistance
	}
	if params.PassengerCount <= 0 {
		return nil, ErrInvalidPassengers
	}
	if params.AdvanceDays < 0 {
		return nil, ErrInvalidAdvanceDays
	}

	// Calculate base fare
	baseFareVND := s.baseFare(params)

	// Calculate surcharges
	fuelSurcharge := s.FuelSurchargeVND * int64(params.PassengerCount)
	airportTax := s.AirportTaxVND * int64(params.PassengerCount)
	serviceFee := s.ServiceFeeVND * int64(params.PassengerCount)

	// Create Money objects
	baseFare := vo.NewMoneyVND(baseFareVND)
	fuelSurchargeMoney := vo.NewMoneyVND(fuelSurcharge)
	airportTaxMoney := vo.NewMoneyVND(airportTax)
	serviceFeeMoney := vo.NewMoneyVND(serviceFee)

	// Calculate subtotal
	subtotal, _ := baseFare.Add(fuelSurchargeMoney)
	subtotal, _ = subtotal.Add(airportTaxMoney)
	subtotal, _ = subtotal.Add(serviceFeeMoney)

	// Apply discount if fare rule has one
	var discount *vo.Money
	if params.FareRule != nil && params.FareRule.BaseFareVND > 0 {
		// Calculate discount as percentage difference
		diff := baseFareVND - params.FareRule.BaseFareVND
		if diff > 0 {
			discount = vo.NewMoneyVND(diff)
		} else {
			discount = vo.NewMoneyVND(0)
		}
	} else {
		discount = vo.NewMoneyVND(0)
	}

	// Calculate total
	total, _ := subtotal.Sub(discount)

	return vo.NewPriceBreakdown(
		baseFare,
		fuelSurchargeMoney,
		airportTaxMoney,
		serviceFeeMoney,
		subtotal,
		discount,
		total,
	), nil
}

// CalculateRouteFare calculates the fare for a round trip
func (s *FareCalculationService) CalculateRouteFare(outboundParams FareParams, returnParams FareParams) (*vo.PriceBreakdown, error) {
	outboundBreakdown, err := s.Calculate(outboundParams)
	if err != nil {
		return nil, fmt.Errorf("outbound fare calculation failed: %w", err)
	}

	returnBreakdown, err := s.Calculate(returnParams)
	if err != nil {
		return nil, fmt.Errorf("return fare calculation failed: %w", err)
	}

	// Combine the breakdowns
	baseFare, _ := outboundBreakdown.BaseFare.Add(returnBreakdown.BaseFare)
	fuelSurcharge, _ := outboundBreakdown.FuelSurcharge.Add(returnBreakdown.FuelSurcharge)
	airportTax, _ := outboundBreakdown.AirportTax.Add(returnBreakdown.AirportTax)
	serviceFee, _ := outboundBreakdown.ServiceFee.Add(returnBreakdown.ServiceFee)
	subtotal, _ := outboundBreakdown.Subtotal.Add(returnBreakdown.Subtotal)
	discount, _ := outboundBreakdown.Discount.Add(returnBreakdown.Discount)
	total, _ := outboundBreakdown.Total.Add(returnBreakdown.Total)

	return vo.NewPriceBreakdown(
		baseFare,
		fuelSurcharge,
		airportTax,
		serviceFee,
		subtotal,
		discount,
		total,
	), nil
}

// BookingValidationService handles validation for bookings
type BookingValidationService struct{}

// NewBookingValidationService creates a new BookingValidationService
func NewBookingValidationService() *BookingValidationService {
	return &BookingValidationService{}
}

// ValidationResult contains the result of a validation
type ValidationResult struct {
	Valid  bool
	Errors map[string]string
}

// NewValidationResult creates a new ValidationResult
func NewValidationResult() *ValidationResult {
	return &ValidationResult{
		Valid:  true,
		Errors: make(map[string]string),
	}
}

// AddError adds an error to the validation result
func (v *ValidationResult) AddError(field, message string) {
	v.Valid = false
	v.Errors[field] = message
}

// ValidatePassengers validates passenger information
func (s *BookingValidationService) ValidatePassengers(passengers []entities.Passenger) *ValidationResult {
	result := NewValidationResult()

	if len(passengers) == 0 {
		result.AddError("passengers", "at least one passenger is required")
		return result
	}

	hasAdult := false
	adultCount := 0
	infantCount := 0

	for i, p := range passengers {
		prefix := fmt.Sprintf("passengers[%d]", i)

		// Validate passenger type
		if p.Type != entities.PassengerAdult && p.Type != entities.PassengerChild && p.Type != entities.PassengerInfant {
			result.AddError(prefix+".type", ErrInvalidPassengerType.Error())
			continue
		}

		if p.Type == entities.PassengerAdult {
			hasAdult = true
			adultCount++
		}
		if p.Type == entities.PassengerInfant {
			infantCount++
		}

		// Validate names
		if strings.TrimSpace(p.FirstName) == "" {
			result.AddError(prefix+".firstName", ErrInvalidName.Error())
		}
		if strings.TrimSpace(p.LastName) == "" {
			result.AddError(prefix+".lastName", ErrInvalidName.Error())
		}

		// Validate email
		if !isValidEmail(p.Email) {
			result.AddError(prefix+".email", ErrInvalidEmail.Error())
		}

		// Validate date of birth
		if p.DateOfBirth.IsZero() {
			result.AddError(prefix+".dateOfBirth", "date of birth is required")
		} else if p.DateOfBirth.After(time.Now()) {
			result.AddError(prefix+".dateOfBirth", "date of birth cannot be in the future")
		}
	}

	// Require at least one adult
	if !hasAdult {
		result.AddError("passengers", ErrNoAdultPassenger.Error())
	}

	// Validate infant to adult ratio (1 infant per adult)
	if infantCount > adultCount {
		result.AddError("passengers", "number of infants cannot exceed number of adults")
	}

	return result
}

// ValidateBookingBusinessRules validates business rules for a booking
func (s *BookingValidationService) ValidateBookingBusinessRules(
	flights []*entities.FlightInstance,
	passengers []entities.Passenger,
	seats []entities.Seat,
) *ValidationResult {
	result := NewValidationResult()

	// Check if flights exist
	if len(flights) == 0 {
		result.AddError("flights", ErrFlightNotFound.Error())
		return result
	}

	// Check each flight
	for i, flight := range flights {
		prefix := fmt.Sprintf("flights[%d]", i)

		// Check if flight is cancelled
		if flight.Status == entities.StatusCancelled {
			result.AddError(prefix, ErrFlightCancelled.Error())
			continue
		}

		// Check if flight has departed
		if flight.IsDeparted() {
			result.AddError(prefix, ErrFlightDeparted.Error())
			continue
		}

		// Check departure time is in the future
		if flight.DaysUntilDeparture() < 0 {
			result.AddError(prefix, ErrFlightDeparted.Error())
		}
	}

	// Check seat availability
	for i, seat := range seats {
		prefix := fmt.Sprintf("seats[%d]", i)
		if !seat.IsAvailable() {
			result.AddError(prefix, ErrNoSeatsAvailable.Error())
		}
	}

	// Validate seat count matches passenger count
	if len(seats) > 0 && len(seats) != len(passengers) {
		result.AddError("seats", fmt.Sprintf("seat count (%d) must match passenger count (%d)", len(seats), len(passengers)))
	}

	return result
}

// isValidEmail validates an email address
func isValidEmail(email string) bool {
	email = strings.TrimSpace(email)
	if email == "" {
		return false
	}
	pattern := `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
	matched, _ := regexp.MatchString(pattern, email)
	return matched
}

// BookingCodeGenerator generates booking reference codes
type BookingCodeGenerator struct {
	seed int64
}

// NewBookingCodeGenerator creates a new BookingCodeGenerator
func NewBookingCodeGenerator() *BookingCodeGenerator {
	return &BookingCodeGenerator{
		seed: time.Now().UnixNano(),
	}
}

// Generate generates a 6-character booking code (2 letters + 4 numbers)
func (g *BookingCodeGenerator) Generate() string {
	// Linear Congruential Generator (LCG) using time-based seed
	// Formula: next = (a * current + c) mod m
	const a = 1103515245
	const c = 12345
	const m = 1 << 31

	g.seed = (a*g.seed + c) % m

	// Generate 2 random letters
	letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	letter1 := letters[int(g.seed)%26]
	g.seed = (a*g.seed + c) % m
	letter2 := letters[int(g.seed)%26]

	// Generate 4 random digits
	g.seed = (a*g.seed + c) % m
	num1 := int(g.seed) % 10
	g.seed = (a*g.seed + c) % m
	num2 := int(g.seed) % 10
	g.seed = (a*g.seed + c) % m
	num3 := int(g.seed) % 10
	g.seed = (a*g.seed + c) % m
	num4 := int(g.seed) % 10

	return fmt.Sprintf("%c%c%04d", letter1, letter2, num1*1000+num2*100+num3*10+num4)
}

// GenerateWithPrefix generates a booking code with a specific airline prefix
func (g *BookingCodeGenerator) GenerateWithPrefix(prefix string) string {
	if len(prefix) < 2 {
		prefix = "XX"
	}
	prefix = strings.ToUpper(prefix[:2])
	code := g.Generate()
	return prefix + code[2:]
}

// TicketNumberGenerator generates ticket numbers
type TicketNumberGenerator struct {
	bookingCodeGenerator *BookingCodeGenerator
}

// NewTicketNumberGenerator creates a new TicketNumberGenerator
func NewTicketNumberGenerator() *TicketNumberGenerator {
	return &TicketNumberGenerator{
		bookingCodeGenerator: NewBookingCodeGenerator(),
	}
}

// Generate generates a 13-digit ticket number
func (g *TicketNumberGenerator) Generate(bookingCode string) string {
	// Standard e-ticket format: 3-digit airline code + 10-digit serial
	// We'll use the booking code to derive some digits for consistency
	airlineCode := "000"
	if len(bookingCode) >= 2 {
		// Convert letters to numbers (A=1, B=2, etc.)
		letters := bookingCode[:2]
		n1 := int(letters[0]-'A') + 1
		n2 := int(letters[1]-'A') + 1
		airlineCode = fmt.Sprintf("%03d", n1*100+n2*10)
	}

	// Generate remaining digits using random
	g.bookingCodeGenerator.seed = time.Now().UnixNano()
	const a = 1103515245
	const c = 12345
	const m = 1 << 31

	serial := make([]byte, 10)
	for i := 0; i < 10; i++ {
		g.bookingCodeGenerator.seed = (a*g.bookingCodeGenerator.seed + c) % m
		serial[i] = byte(int(g.bookingCodeGenerator.seed) % 10)
	}

	return airlineCode + string(serial)
}

// GenerateUUID generates a new UUID for entities
func GenerateUUID() uuid.UUID {
	return uuid.New()
}

// DefaultPaymentDeadline returns the default payment deadline (30 minutes from now)
func DefaultPaymentDeadline() time.Time {
	return time.Now().Add(30 * time.Minute)
}

// PaymentDeadlineForAgent returns the payment deadline for agent bookings (2 hours from now)
func PaymentDeadlineForAgent() time.Time {
	return time.Now().Add(2 * time.Hour)
}
