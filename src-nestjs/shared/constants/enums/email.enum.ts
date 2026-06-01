/**
 * Email-related enums
 * Shared across API Gateway and Email Microservice
 */

export enum EmailStatus {
	PENDING = 'pending',
	QUEUED = 'queued',
	SENDING = 'sending',
	SENT = 'sent',
	FAILED = 'failed',
}

export enum EmailTemplate {
	OTP_PAYMENT = 'otp_payment',
	OTP_PASSWORD_RESET = 'otp_password_reset',
	OTP_CANCELLATION = 'otp_cancellation',
	PAYMENT_SUCCESS = 'payment_success',
	PAYMENT_FAILED = 'payment_failed',
	BOOKING_CONFIRMATION = 'booking_confirmation',
	TICKET_CONFIRMATION = 'ticket_confirmation',
	BOOKING_CANCELLATION = 'booking_cancellation',
}

