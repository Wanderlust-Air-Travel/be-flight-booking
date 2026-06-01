package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// EventType represents the type of domain event
type EventType string

const (
	EventFlightSearched      EventType = "FLIGHT_SEARCHED"
	EventBookingCreated      EventType = "BOOKING_CREATED"
	EventBookingConfirmed    EventType = "BOOKING_CONFIRMED"
	EventBookingCancelled    EventType = "BOOKING_CANCELLED"
	EventPaymentCompleted    EventType = "PAYMENT_COMPLETED"
	EventPaymentFailed       EventType = "PAYMENT_FAILED"
	EventTicketIssued        EventType = "TICKET_ISSUED"
	EventNotificationSent    EventType = "NOTIFICATION_SENT"
	EventSeatLocked          EventType = "SEAT_LOCKED"
	EventFlightStatusChanged EventType = "FLIGHT_STATUS_CHANGED"
)

// Event is the interface that all domain events must implement
type Event interface {
	Type() EventType
	OccurredAt() time.Time
	AggregateID() uuid.UUID
	ToJSON() (string, error)
}

// BaseEvent provides common fields for all events
type BaseEvent struct {
	ID          uuid.UUID `json:"id"`
	OccurredAt  time.Time `json:"occurred_at"`
	AggregateID uuid.UUID `json:"aggregate_id"`
}

// NewBaseEvent creates a new BaseEvent with generated ID and current timestamp
func NewBaseEvent(aggregateID uuid.UUID) BaseEvent {
	return BaseEvent{
		ID:          uuid.New(),
		OccurredAt:  time.Now().UTC(),
		AggregateID: aggregateID,
	}
}

// FlightSearched represents a flight search event
type FlightSearched struct {
	BaseEvent
	SearchID         uuid.UUID `json:"search_id"`
	Origin           string    `json:"origin"`
	Destination      string    `json:"destination"`
	DepartureDate    string    `json:"departure_date"`
	PassengerCount   int       `json:"passenger_count"`
	CabinClass       string    `json:"cabin_class"`
	ResultCount      int        `json:"result_count"`
	MinPriceVND      int64      `json:"min_price_vnd"`
	MaxPriceVND      int64      `json:"max_price_vnd"`
	DurationMs       int64      `json:"duration_ms"`
}

// NewFlightSearched creates a new FlightSearched event
func NewFlightSearched(
	searchID uuid.UUID,
	origin,
	destination,
	departureDate string,
	passengerCount int,
	cabinClass string,
	resultCount int,
	minPriceVND,
	maxPriceVND int64,
	durationMs int64,
) *FlightSearched {
	return &FlightSearched{
		BaseEvent:     NewBaseEvent(searchID),
		SearchID:      searchID,
		Origin:        origin,
		Destination:   destination,
		DepartureDate: departureDate,
		PassengerCount: passengerCount,
		CabinClass:    cabinClass,
		ResultCount:   resultCount,
		MinPriceVND:   minPriceVND,
		MaxPriceVND:   maxPriceVND,
		DurationMs:    durationMs,
	}
}

// Type returns the event type
func (e *FlightSearched) Type() EventType {
	return EventFlightSearched
}

// OccurredAt returns when the event occurred
func (e *FlightSearched) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *FlightSearched) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *FlightSearched) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal FlightSearched event: %w", err)
	}
	return string(data), nil
}

// BookingCreated represents a booking creation event
type BookingCreated struct {
	BaseEvent
	BookingCode     string    `json:"booking_code"`
	UserID          uuid.UUID `json:"user_id"`
	TotalAmountVND int64     `json:"total_amount_vnd"`
	PassengerCount  int        `json:"passenger_count"`
	FlightCount     int        `json:"flight_count"`
	ContactEmail    string     `json:"contact_email"`
	PaymentDeadline time.Time  `json:"payment_deadline"`
}

