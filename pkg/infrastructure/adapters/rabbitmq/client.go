package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"flight-booking/pkg/shared/logger"
)

// Config holds the configuration for the RabbitMQ client.
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	VHost    string
	Exchange string
}

// Client wraps the RabbitMQ connection and channel.
type Client struct {
	conn     *amqp.Connection
	channel  *amqp.Channel
	exchange string
	log      *logger.Logger
	handlers map[string][]EventHandler
	mu       sync.RWMutex
	started  bool
	stopCh   chan struct{}
}

// EventHandler is a function that handles an event.
type EventHandler func(event interface{}) error

// NewClient creates a new RabbitMQ client.
func NewClient(cfg Config, log *logger.Logger) (*Client, error) {
	url := fmt.Sprintf("amqp://%s:%s@%s:%d/%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.VHost)

	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	// Declare the exchange
	err = channel.ExchangeDeclare(
		cfg.Exchange, // name
		"topic",     // type
		true,        // durable
		false,       // auto-deleted
		false,       // internal
		false,       // no-wait
		nil,         // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	log.Info("RabbitMQ connection established", logger.Fields{
		"host":     cfg.Host,
		"exchange": cfg.Exchange,
	})

	client := &Client{
		conn:     conn,
		channel:  channel,
		exchange: cfg.Exchange,
		log:      log,
		handlers: make(map[string][]EventHandler),
		stopCh:   make(chan struct{}),
	}

	// Monitor connection for closure
	go client.monitorConnection()

	return client, nil
}

// monitorConnection monitors the connection and reconnection.
func (c *Client) monitorConnection() {
	closeChan := c.conn.NotifyClose(make(chan *amqp.Error))

	select {
	case err := <-closeChan:
		if err != nil {
			c.log.Error("RabbitMQ connection closed", logger.Fields{
				"error": err.Error(),
			})
		}
	case <-c.stopCh:
		return
	}
}

// Start starts consuming messages for all subscribed handlers.
func (c *Client) Start(ctx context.Context) error {
	c.mu.Lock()
	if c.started {
		c.mu.Unlock()
		return nil
	}
	c.started = true
	c.mu.Unlock()

	c.log.Info("RabbitMQ client started", nil)

	// Start consumers for all handlers
	c.mu.RLock()
	for eventType, handlers := range c.handlers {
		for _, handler := range handlers {
			go c.startConsumer(ctx, eventType, handler)
		}
	}
	c.mu.RUnlock()

	return nil
}

// Stop stops the RabbitMQ client.
func (c *Client) Stop() error {
	c.mu.Lock()
	if !c.started {
		c.mu.Unlock()
		return nil
	}
	c.started = false
	c.mu.Unlock()

	close(c.stopCh)

	if err := c.channel.Close(); err != nil {
		return fmt.Errorf("failed to close channel: %w", err)
	}

	if err := c.conn.Close(); err != nil {
		return fmt.Errorf("failed to close connection: %w", err)
	}

	c.log.Info("RabbitMQ client stopped", nil)
	return nil
}

// Publish publishes events to the exchange.
func (c *Client) Publish(ctx context.Context, events ...interface{}) error {
	for _, event := range events {
		body, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("failed to marshal event: %w", err)
		}

		// Get routing key from event type
		routingKey := getEventRoutingKey(event)

		err = c.channel.PublishWithContext(
			ctx,
			c.exchange,  // exchange
			routingKey,  // routing key
			false,       // mandatory
			false,       // immediate
			amqp.Publishing{
				DeliveryMode: amqp.Persistent,
				ContentType:  "application/json",
				Body:         body,
				Timestamp:    time.Now(),
			},
		)
		if err != nil {
			return fmt.Errorf("failed to publish event: %w", err)
		}

		c.log.Debug("Published event", logger.Fields{
			"routing_key": routingKey,
			"exchange":    c.exchange,
		})
	}

	return nil
}

// Subscribe registers a handler for a specific event type.
func (c *Client) Subscribe(eventType string, handler EventHandler) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.handlers[eventType] = append(c.handlers[eventType], handler)

	c.log.Info("Subscribed to event", logger.Fields{
		"event_type": eventType,
	})

	return nil
}

