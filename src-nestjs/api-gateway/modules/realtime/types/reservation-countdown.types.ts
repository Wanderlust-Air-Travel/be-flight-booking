/**
 * Reservation Countdown Types
 * Types for reservation countdown real-time updates
 */

/**
 * Reservation countdown update event (WebSocket client)
 */
export interface ReservationCountdownUpdateEvent {
    reservationId: string;
    remainingSeconds: number;
    expiresAt: string;
    isExpired: boolean;
}

/**
 * Reservation countdown expired event (WebSocket client)
 */
export interface ReservationCountdownExpiredEvent {
    reservationId: string;
    expiresAt: string;
}