// NewBookingCreated creates a new BookingCreated event
func NewBookingCreated(
	bookingID uuid.UUID,
	bookingCode string,
	userID uuid.UUID,
	totalAmountVND int64,
	passengerCount,
	flightCount int,
	contactEmail string,
	paymentDeadline time.Time,
) *BookingCreated {
	return &BookingCreated{
		BaseEvent:       NewBaseEvent(bookingID),
		BookingCode:     bookingCode,
		UserID:          userID,
		TotalAmountVND: totalAmountVND,
		PassengerCount:  passengerCount,
		FlightCount:    flightCount,
		ContactEmail:   contactEmail,
		PaymentDeadline: paymentDeadline,
	}
}

// Type returns the event type
func (e *BookingCreated) Type() EventType {
	return EventBookingCreated
}

// OccurredAt returns when the event occurred
func (e *BookingCreated) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *BookingCreated) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *BookingCreated) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal BookingCreated event: %w", err)
	}
	return string(data), nil
}

// BookingConfirmed represents a booking confirmation event
type BookingConfirmed struct {
	BaseEvent
	BookingCode string `json:"booking_code"`
}

// NewBookingConfirmed creates a new BookingConfirmed event
func NewBookingConfirmed(bookingID uuid.UUID, bookingCode string) *BookingConfirmed {
	return &BookingConfirmed{
		BaseEvent:    NewBaseEvent(bookingID),
		BookingCode: bookingCode,
	}
}

// Type returns the event type
func (e *BookingConfirmed) Type() EventType {
	return EventBookingConfirmed
}

// OccurredAt returns when the event occurred
func (e *BookingConfirmed) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *BookingConfirmed) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *BookingConfirmed) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal BookingConfirmed event: %w", err)
	}
	return string(data), nil
}

// BookingCancelled represents a booking cancellation event
type BookingCancelled struct {
	BaseEvent
	BookingCode      string `json:"booking_code"`
	CancelledBy     string `json:"cancelled_by"`
	Reason          string `json:"reason"`
	RefundAmountVND int64  `json:"refund_amount_vnd"`
}

// NewBookingCancelled creates a new BookingCancelled event
func NewBookingCancelled(
	bookingID uuid.UUID,
	bookingCode,
	cancelledBy,
	reason string,
	refundAmountVND int64,
) *BookingCancelled {
	return &BookingCancelled{
		BaseEvent:       NewBaseEvent(bookingID),
		BookingCode:    bookingCode,
		CancelledBy:   cancelledBy,
		Reason:        reason,
		RefundAmountVND: refundAmountVND,
	}
}

// Type returns the event type
func (e *BookingCancelled) Type() EventType {
	return EventBookingCancelled
}

// OccurredAt returns when the event occurred
func (e *BookingCancelled) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *BookingCancelled) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *BookingCancelled) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal BookingCancelled event: %w", err)
	}
	return string(data), nil
}

// PaymentCompleted represents a successful payment event
type PaymentCompleted struct {
	BaseEvent
	BookingID       uuid.UUID `json:"booking_id"`
	BookingCode     string    `json:"booking_code"`
	PaymentID       uuid.UUID `json:"payment_id"`
	Provider        string    `json:"provider"`
	ProviderTxnID   string    `json:"provider_txn_id"`
	AmountVND       int64     `json:"amount_vnd"`
}

// NewPaymentCompleted creates a new PaymentCompleted event
func NewPaymentCompleted(
	eventID uuid.UUID,
	bookingID uuid.UUID,
	bookingCode string,
	paymentID uuid.UUID,
	provider,
	providerTxnID string,
	amountVND int64,
) *PaymentCompleted {
	return &PaymentCompleted{
		BaseEvent:     NewBaseEvent(eventID),
		BookingID:    bookingID,
		BookingCode:  bookingCode,
		PaymentID:    paymentID,
		Provider:     provider,
		ProviderTxnID: providerTxnID,
		AmountVND:    amountVND,
	}
}