// startConsumer starts consuming messages for a specific event type.
func (c *Client) startConsumer(ctx context.Context, eventType string, handler EventHandler) {
	routingKey := eventType

	// Declare an auto-named queue
	queue, err := c.channel.QueueDeclare(
		"",    // name (auto-generated)
		false, // durable
		true,  // delete when unused
		true,  // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		c.log.Error("Failed to declare queue", logger.Fields{
			"error": err.Error(),
		})
		return
	}

	// Bind queue to exchange with routing key
	err = c.channel.QueueBind(
		queue.Name,  // queue name
		routingKey,  // routing key
		c.exchange,  // exchange
		false,       // no-wait
		nil,         // arguments
	)
	if err != nil {
		c.log.Error("Failed to bind queue", logger.Fields{
			"error":      err.Error(),
			"queue":      queue.Name,
			"routing_key": routingKey,
		})
		return
	}

	// Start consuming
	msgs, err := c.channel.Consume(
		queue.Name, // queue
		"",         // consumer tag
		false,      // auto-ack
		false,      // exclusive
		false,      // no-local
		false,      // no-wait
		nil,        // arguments
	)
	if err != nil {
		c.log.Error("Failed to start consumer", logger.Fields{
			"error": err.Error(),
			"queue": queue.Name,
		})
		return
	}

	c.log.Info("Consumer started", logger.Fields{
		"queue":      queue.Name,
		"routing_key": routingKey,
	})

	for {
		select {
		case <-ctx.Done():
			c.log.Info("Consumer stopping due to context cancellation", logger.Fields{
				"queue": queue.Name,
			})
			return
		case <-c.stopCh:
			c.log.Info("Consumer stopping due to stop signal", logger.Fields{
				"queue": queue.Name,
			})
			return
		case msg, ok := <-msgs:
			if !ok {
				c.log.Info("Consumer channel closed", logger.Fields{
					"queue": queue.Name,
				})
				return
			}
			c.handleMessage(msg, handler)
		}
	}
}

// handleMessage processes a received message.
func (c *Client) handleMessage(msg amqp.Delivery, handler EventHandler) {
	c.log.Debug("Received message", logger.Fields{
		"routing_key": msg.RoutingKey,
		"content_type": msg.ContentType,
	})

	// Parse the message body
	var event interface{}
	if err := json.Unmarshal(msg.Body, &event); err != nil {
		c.log.Error("Failed to unmarshal message", logger.Fields{
			"error": err.Error(),
		})
		// Reject the message without requeue (don't retry malformed messages)
		msg.Reject(false)
		return
	}

	// Call the handler in a goroutine
	go func() {
		if err := handler(event); err != nil {
			c.log.Error("Handler failed", logger.Fields{
				"error":      err.Error(),
				"routing_key": msg.RoutingKey,
			})
			// Requeue the message for retry
			msg.Reject(true)
			return
		}

		// Acknowledge successful processing
		if err := msg.Ack(false); err != nil {
			c.log.Error("Failed to ack message", logger.Fields{
				"error": err.Error(),
			})
		}
	}()
}

// getEventRoutingKey returns the routing key for an event.
func getEventRoutingKey(event interface{}) string {
	// Use type name as routing key
	switch e := event.(type) {
	case EventWithType:
		return e.GetEventType()
	default:
		return "event.unknown"
	}
}

// EventWithType is an interface for events that have a type.
type EventWithType interface {
	GetEventType() string
}

// ============================================================================
// Common Event Types
// ============================================================================

