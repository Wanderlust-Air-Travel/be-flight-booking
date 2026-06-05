/**
 * Realtime Common Types
 * Common types for real-time communication
 */

/**
 * Subscription types
 */
export type SubscriptionType = 'seatAvailability' | 'reservationCountdown' | 'paymentStatus';

/**
 * Client subscription information
 */
export interface ClientSubscriptions {
    seatAvailability: Set<string>; // flightInstanceIds
    reservationCountdown: Set<string>; // reservationIds
    paymentStatus: Set<string>; // bookingIds
}

/**
 * WebSocket connection info
 * Note: Socket type is imported from socket.io in gateway file
 */
export interface WebSocketConnectionInfo<T = any> {
    socket: T; // Socket instance (Socket from socket.io)
    userId?: string;
    sessionId?: string;
}

/**
 * WebSocket event names
 */
export const RealtimeEvents = {
    // Client → Server
    SUBSCRIBE_SEAT_AVAILABILITY: 'subscribe:seat-availability',
    UNSUBSCRIBE_SEAT_AVAILABILITY: 'unsubscribe:seat-availability',
    SUBSCRIBE_RESERVATION_COUNTDOWN: 'subscribe:reservation-countdown',
    UNSUBSCRIBE_RESERVATION_COUNTDOWN: 'unsubscribe:reservation-countdown',
    SUBSCRIBE_PAYMENT_STATUS: 'subscribe:payment-status',
    UNSUBSCRIBE_PAYMENT_STATUS: 'unsubscribe:payment-status',

    // Server → Client
    CONNECTED: 'connected',
    SEAT_AVAILABILITY_UPDATE: 'seat-availability:update',
    RESERVATION_COUNTDOWN_UPDATE: 'reservation-countdown:update',
    RESERVATION_COUNTDOWN_EXPIRED: 'reservation-countdown:expired',
    PAYMENT_STATUS_UPDATE: 'payment-status:update',
    ERROR: 'error',
} as const;
