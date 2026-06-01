package entities

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidBookingStatus   = errors.New("invalid booking status")
	ErrInvalidTransition     = errors.New("invalid status transition")
	ErrExpiredBooking        = errors.New("booking has expired")
	ErrNonCancellableStatus  = errors.New("booking cannot be cancelled in current status")
	ErrInvalidPassengerType  = errors.New("invalid passenger type")
	ErrInvalidGender         = errors.New("invalid gender")
	ErrMissingAdultPassenger = errors.New("at least one adult passenger is required")
	ErrInvalidEmail          = errors.New("invalid email format")
	ErrInvalidDateOfBirth    = errors.New("invalid date of birth")
	ErrPassportExpired       = errors.New("passport has expired")
	ErrNoInfantWithAdult     = errors.New("infant must be accompanied by adult")
	ErrPaymentNotCompleted   = errors.New("payment not completed")
)

// BookingStatus represents the status of a booking
type BookingStatus string

const (
	BookingPending      BookingStatus = "PENDING"
	BookingConfirmed    BookingStatus = "CONFIRMED"
	BookingPaymentPending BookingStatus = "PAYMENT_PENDING"
	BookingPaymentFailed BookingStatus = "PAYMENT_FAILED"
	BookingTicketed     BookingStatus = "TICKETED"
	BookingCancelled    BookingStatus = "CANCELLED"
	BookingRefunded     BookingStatus = "REFUNDED"
	BookingVoided       BookingStatus = "VOIDED"
)

// CanTransitionTo checks if the booking can transition to the target status
func (s BookingStatus) CanTransitionTo(target BookingStatus) bool {
	validTransitions := map[BookingStatus][]BookingStatus{
		BookingPending:         {BookingPaymentPending, BookingConfirmed, BookingCancelled, BookingVoided},
		BookingPaymentPending:   {BookingConfirmed, BookingPaymentFailed, BookingCancelled, BookingVoided},
		BookingPaymentFailed:    {BookingPaymentPending, BookingCancelled, BookingVoided},
		BookingConfirmed:        {BookingTicketed, BookingCancelled, BookingRefunded},
		BookingTicketed:         {BookingCancelled, BookingRefunded},
		BookingCancelled:        {BookingRefunded},
		BookingRefunded:         {},
		BookingVoided:           {},
	}

	allowed, exists := validTransitions[s]
	if !exists {
		return false
	}

	for _, status := range allowed {
		if status == target {
			return true
		}
	}
	return false
}

// PassengerType represents the type of passenger
type PassengerType string

const (
	PassengerAdult   PassengerType = "ADULT"
	PassengerChild   PassengerType = "CHILD"
	PassengerInfant  PassengerType = "INFANT"
)

// IsAdult returns true if the passenger type is adult
func (t PassengerType) IsAdult() bool {
	return t == PassengerAdult
}

// IsChild returns true if the passenger type is child
func (t PassengerType) IsChild() bool {
	return t == PassengerChild
}

// IsInfant returns true if the passenger type is infant
func (t PassengerType) IsInfant() bool {
	return t == PassengerInfant
}

// MaxAgeChild is the maximum age for a child passenger in years
const MaxAgeChild = 11

// MaxAgeInfant is the maximum age for an infant passenger in years
const MaxAgeInfant = 2

// Gender represents the gender of a passenger
type Gender string

const (
	GenderMale   Gender = "MALE"
	GenderFemale Gender = "FEMALE"
	GenderOther  Gender = "OTHER"
)

// Passenger represents a passenger in a booking
type Passenger struct {
	ID              uuid.UUID      `json:"id" db:"id"`
	BookingID       uuid.UUID      `json:"booking_id" db:"booking_id"`
	Title           string         `json:"title" db:"title"`
	FirstName       string         `json:"first_name" db:"first_name"`
	LastName        string         `json:"last_name" db:"last_name"`
	Gender          Gender         `json:"gender" db:"gender"`
	DateOfBirth     time.Time      `json:"date_of_birth" db:"date_of_birth"`
	Nationality     string         `json:"nationality" db:"nationality"`
	PassportNumber  string         `json:"passport_number" db:"passport_number"`
	PassportExpiry  *time.Time     `json:"passport_expiry,omitempty" db:"passport_expiry"`
	Email           string         `json:"email" db:"email"`
	Phone           string         `json:"phone" db:"phone"`
	Type            PassengerType  `json:"type" db:"type"`
	CreatedAt       time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at" db:"updated_at"`
}