// Type returns the event type
func (e *PaymentCompleted) Type() EventType {
	return EventPaymentCompleted
}

// OccurredAt returns when the event occurred
func (e *PaymentCompleted) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *PaymentCompleted) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *PaymentCompleted) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal PaymentCompleted event: %w", err)
	}
	return string(data), nil
}

// PaymentFailed represents a failed payment event
type PaymentFailed struct {
	BaseEvent
	BookingID uuid.UUID `json:"booking_id"`
	PaymentID uuid.UUID `json:"payment_id"`
	Reason    string     `json:"reason"`
}

// NewPaymentFailed creates a new PaymentFailed event
func NewPaymentFailed(bookingID, paymentID uuid.UUID, reason string) *PaymentFailed {
	return &PaymentFailed{
		BaseEvent: NewBaseEvent(bookingID),
		BookingID: bookingID,
		PaymentID: paymentID,
		Reason:    reason,
	}
}

// Type returns the event type
func (e *PaymentFailed) Type() EventType {
	return EventPaymentFailed
}

// OccurredAt returns when the event occurred
func (e *PaymentFailed) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *PaymentFailed) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *PaymentFailed) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal PaymentFailed event: %w", err)
	}
	return string(data), nil
}

// TicketIssued represents a ticket issuance event
type TicketIssued struct {
	BaseEvent
	BookingCode    string   `json:"booking_code"`
	TicketNumbers  []string `json:"ticket_numbers"`
	IssuedBy       string   `json:"issued_by"`
}

// NewTicketIssued creates a new TicketIssued event
func NewTicketIssued(bookingID uuid.UUID, bookingCode string, ticketNumbers []string, issuedBy string) *TicketIssued {
	return &TicketIssued{
		BaseEvent:     NewBaseEvent(bookingID),
		BookingCode:  bookingCode,
		TicketNumbers: ticketNumbers,
		IssuedBy:    issuedBy,
	}
}

// Type returns the event type
func (e *TicketIssued) Type() EventType {
	return EventTicketIssued
}

// OccurredAt returns when the event occurred
func (e *TicketIssued) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *TicketIssued) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *TicketIssued) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal TicketIssued event: %w", err)
	}
	return string(data), nil
}

// SeatLocked represents a seat lock event
type SeatLocked struct {
	BaseEvent
	FlightInstanceID uuid.UUID `json:"flight_instance_id"`
	SeatID          uuid.UUID `json:"seat_id"`
	SeatNumber      string    `json:"seat_number"`
	PassengerID     uuid.UUID `json:"passenger_id"`
	LockedBy        string    `json:"locked_by"`
	LockDurationMin int       `json:"lock_duration_min"`
}

// NewSeatLocked creates a new SeatLocked event
func NewSeatLocked(
	eventID,
	flightInstanceID,
	seatID,
	passengerID uuid.UUID,
	seatNumber,
	lockedBy string,
	lockDurationMin int,
) *SeatLocked {
	return &SeatLocked{
		BaseEvent:       NewBaseEvent(eventID),
		FlightInstanceID: flightInstanceID,
		SeatID:         seatID,
		SeatNumber:    seatNumber,
		PassengerID:   passengerID,
		LockedBy:      lockedBy,
		LockDurationMin: lockDurationMin,
	}
}

// Type returns the event type
func (e *SeatLocked) Type() EventType {
	return EventSeatLocked
}

// OccurredAt returns when the event occurred
func (e *SeatLocked) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *SeatLocked) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *SeatLocked) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal SeatLocked event: %w", err)
	}
	return string(data), nil
}

// FlightStatusChanged represents a flight status change event
type FlightStatusChanged struct {
	BaseEvent
	FlightInstanceID uuid.UUID `json:"flight_instance_id"`
	FlightNumber     string    `json:"flight_number"`
	OldStatus        string    `json:"old_status"`
	NewStatus        string    `json:"new_status"`
	Reason           string    `json:"reason"`
	ScheduledDepart  time.Time `json:"scheduled_departure"`
}