// BaseEvent is a common base for all events.
type BaseEvent struct {
	EventID   string    `json:"event_id"`
	EventType string    `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
}

// GetEventType returns the event type.
func (e *BaseEvent) GetEventType() string {
	return e.EventType
}

// NewBaseEvent creates a new base event.
func NewBaseEvent(eventType string) *BaseEvent {
	return &BaseEvent{
		EventID:   fmt.Sprintf("%d", time.Now().UnixNano()),
		EventType: eventType,
		Timestamp: time.Now(),
	}
}

// ============================================================================
// Publish/Subscribe Helpers
// ============================================================================

// PublishBookingCreated publishes a booking created event.
func (c *Client) PublishBookingCreated(ctx context.Context, bookingID, userID string) error {
	event := struct {
		*BaseEvent
		BookingID string `json:"booking_id"`
		UserID    string `json:"user_id"`
	}{
		BaseEvent: NewBaseEvent("booking.created"),
		BookingID: bookingID,
		UserID:    userID,
	}
	return c.Publish(ctx, event)
}

// PublishBookingConfirmed publishes a booking confirmed event.
func (c *Client) PublishBookingConfirmed(ctx context.Context, bookingID, userID string) error {
	event := struct {
		*BaseEvent
		BookingID string `json:"booking_id"`
		UserID    string `json:"user_id"`
	}{
		BaseEvent: NewBaseEvent("booking.confirmed"),
		BookingID: bookingID,
		UserID:    userID,
	}
	return c.Publish(ctx, event)
}

// PublishPaymentCompleted publishes a payment completed event.
func (c *Client) PublishPaymentCompleted(ctx context.Context, bookingID, txnID string, amount int64) error {
	event := struct {
		*BaseEvent
		BookingID string `json:"booking_id"`
		TxnID     string `json:"txn_id"`
		Amount    int64  `json:"amount"`
	}{
		BaseEvent: NewBaseEvent("payment.completed"),
		BookingID: bookingID,
		TxnID:     txnID,
		Amount:    amount,
	}
	return c.Publish(ctx, event)
}

// PublishPaymentFailed publishes a payment failed event.
func (c *Client) PublishPaymentFailed(ctx context.Context, bookingID, reason string) error {
	event := struct {
		*BaseEvent
		BookingID string `json:"booking_id"`
		Reason   string `json:"reason"`
	}{
		BaseEvent: NewBaseEvent("payment.failed"),
		BookingID: bookingID,
		Reason:    reason,
	}
	return c.Publish(ctx, event)
}

// PublishFlightStatusChanged publishes a flight status changed event.
func (c *Client) PublishFlightStatusChanged(ctx context.Context, flightID string, oldStatus, newStatus string) error {
	event := struct {
		*BaseEvent
		FlightID   string `json:"flight_id"`
		OldStatus string `json:"old_status"`
		NewStatus string `json:"new_status"`
	}{
		BaseEvent: NewBaseEvent("flight.status_changed"),
		FlightID:  flightID,
		OldStatus: oldStatus,
		NewStatus: newStatus,
	}
	return c.Publish(ctx, event)
}

// PublishBookingCancelled publishes a booking cancelled event.
func (c *Client) PublishBookingCancelled(ctx context.Context, bookingID, userID, reason string) error {
	event := struct {
		*BaseEvent
		BookingID string `json:"booking_id"`
		UserID    string `json:"user_id"`
		Reason   string `json:"reason"`
	}{
		BaseEvent: NewBaseEvent("booking.cancelled"),
		BookingID: bookingID,
		UserID:    userID,
		Reason:    reason,
	}
	return c.Publish(ctx, event)
}

// PublishRefundProcessed publishes a refund processed event.
func (c *Client) PublishRefundProcessed(ctx context.Context, bookingID, txnID string, amount int64) error {
	event := struct {
		*BaseEvent
		BookingID string `json:"booking_id"`
		TxnID     string `json:"txn_id"`
		Amount    int64  `json:"amount"`
	}{
		BaseEvent: NewBaseEvent("refund.processed"),
		BookingID: bookingID,
		TxnID:     txnID,
		Amount:    amount,
	}
	return c.Publish(ctx, event)
}

// ============================================================================
// Health Check
// ============================================================================

// IsConnected returns true if the client is connected.
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.conn != nil && !c.conn.IsClosed()
}

// Channel returns the underlying AMQP channel.
func (c *Client) Channel() *amqp.Channel {
	return c.channel
}