// Age calculates and returns the passenger's age in years
func (p *Passenger) Age() int {
	now := time.Now()
	age := now.Year() - p.DateOfBirth.Year()
	if now.YearDay() < p.DateOfBirth.YearDay() {
		age--
	}
	return age
}

// IsAdult returns true if the passenger is an adult based on age
func (p *Passenger) IsAdult() bool {
	return p.Age() >= MaxAgeChild
}

// IsChild returns true if the passenger is a child based on age
func (p *Passenger) IsChild() bool {
	age := p.Age()
	return age >= MaxAgeInfant && age < MaxAgeChild
}

// IsInfant returns true if the passenger is an infant based on age
func (p *Passenger) IsInfant() bool {
	return p.Age() < MaxAgeInfant
}

// FullName returns the passenger's full name
func (p *Passenger) FullName() string {
	return p.FirstName + " " + p.LastName
}

// IsPassportValid returns true if the passport is valid (not expired)
func (p *Passenger) IsPassportValid() bool {
	if p.PassportExpiry == nil {
		return true
	}
	return time.Now().Before(*p.PassportExpiry)
}

// Booking represents a flight booking
type Booking struct {
	ID              uuid.UUID      `json:"id" db:"id"`
	BookingCode     string         `json:"booking_code" db:"booking_code"`
	UserID          *uuid.UUID     `json:"user_id,omitempty" db:"user_id"`
	ContactEmail    string         `json:"contact_email" db:"contact_email"`
	ContactPhone    string         `json:"contact_phone" db:"contact_phone"`
	ContactName     string         `json:"contact_name" db:"contact_name"`
	Status          BookingStatus  `json:"status" db:"status"`
	TotalAmountVND  int64          `json:"total_amount_vnd" db:"total_amount_vnd"`
	Currency        string         `json:"currency" db:"currency"`
	PaymentDeadline *time.Time     `json:"payment_deadline,omitempty" db:"payment_deadline"`
	PaymentMethod   string         `json:"payment_method" db:"payment_method"`
	TicketedAt      *time.Time     `json:"ticketed_at,omitempty" db:"ticketed_at"`
	CancelledAt     *time.Time     `json:"cancelled_at,omitempty" db:"cancelled_at"`
	CancelledBy     string         `json:"cancelled_by" db:"cancelled_by"`
	CancelReason    string         `json:"cancel_reason" db:"cancel_reason"`
	AgentID         *uuid.UUID     `json:"agent_id,omitempty" db:"agent_id"`
	IPAddress       string         `json:"ip_address" db:"ip_address"`
	UserAgent       string         `json:"user_agent" db:"user_agent"`
	CreatedAt       time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at" db:"updated_at"`
}

// IsExpired returns true if the booking has expired (payment deadline passed)
func (b *Booking) IsExpired() bool {
	if b.PaymentDeadline == nil {
		return false
	}
	return time.Now().After(*b.PaymentDeadline)
}

// IsCancellable returns true if the booking can be cancelled
func (b *Booking) IsCancellable() bool {
	return b.Status == BookingPending || b.Status == BookingPaymentPending || b.Status == BookingPaymentFailed || b.Status == BookingConfirmed
}

// CanCancel returns true if the booking can be cancelled and sets the reason
func (b *Booking) CanCancel() (bool, string) {
	if !b.IsCancellable() {
		return false, ErrNonCancellableStatus.Error()
	}
	if b.Status == BookingTicketed {
		return false, "ticketed bookings cannot be cancelled directly"
	}
	return true, ""
}