// NewFlightStatusChanged creates a new FlightStatusChanged event
func NewFlightStatusChanged(
	eventID,
	flightInstanceID uuid.UUID,
	flightNumber string,
	oldStatus,
	newStatus,
	reason string,
	scheduledDepart time.Time,
) *FlightStatusChanged {
	return &FlightStatusChanged{
		BaseEvent:       NewBaseEvent(eventID),
		FlightInstanceID: flightInstanceID,
		FlightNumber:   flightNumber,
		OldStatus:      oldStatus,
		NewStatus:      newStatus,
		Reason:         reason,
		ScheduledDepart: scheduledDepart,
	}
}

// Type returns the event type
func (e *FlightStatusChanged) Type() EventType {
	return EventFlightStatusChanged
}

// OccurredAt returns when the event occurred
func (e *FlightStatusChanged) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt
}

// AggregateID returns the aggregate ID
func (e *FlightStatusChanged) AggregateID() uuid.UUID {
	return e.BaseEvent.AggregateID
}

// ToJSON serializes the event to JSON
func (e *FlightStatusChanged) ToJSON() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", fmt.Errorf("failed to marshal FlightStatusChanged event: %w", err)
	}
	return string(data), nil
}

// EventHandler is a function type for handling events
type EventHandler func(ctx context.Context, event Event) error

// EventBus defines the interface for publishing and subscribing to events
type EventBus interface {
	Publish(ctx context.Context, event Event) error
	Subscribe(eventType EventType, handler EventHandler) error
	Unsubscribe(eventType EventType, handler EventHandler) error
	Start(ctx context.Context) error
	Stop() error
}

// EventStore defines the interface for storing events
type EventStore interface {
	Save(ctx context.Context, aggregateID uuid.UUID, events []Event) error
	GetByAggregateID(ctx context.Context, aggregateID uuid.UUID) ([]Event, error)
	GetByType(ctx context.Context, eventType EventType, since time.Time) ([]Event, error)
}

// InMemoryEventBus is a simple in-memory implementation of EventBus
type InMemoryEventBus struct {
	handlers    map[EventType][]EventHandler
	subscribers chan struct{}
	running     bool
}

// NewInMemoryEventBus creates a new InMemoryEventBus
func NewInMemoryEventBus() *InMemoryEventBus {
	return &InMemoryEventBus{
		handlers:    make(map[EventType][]EventHandler),
		subscribers: make(chan struct{}),
		running:     false,
	}
}

// Publish publishes an event to all subscribed handlers
func (b *InMemoryEventBus) Publish(ctx context.Context, event Event) error {
	handlers, exists := b.handlers[event.Type()]
	if !exists {
		return nil
	}

	for _, handler := range handlers {
		if err := handler(ctx, event); err != nil {
			return fmt.Errorf("handler error for event %s: %w", event.Type(), err)
		}
	}
	return nil
}

// Subscribe adds a handler for the given event type
func (b *InMemoryEventBus) Subscribe(eventType EventType, handler EventHandler) error {
	b.handlers[eventType] = append(b.handlers[eventType], handler)
	return nil
}

// Unsubscribe removes a handler for the given event type
func (b *InMemoryEventBus) Unsubscribe(eventType EventType, handler EventHandler) error {
	handlers := b.handlers[eventType]
	for i, h := range handlers {
		// Compare function pointers
		if fmt.Sprintf("%p", h) == fmt.Sprintf("%p", handler) {
			b.handlers[eventType] = append(handlers[:i], handlers[i+1:]...)
			return nil
		}
	}
	return nil
}

// Start starts the event bus
func (b *InMemoryEventBus) Start(ctx context.Context) error {
	b.running = true
	return nil
}

// Stop stops the event bus
func (b *InMemoryEventBus) Stop() error {
	b.running = false
	close(b.subscribers)
	return nil
}
