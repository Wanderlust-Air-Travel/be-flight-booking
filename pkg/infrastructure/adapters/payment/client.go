package payment

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"flight-booking/pkg/application/ports"
	apperrors "flight-booking/pkg/shared/errors"
	"flight-booking/pkg/shared/logger"
)

// MockClient is a mock implementation of the payment port for testing and development.
type MockClient struct {
	log *logger.Logger
}

// NewMockClient creates a new mock payment client.
func NewMockClient(log *logger.Logger) *MockClient {
	return &MockClient{
		log: log,
	}
}

// Ensure MockClient implements ports.PaymentPort
var _ ports.PaymentPort = (*MockClient)(nil)

// CreatePayment initiates a new payment transaction.
func (c *MockClient) CreatePayment(ctx context.Context, bookingID uuid.UUID, amountVND int64, currency string) (*ports.PaymentResult, error) {
	// Simulate processing delay
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(50 * time.Millisecond):
	}

	// Generate mock transaction ID
	txnID := fmt.Sprintf("TXN%s%d", uuid.New().String()[:8], time.Now().Unix())

	// Generate mock payment URL
	paymentURL := fmt.Sprintf("http://localhost:8080/api/v1/payment/mock/callback?txn=%s&booking=%s&amount=%d",
		txnID, bookingID.String(), amountVND)

	// Set expiration to 30 minutes from now
	expiresAt := time.Now().Add(30 * time.Minute)

	c.log.Info("Mock payment created", logger.Fields{
		"booking_id": bookingID.String(),
		"txn_id":     txnID,
		"amount":     amountVND,
		"currency":   currency,
		"expires_at": expiresAt.Format(time.RFC3339),
	})

	return &ports.PaymentResult{
		ProviderTxnID: txnID,
		PaymentURL:    paymentURL,
		ExpiresAt:     expiresAt,
	}, nil
}

// GetPaymentStatus retrieves the status of an existing payment.
func (c *MockClient) GetPaymentStatus(ctx context.Context, txnID string) (*ports.PaymentStatusResult, error) {
	// Simulate processing delay
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(30 * time.Millisecond):
	}

	// Simulate 95% success rate
	successRate := rand.Float64()
	
	var status ports.PaymentStatusResult

	if successRate < 0.95 {
		// 95% success rate
		status = ports.PaymentStatusResult{
			Status:    "COMPLETED",
			UpdatedAt: time.Now(),
			Message:   "Payment completed successfully",
		}
		c.log.Info("Mock payment status: COMPLETED", logger.Fields{
			"txn_id": txnID,
		})
	} else if successRate < 0.98 {
		// 3% pending
		status = ports.PaymentStatusResult{
			Status:    "PENDING",
			UpdatedAt: time.Now(),
			Message:   "Payment is being processed",
		}
		c.log.Info("Mock payment status: PENDING", logger.Fields{
			"txn_id": txnID,
		})
	} else {
		// 2% failed
		status = ports.PaymentStatusResult{
			Status:    "FAILED",
			UpdatedAt: time.Now(),
			Message:   "Payment failed: insufficient funds",
		}
		c.log.Warn("Mock payment status: FAILED", logger.Fields{
			"txn_id": txnID,
		})
	}

	return &status, nil
}

// RefundPayment processes a refund for a previous payment.
func (c *MockClient) RefundPayment(ctx context.Context, txnID string, amountVND int64) error {
	// Simulate processing delay
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(100 * time.Millisecond):
	}

	// Simulate 2% failure rate for refunds
	failureRate := rand.Float64()

	if failureRate < 0.02 {
		c.log.Error("Mock refund failed", logger.Fields{
			"txn_id": txnID,
			"amount": amountVND,
		})
		return apperrors.PaymentFailed("refund processing failed: transaction not found")
	}

	c.log.Info("Mock refund processed", logger.Fields{
		"txn_id": txnID,
		"amount": amountVND,
	})

	return nil
}

// ============================================================================
// Stripe Client (Stub for future integration)
// ============================================================================

// StripeClient is a stub implementation for Stripe payment gateway.
type StripeClient struct {
	apiKey string
	log    *logger.Logger
}

// NewStripeClient creates a new Stripe client (stub).
// TODO: Implement actual Stripe integration
func NewStripeClient(apiKey string, log *logger.Logger) *StripeClient {
	return &StripeClient{
		apiKey: apiKey,
		log:    log,
	}
}