// BookingPassenger links a Booking to a Passenger with seat assignment
type BookingPassenger struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	BookingID     uuid.UUID  `json:"booking_id" db:"booking_id"`
	PassengerID   uuid.UUID  `json:"passenger_id" db:"passenger_id"`
	SeatID        *uuid.UUID `json:"seat_id,omitempty" db:"seat_id"`
	TicketNumber  string     `json:"ticket_number" db:"ticket_number"`
	FareVND       int64      `json:"fare_vnd" db:"fare_vnd"`
	TaxVND        int64      `json:"tax_vnd" db:"tax_vnd"`
	InsuranceVND  int64      `json:"insurance_vnd" db:"insurance_vnd"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// BookingFlight links a Booking to a FlightInstance with leg order for connecting flights
type BookingFlight struct {
	ID              uuid.UUID `json:"id" db:"id"`
	BookingID       uuid.UUID `json:"booking_id" db:"booking_id"`
	FlightInstanceID uuid.UUID `json:"flight_instance_id" db:"flight_instance_id"`
	LegOrder        int       `json:"leg_order" db:"leg_order"`
	FareVND         int64     `json:"fare_vnd" db:"fare_vnd"`
	TaxVND          int64     `json:"tax_vnd" db:"tax_vnd"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentPending    PaymentStatus = "PENDING"
	PaymentProcessing PaymentStatus = "PROCESSING"
	PaymentCompleted PaymentStatus = "COMPLETED"
	PaymentFailed    PaymentStatus = "FAILED"
	PaymentRefunded  PaymentStatus = "REFUNDED"
	PaymentCancelled PaymentStatus = "CANCELLED"
)

// PaymentProvider represents the payment provider
type PaymentProvider string

const (
	ProviderMock   PaymentProvider = "MOCK"
	ProviderStripe PaymentProvider = "STRIPE"
	ProviderVNPay  PaymentProvider = "VNPAY"
	ProviderPayPal PaymentProvider = "PAYPAL"
)

