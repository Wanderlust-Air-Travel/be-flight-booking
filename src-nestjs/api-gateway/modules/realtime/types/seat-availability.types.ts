/**
 * Seat Availability Types
 * Types for seat availability real-time updates
 */

/**
 * Seat availability change event
 */
export interface SeatAvailabilityChange {
    flightSeatId: string;
    seatNumber: string;
    status: 'available' | 'reserved' | 'booked' | 'unavailable';
    changedBy?: string; // userId or sessionId
}

/**
 * Seat availability message format (Redis Pub/Sub)
 */
export interface SeatAvailabilityMessage {
    flightInstanceId: string;
    timestamp: string;
    changes: SeatAvailabilityChange[];
}

/**
 * Seat availability update event (WebSocket client)
 */
export interface SeatAvailabilityUpdateEvent {
    flightInstanceId: string;
    changes: SeatAvailabilityChange[];
    timestamp: string;
}
