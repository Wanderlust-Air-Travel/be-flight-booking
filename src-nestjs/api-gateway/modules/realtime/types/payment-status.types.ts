/**
 * Payment Status Types
 * Types for payment status real-time updates
 */

/**
 * Payment status values
 */
export type PaymentStatus = 'pending' | 'success' | 'failed';

/**
 * Payment status message format (Redis Pub/Sub)
 */
export interface PaymentStatusMessage {
	bookingId: string;
	paymentId: string;
	status: PaymentStatus;
	timestamp: string;
	metadata?: Record<string, any>;
}

/**
 * Payment status update event (WebSocket client)
 */
export interface PaymentStatusUpdateEvent {
	bookingId: string;
	paymentId: string;
	status: PaymentStatus;
	timestamp: string;
	metadata?: Record<string, any>;
}

