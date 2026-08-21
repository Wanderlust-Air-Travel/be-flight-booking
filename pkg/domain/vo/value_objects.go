package vo

import (
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

var (
	ErrInvalidCurrency       = errors.New("invalid currency: must be 3 uppercase letters")
	ErrCurrencyMismatch      = errors.New("currency mismatch")
	ErrZeroDenominator       = errors.New("denominator cannot be zero")
	ErrNegativeAmount        = errors.New("amount cannot be negative")
	ErrInvalidIATACode       = errors.New("invalid IATA code: must be 3 uppercase letters")
	ErrInvalidBookingCode    = errors.New("invalid booking code: must be 6 alphanumeric characters")
	ErrInvalidFlightNumber   = errors.New("invalid flight number")
	ErrInvalidTicketNumber  = errors.New("invalid ticket number: must be 13 digits")
	ErrInvalidSeatPosition   = errors.New("invalid seat position")
)

// Money represents a monetary value with currency
type Money struct {
	amount   int64
	currency string
}

// NewMoney creates a new Money value object with validation
func NewMoney(amount int64, currency string) (*Money, error) {
	if len(currency) != 3 {
		return nil, ErrInvalidCurrency
	}
	upperCurrency := strings.ToUpper(currency)
	for _, c := range upperCurrency {
		if c < 'A' || c > 'Z' {
			return nil, ErrInvalidCurrency
		}
	}
	return &Money{
		amount:   amount,
		currency: upperCurrency,
	}, nil
}

// NewMoneyVND creates a new Money value object in Vietnamese Dong
func NewMoneyVND(amount int64) *Money {
	return &Money{
		amount:   amount,
		currency: "VND",
	}
}

// NewMoneyUSD creates a new Money value object in US Dollars
func NewMoneyUSD(amount int64) *Money {
	return &Money{
		amount:   amount,
		currency: "USD",
	}
}

// Amount returns the monetary amount
func (m *Money) Amount() int64 {
	return m.amount
}

// Currency returns the currency code
func (m *Money) Currency() string {
	return m.currency
}

// IsZero returns true if the amount is zero
func (m *Money) IsZero() bool {
	return m.amount == 0
}

// IsNegative returns true if the amount is negative
func (m *Money) IsNegative() bool {
	return m.amount < 0
}

// String returns a human-readable string representation
func (m *Money) String() string {
	return fmt.Sprintf("%d %s", m.amount, m.currency)
}

// Equals returns true if the two Money objects are equal by value
func (m *Money) Equals(other *Money) bool {
	if other == nil {
		return false
	}
	return m.amount == other.amount && m.currency == other.currency
}

// Add adds another Money to this one and returns a new Money
func (m *Money) Add(other *Money) (*Money, error) {
	if other == nil {
		return nil, errors.New("cannot add nil Money")
	}
	if m.currency != other.currency {
		return nil, ErrCurrencyMismatch
	}
	return &Money{
		amount:   m.amount + other.amount,
		currency: m.currency,
	}, nil
}

// Sub subtracts another Money from this one and returns a new Money
func (m *Money) Sub(other *Money) (*Money, error) {
	if other == nil {
		return nil, errors.New("cannot subtract nil Money")
	}
	if m.currency != other.currency {
		return nil, ErrCurrencyMismatch
	}
	result := m.amount - other.amount
	return &Money{
		amount:   result,
		currency: m.currency,
	}, nil
}

// Mul multiplies the Money by a factor and returns a new Money
func (m *Money) Mul(factor float64) *Money {
	return &Money{
		amount:   int64(float64(m.amount) * factor),
		currency: m.currency,
	}
}

// Div divides the Money by a divisor and returns a new Money
func (m *Money) Div(divisor float64) (*Money, error) {
	if divisor == 0 {
		return nil, ErrZeroDenominator
	}
	return &Money{
		amount:   int64(float64(m.amount) / divisor),
		currency: m.currency,
	}, nil
}

// IATACode represents a validated IATA airport or airline code
type IATACode struct {
	code string
}

// NewIATACode creates a new IATACode value object with validation
func NewIATACode(code string) (*IATACode, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 3 {
		return nil, ErrInvalidIATACode
	}
	for _, c := range code {
		if c < 'A' || c > 'Z' {
			return nil, ErrInvalidIATACode
		}
	}
	return &IATACode{code: code}, nil
}

// String returns the IATA code as a string
func (i *IATACode) String() string {
	return i.code
}

// IsValid returns true if the IATA code is valid
func (i *IATACode) IsValid() bool {
	return i != nil && len(i.code) == 3
}

// Equals returns true if the two IATACode objects are equal by value
func (i *IATACode) Equals(other *IATACode) bool {
	if other == nil {
		return false
	}
	return i.code == other.code
}

// BookingCode represents a validated booking (PNR) code
type BookingCode struct {
	code string
}

// NewBookingCode creates a new BookingCode value object with validation
func NewBookingCode(code string) (*BookingCode, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 6 {
		return nil, ErrInvalidBookingCode
	}
	matched, _ := regexp.MatchString("^[A-Z0-9]{6}$", code)
	if !matched {
		return nil, ErrInvalidBookingCode
	}
	return &BookingCode{code: code}, nil
}

// String returns the booking code as a string
func (b *BookingCode) String() string {
	return b.code
}

// IsValid returns true if the booking code is valid
func (b *BookingCode) IsValid() bool {
	return b != nil && len(b.code) == 6
}

// FlightNumber represents a flight number with airline prefix
type FlightNumber struct {
	airlinePrefix string
	number        int
	fullString    string
}

// NewFlightNumber creates a new FlightNumber value object
func NewFlightNumber(full string) (*FlightNumber, error) {
	full = strings.ToUpper(strings.TrimSpace(full))
	if len(full) < 3 {
		return nil, ErrInvalidFlightNumber
	}
	
	// Extract airline prefix (2-3 letters)
	var prefix string
	var numberStr string
	for i, c := range full {
		if unicode.IsLetter(c) {
			prefix += string(c)
		} else if unicode.IsDigit(c) {
			numberStr = full[i:]
			break
		}
	}
	
	if len(prefix) < 2 || len(prefix) > 3 {
		return nil, ErrInvalidFlightNumber
	}
	
	if numberStr == "" {
		return nil, ErrInvalidFlightNumber
	}
	
	number, err := strconv.Atoi(numberStr)
	if err != nil {
		return nil, ErrInvalidFlightNumber
	}
	
	return &FlightNumber{
		airlinePrefix: prefix,
		number:        number,
		fullString:    full,
	}, nil
}

// String returns the full flight number as a string
func (f *FlightNumber) String() string {
	return f.fullString
}

// AirlinePrefix returns the airline prefix
func (f *FlightNumber) AirlinePrefix() string {
	return f.airlinePrefix
}

// Number returns the flight number
func (f *FlightNumber) Number() int {
	return f.number
}

// IsValid returns true if the flight number is valid
func (f *FlightNumber) IsValid() bool {
	return f != nil && f.airlinePrefix != "" && f.number > 0
}

// TicketNumber represents a ticket number (e-ticket)
type TicketNumber struct {
	number string
}

// NewTicketNumber creates a new TicketNumber value object with validation
func NewTicketNumber(number string) (*TicketNumber, error) {
	number = strings.TrimSpace(number)
	if len(number) != 13 {
		return nil, ErrInvalidTicketNumber
	}
	matched, _ := regexp.MatchString("^[0-9]{13}$", number)
	if !matched {
		return nil, ErrInvalidTicketNumber
	}
	return &TicketNumber{number: number}, nil
}

// String returns the ticket number as a string
func (t *TicketNumber) String() string {
	return t.number
}

// IsValid returns true if the ticket number is valid
func (t *TicketNumber) IsValid() bool {
	return t != nil && len(t.number) == 13
}

// SeatPosition represents a seat position on an aircraft
type SeatPosition struct {
	Row    int
	Column string
}

// String returns the seat position as a string (e.g., "12A")
func (s *SeatPosition) String() string {
	return fmt.Sprintf("%d%s", s.Row, s.Column)
}

// ParseSeatPosition parses a seat position string into Row and Column
func ParseSeatPosition(position string) (*SeatPosition, error) {
	position = strings.ToUpper(strings.TrimSpace(position))
	if position == "" {
		return nil, ErrInvalidSeatPosition
	}
	
	var rowStr, colStr string
	for i, c := range position {
		if unicode.IsDigit(c) {
			rowStr += string(c)
		} else if unicode.IsLetter(c) {
			colStr = position[i:]
			break
		}
	}
	
	if rowStr == "" || colStr == "" {
		return nil, ErrInvalidSeatPosition
	}
	
	row, err := strconv.Atoi(rowStr)
	if err != nil || row < 1 {
		return nil, ErrInvalidSeatPosition
	}
	
	return &SeatPosition{
		Row:    row,
		Column: colStr,
	}, nil
}

// PriceBreakdown represents a detailed price breakdown for a booking
type PriceBreakdown struct {
	BaseFare       *Money `json:"base_fare"`
	FuelSurcharge  *Money `json:"fuel_surcharge"`
	AirportTax     *Money `json:"airport_tax"`
	ServiceFee     *Money `json:"service_fee"`
	Subtotal       *Money `json:"subtotal"`
	Discount       *Money `json:"discount"`
	Total          *Money `json:"total"`
}

// NewPriceBreakdown creates a new PriceBreakdown with the given values
func NewPriceBreakdown(baseFare, fuelSurcharge, airportTax, serviceFee, subtotal, discount, total *Money) *PriceBreakdown {
	return &PriceBreakdown{
		BaseFare:       baseFare,
		FuelSurcharge:  fuelSurcharge,
		AirportTax:     airportTax,
		ServiceFee:     serviceFee,
		Subtotal:       subtotal,
		Discount:       discount,
		Total:          total,
	}
}

// EmptyPriceBreakdown returns a PriceBreakdown with zero values
func EmptyPriceBreakdown() *PriceBreakdown {
	zero := NewMoneyVND(0)
	return &PriceBreakdown{
		BaseFare:       zero,
		FuelSurcharge:  zero,
		AirportTax:     zero,
		ServiceFee:     zero,
		Subtotal:       zero,
		Discount:       zero,
		Total:          zero,
	}
}

// TotalVND returns the total amount in VND (convenience method)
func (p *PriceBreakdown) TotalVND() int64 {
	if p.Total == nil {
		return 0
	}
	return p.Total.Amount()
}

// Duration represents a time duration
type Duration struct {
	minutes int
}

// NewDuration creates a new Duration from minutes
func NewDuration(minutes int) *Duration {
	return &Duration{minutes: minutes}
}

// Hours returns the duration in hours
func (d *Duration) Hours() int {
	return d.minutes / 60
}

// Minutes returns the total duration in minutes
func (d *Duration) Minutes() int {
	return d.minutes
}

// String returns a human-readable duration string
func (d *Duration) String() string {
	hours := d.minutes / 60
	mins := d.minutes % 60
	if hours > 0 && mins > 0 {
		return fmt.Sprintf("%dh %dm", hours, mins)
	} else if hours > 0 {
		return fmt.Sprintf("%dh", hours)
	}
	return fmt.Sprintf("%dm", mins)
}

// ToTimeDuration converts to standard time.Duration
func (d *Duration) ToTimeDuration() time.Duration {
	return time.Duration(d.minutes) * time.Minute
}

// Email represents a validated email address
type Email struct {
	value string
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

// NewEmail creates a new Email value object with validation
func NewEmail(value string) (*Email, error) {
	value = strings.TrimSpace(strings.ToLower(value))
	if !emailRegex.MatchString(value) {
		return nil, errors.New("invalid email format")
	}
	return &Email{value: value}, nil
}

// String returns the email address as a string
func (e *Email) String() string {
	return e.value
}

// IsValid returns true if the email is valid
func (e *Email) IsValid() bool {
	return e != nil && emailRegex.MatchString(e.value)
}

// PhoneNumber represents a validated phone number
type PhoneNumber struct {
	value       string
	countryCode string
}

// NewPhoneNumber creates a new PhoneNumber value object
func NewPhoneNumber(number, countryCode string) (*PhoneNumber, error) {
	number = strings.TrimSpace(number)
	countryCode = strings.TrimSpace(countryCode)
	
	// Basic validation: number should have digits and optional +
	if len(number) < 8 || len(number) > 15 {
		return nil, errors.New("invalid phone number length")
	}
	
	matched, _ := regexp.MatchString(`^\+?[0-9]{8,14}$`, number)
	if !matched {
		return nil, errors.New("invalid phone number format")
	}
	
	return &PhoneNumber{
		value:       number,
		countryCode: countryCode,
	}, nil
}

// String returns the phone number as a string
func (p *PhoneNumber) String() string {
	if p.countryCode != "" {
		return p.countryCode + p.value
	}
	return p.value
}

// IsValid returns true if the phone number is valid
func (p *PhoneNumber) IsValid() bool {
	return p != nil && p.value != ""
}

// PassportNumber represents a passport number
type PassportNumber struct {
	value        string
	countryCode string
}

// NewPassportNumber creates a new PassportNumber value object
func NewPassportNumber(number, countryCode string) (*PassportNumber, error) {
	number = strings.ToUpper(strings.TrimSpace(number))
	if len(number) < 6 || len(number) > 12 {
		return nil, errors.New("invalid passport number length")
	}
	
	return &PassportNumber{
		value:        number,
		countryCode: strings.ToUpper(countryCode),
	}, nil
}

// String returns the passport number as a string
func (p *PassportNumber) String() string {
	return p.value
}

// IsValid returns true if the passport number is valid
func (p *PassportNumber) IsValid() bool {
	return p != nil && p.value != ""
}

// DateRange represents a range of dates
type DateRange struct {
	Start time.Time
	End   time.Time
}

// NewDateRange creates a new DateRange value object
func NewDateRange(start, end time.Time) *DateRange {
	return &DateRange{
		Start: start,
		End:   end,
	}
}

// Contains returns true if the given date is within the range
func (d *DateRange) Contains(date time.Time) bool {
	return (date.Equal(d.Start) || date.After(d.Start)) && (date.Equal(d.End) || date.Before(d.End))
}

// DurationDays returns the duration in days
func (d *DateRange) DurationDays() int {
	return int(d.End.Sub(d.Start).Hours() / 24)
}

// Coordinates represents geographic coordinates
type Coordinates struct {
	Latitude  float64
	Longitude float64
}

// NewCoordinates creates a new Coordinates value object
func NewCoordinates(lat, lon float64) (*Coordinates, error) {
	if lat < -90 || lat > 90 {
		return nil, errors.New("latitude must be between -90 and 90")
	}
	if lon < -180 || lon > 180 {
		return nil, errors.New("longitude must be between -180 and 180")
	}
	return &Coordinates{
		Latitude:  lat,
		Longitude: lon,
	}, nil
}

// String returns coordinates as a string
func (c *Coordinates) String() string {
	return fmt.Sprintf("%.6f, %.6f", c.Latitude, c.Longitude)
}

// DistanceKm calculates the distance to another coordinate in kilometers using Haversine formula
func (c *Coordinates) DistanceKm(other *Coordinates) float64 {
	const earthRadiusKm = 6371.0
	
	lat1Rad := c.Latitude * math.Pi / 180
	lat2Rad := other.Latitude * math.Pi / 180
	deltaLat := (other.Latitude - c.Latitude) * math.Pi / 180
	deltaLon := (other.Longitude - c.Longitude) * math.Pi / 180
	
	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) + math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	cVal := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	
	return earthRadiusKm * cVal
}