// CreatePayment creates a Stripe payment intent.
// TODO: Implement actual Stripe payment intent creation
func (s *StripeClient) CreatePayment(ctx context.Context, bookingID uuid.UUID, amountVND int64, currency string) (*ports.PaymentResult, error) {
	// TODO: Implement Stripe payment intent
	// - Convert VND to Stripe's smallest currency unit (cents)
	// - Create payment intent with Stripe API
	// - Return client secret for frontend payment form
	
	s.log.Warn("Stripe CreatePayment not implemented", logger.Fields{
		"booking_id": bookingID.String(),
		"amount":    amountVND,
	})

	return nil, fmt.Errorf("Stripe integration not yet implemented")
}

// GetPaymentStatus retrieves payment status from Stripe.
// TODO: Implement actual Stripe payment status retrieval
func (s *StripeClient) GetPaymentStatus(ctx context.Context, paymentIntentID string) (*ports.PaymentStatusResult, error) {
	// TODO: Implement Stripe payment intent retrieval
	
	s.log.Warn("Stripe GetPaymentStatus not implemented", logger.Fields{
		"payment_intent_id": paymentIntentID,
	})

	return nil, fmt.Errorf("Stripe integration not yet implemented")
}

// RefundPayment processes a refund through Stripe.
// TODO: Implement actual Stripe refund
func (s *StripeClient) RefundPayment(ctx context.Context, paymentIntentID string, amountVND int64) error {
	// TODO: Implement Stripe refund creation
	
	s.log.Warn("Stripe RefundPayment not implemented", logger.Fields{
		"payment_intent_id": paymentIntentID,
		"amount":           amountVND,
	})

	return fmt.Errorf("Stripe integration not yet implemented")
}

// Ensure StripeClient implements ports.PaymentPort
var _ ports.PaymentPort = (*StripeClient)(nil)

// ============================================================================
// Payment Result Helpers
// ============================================================================

// PaymentStatus represents the status of a payment.
type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "PENDING"
	PaymentStatusProcessing PaymentStatus = "PROCESSING"
	PaymentStatusCompleted  PaymentStatus = "COMPLETED"
	PaymentStatusFailed     PaymentStatus = "FAILED"
	PaymentStatusRefunded   PaymentStatus = "REFUNDED"
	PaymentStatusCancelled  PaymentStatus = "CANCELLED"
)

// PaymentMethod represents the payment method.
type PaymentMethod string

const (
	PaymentMethodCreditCard PaymentMethod = "CREDIT_CARD"
	PaymentMethodDebitCard  PaymentMethod = "DEBIT_CARD"
	PaymentMethodBankTransfer PaymentMethod = "BANK_TRANSFER"
	PaymentMethodEWallet    PaymentMethod = "E_WALLET"
	PaymentMethodVNPay      PaymentMethod = "VNPAY"
	PaymentMethodPayPal     PaymentMethod = "PAYPAL"
)

// PaymentRequest represents a payment request.
type PaymentRequest struct {
	BookingID      uuid.UUID
	AmountVND     int64
	Currency      string
	PaymentMethod PaymentMethod
	CustomerEmail string
	CustomerName  string
	ReturnURL     string
	CancelURL     string
	Metadata      map[string]string
}

// PaymentResponse represents the response from a payment operation.
type PaymentResponse struct {
	Success        bool
	TxnID          string
	PaymentURL     string
	ExpiresAt      time.Time
	ErrorCode      string
	ErrorMessage   string
}

// NewPaymentResponse creates a successful payment response.
func NewPaymentResponse(txnID, paymentURL string, expiresAt time.Time) *PaymentResponse {
	return &PaymentResponse{
		Success:    true,
		TxnID:      txnID,
		PaymentURL: paymentURL,
		ExpiresAt:  expiresAt,
	}
}

// NewPaymentErrorResponse creates an error payment response.
func NewPaymentErrorResponse(errorCode, errorMessage string) *PaymentResponse {
	return &PaymentResponse{
		Success:      false,
		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
	}
}

// RefundRequest represents a refund request.
type RefundRequest struct {
	TxnID     string
	AmountVND int64
	Reason    string
}

// RefundResponse represents the response from a refund operation.
type RefundResponse struct {
	Success      bool
	RefundID     string
	RefundedAt   time.Time
	ErrorCode    string
	ErrorMessage string
}

// NewRefundResponse creates a successful refund response.
func NewRefundResponse(refundID string) *RefundResponse {
	return &RefundResponse{
		Success:    true,
		RefundID:   refundID,
		RefundedAt: time.Now(),
	}
}

