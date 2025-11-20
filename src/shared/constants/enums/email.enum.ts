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
	PAYMENT_SUCCESS = 'payment_success',
	PAYMENT_FAILED = 'payment_failed',
	BOOKING_CONFIRMATION = 'booking_confirmation',
}