// Payment represents a payment transaction
type Payment struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	BookingID       uuid.UUID       `json:"booking_id" db:"booking_id"`
	AmountVND       int64           `json:"amount_vnd" db:"amount_vnd"`
	Currency        string          `json:"currency" db:"currency"`
	Status          PaymentStatus   `json:"status" db:"status"`
	Provider        PaymentProvider  `json:"provider" db:"provider"`
	ProviderTxnID   string          `json:"provider_txn_id" db:"provider_txn_id"`
	ProviderRefID   string          `json:"provider_ref_id" db:"provider_ref_id"`
	PaymentMethod   string          `json:"payment_method" db:"payment_method"`
	PaymentURL      string          `json:"payment_url" db:"payment_url"`
	ReturnURL       string          `json:"return_url" db:"return_url"`
	CallbackData    string          `json:"callback_data" db:"callback_data"`
	FailureReason   string          `json:"failure_reason" db:"failure_reason"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty" db:"completed_at"`
	ExpiresAt       *time.Time      `json:"expires_at,omitempty" db:"expires_at"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

// IsCompleted returns true if the payment is successfully completed
func (p *Payment) IsCompleted() bool {
	return p.Status == PaymentCompleted
}

// IsFailed returns true if the payment has failed
func (p *Payment) IsFailed() bool {
	return p.Status == PaymentFailed || p.Status == PaymentCancelled
}

// UserRole represents the role of a user
type UserRole string

const (
	RoleAdmin    UserRole = "ADMIN"
	RoleAgent    UserRole = "AGENT"
	RoleCustomer UserRole = "CUSTOMER"
)

// User represents a user in the system
type User struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	Email             string     `json:"email" db:"email"`
	PasswordHash      string     `json:"-" db:"password_hash"`
	FirstName         string     `json:"first_name" db:"first_name"`
	LastName          string     `json:"last_name" db:"last_name"`
	Role              UserRole   `json:"role" db:"role"`
	Phone             string     `json:"phone" db:"phone"`
	DateOfBirth       *time.Time `json:"date_of_birth,omitempty" db:"date_of_birth"`
	Nationality       string     `json:"nationality" db:"nationality"`
	PassportNumber    string     `json:"passport_number" db:"passport_number"`
	AvatarURL         string     `json:"avatar_url" db:"avatar_url"`
	IsEmailVerified   bool       `json:"is_email_verified" db:"is_email_verified"`
	IsPhoneVerified   bool       `json:"is_phone_verified" db:"is_phone_verified"`
	IsActive          bool       `json:"is_active" db:"is_active"`
	LastLoginAt       *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	FailedLoginCount  int        `json:"failed_login_count" db:"failed_login_count"`
	LockedUntil       *time.Time `json:"locked_until,omitempty" db:"locked_until"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`
}

// IsAdmin returns true if the user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// IsAgent returns true if the user has agent role
func (u *User) IsAgent() bool {
	return u.Role == RoleAgent
}

// IsCustomer returns true if the user has customer role
func (u *User) IsCustomer() bool {
	return u.Role == RoleCustomer
}

// FullName returns the user's full name
func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationBookingConfirmation NotificationType = "BOOKING_CONFIRMATION"
	NotificationBookingCancellation NotificationType = "BOOKING_CANCELLATION"
	NotificationPaymentReminder    NotificationType = "PAYMENT_REMINDER"
	NotificationPaymentSuccess     NotificationType = "PAYMENT_SUCCESS"
	NotificationPaymentFailed      NotificationType = "PAYMENT_FAILED"
	NotificationTicketIssued       NotificationType = "TICKET_ISSUED"
	NotificationFlightUpdate       NotificationType = "FLIGHT_UPDATE"
	NotificationCheckInReminder    NotificationType = "CHECK_IN_REMINDER"
)

// NotificationChannel represents the channel for notification delivery
type NotificationChannel string

const (
	ChannelEmail NotificationChannel = "EMAIL"
	ChannelSMS   NotificationChannel = "SMS"
	ChannelPush  NotificationChannel = "PUSH"
	ChannelInApp NotificationChannel = "IN_APP"
)

// NotificationStatus represents the status of a notification
type NotificationStatus string

const (
	NotificationPending  NotificationStatus = "PENDING"
	NotificationSent     NotificationStatus = "SENT"
	NotificationFailed   NotificationStatus = "FAILED"
	NotificationRead     NotificationStatus = "READ"
)

// Notification represents a notification to a user
type Notification struct {
	ID          uuid.UUID           `json:"id" db:"id"`
	UserID      uuid.UUID           `json:"user_id" db:"user_id"`
	BookingID   *uuid.UUID          `json:"booking_id,omitempty" db:"booking_id"`
	Type        NotificationType   `json:"type" db:"type"`
	Channel     NotificationChannel `json:"channel" db:"channel"`
	Status      NotificationStatus  `json:"status" db:"status"`
	Title       string              `json:"title" db:"title"`
	Content     string              `json:"content" db:"content"`
	Metadata    string              `json:"metadata" db:"metadata"`
	SentAt      *time.Time          `json:"sent_at,omitempty" db:"sent_at"`
	ReadAt      *time.Time          `json:"read_at,omitempty" db:"read_at"`
	RetryCount  int                 `json:"retry_count" db:"retry_count"`
	CreatedAt   time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at" db:"updated_at"`
}

// AuditAction represents the action performed in an audit log
type AuditAction string

const (
	AuditCreate AuditAction = "CREATE"
	AuditUpdate AuditAction = "UPDATE"
	AuditDelete AuditAction = "DELETE"
	AuditLogin  AuditAction = "LOGIN"
	AuditLogout AuditAction = "LOGOUT"
)

// EntityType represents the type of entity being audited
type EntityType string

const (
	EntityBooking   EntityType = "BOOKING"
	EntityPayment   EntityType = "PAYMENT"
	EntityPassenger EntityType = "PASSENGER"
	EntityUser      EntityType = "USER"
	EntityFlight    EntityType = "FLIGHT"
)

// AuditLog represents an audit log entry
type AuditLog struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	EntityType  EntityType  `json:"entity_type" db:"entity_type"`
	EntityID    uuid.UUID   `json:"entity_id" db:"entity_id"`
	Action      AuditAction `json:"action" db:"action"`
	ActorID     *uuid.UUID `json:"actor_id,omitempty" db:"actor_id"`
	Changes     string      `json:"changes" db:"changes"`
	IPAddress   string      `json:"ip_address" db:"ip_address"`
	UserAgent   string      `json:"user_agent" db:"user_agent"`
	Description string      `json:"description" db:"description"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
}