// NewRefundErrorResponse creates an error refund response.
func NewRefundErrorResponse(errorCode, errorMessage string) *RefundResponse {
	return &RefundResponse{
		Success:      false,
		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
	}
}

// ============================================================================
// VNPay Client (Stub for future integration)
// ============================================================================

// VNPayClient is a stub implementation for VNPay payment gateway.
type VNPayClient struct {
	merchantID  string
	merchantKey string
	version     string
	baseURL     string
	log         *logger.Logger
}

// NewVNPayClient creates a new VNPay client (stub).
func NewVNPayClient(merchantID, merchantKey, baseURL string, log *logger.Logger) *VNPayClient {
	return &VNPayClient{
		merchantID:  merchantID,
		merchantKey: merchantKey,
		version:     "2.0.1",
		baseURL:     baseURL,
		log:         log,
	}
}

// CreatePayment creates a VNPay payment URL.
// TODO: Implement actual VNPay payment URL generation
func (v *VNPayClient) CreatePayment(ctx context.Context, bookingID uuid.UUID, amountVND int64, currency string) (*ports.PaymentResult, error) {
	// TODO: Implement VNPay payment URL generation
	// - Generate secure hash
	// - Create payment URL with parameters
	
	v.log.Warn("VNPay CreatePayment not implemented", logger.Fields{
		"booking_id": bookingID.String(),
		"amount":     amountVND,
	})

	return nil, fmt.Errorf("VNPay integration not yet implemented")
}

// GetPaymentStatus retrieves payment status from VNPay.
// TODO: Implement actual VNPay status retrieval
func (v *VNPayClient) GetPaymentStatus(ctx context.Context, txnRef string) (*ports.PaymentStatusResult, error) {
	// TODO: Implement VNPay response verification
	
	v.log.Warn("VNPay GetPaymentStatus not implemented", logger.Fields{
		"txn_ref": txnRef,
	})

	return nil, fmt.Errorf("VNPay integration not yet implemented")
}

// RefundPayment processes a refund through VNPay.
// TODO: Implement actual VNPay refund
func (v *VNPayClient) RefundPayment(ctx context.Context, txnRef string, amountVND int64) error {
	// TODO: Implement VNPay refund
	
	v.log.Warn("VNPay RefundPayment not implemented", logger.Fields{
		"txn_ref": txnRef,
		"amount":  amountVND,
	})

	return fmt.Errorf("VNPay integration not yet implemented")
}

// Ensure VNPayClient implements ports.PaymentPort
var _ ports.PaymentPort = (*VNPayClient)(nil)

// ============================================================================
// Payment Gateway Factory
// ============================================================================

// ProviderType represents the type of payment provider.
type ProviderType string

const (
	ProviderTypeMock    ProviderType = "mock"
	ProviderTypeStripe  ProviderType = "stripe"
	ProviderTypeVNPay   ProviderType = "vnpay"
	ProviderTypePayPal  ProviderType = "paypal"
)

// PaymentGatewayFactory creates payment clients based on provider type.
type PaymentGatewayFactory struct {
	stripeKey string
	vnpayMerchantID string
	vnpayMerchantKey string
	vnpayBaseURL string
	log *logger.Logger
}

// NewPaymentGatewayFactory creates a new payment gateway factory.
func NewPaymentGatewayFactory(log *logger.Logger) *PaymentGatewayFactory {
	return &PaymentGatewayFactory{
		log: log,
	}
}

// ConfigureStripe sets the Stripe API key.
func (f *PaymentGatewayFactory) ConfigureStripe(apiKey string) {
	f.stripeKey = apiKey
}

// ConfigureVNPay sets the VNPay configuration.
func (f *PaymentGatewayFactory) ConfigureVNPay(merchantID, merchantKey, baseURL string) {
	f.vnpayMerchantID = merchantID
	f.vnpayMerchantKey = merchantKey
	f.vnpayBaseURL = baseURL
}

// CreateClient creates a payment client for the specified provider.
func (f *PaymentGatewayFactory) CreateClient(provider ProviderType) ports.PaymentPort {
	switch provider {
	case ProviderTypeMock:
		return NewMockClient(f.log)
	case ProviderTypeStripe:
		return NewStripeClient(f.stripeKey, f.log)
	case ProviderTypeVNPay:
		return NewVNPayClient(f.vnpayMerchantID, f.vnpayMerchantKey, f.vnpayBaseURL, f.log)
	default:
		f.log.Warn("Unknown payment provider, using mock", logger.Fields{
			"provider": provider,
		})
		return NewMockClient(f.log)
	}
}
