/**
 * IReservationPort — Port to the reservation bounded context.
 *
 * Booking context needs to fetch existing reservations and cancel them
 * when converting to a booking. Replaces `@Inject('RESERVATION_CLIENT')`
 * with a typed interface.
 */
export interface IReservationPort {
    /**
     * Find a reservation by ID. Returns null if not found.
     */
    findById(reservationId: string): Promise<ReservationSummary | null>;

    /**
     * Cancel a reservation (called when its corresponding booking succeeds).
     */
    cancel(reservationId: string, by: string): Promise<void>;
}

export interface ReservationSummary {
    id: string;
    status: string;
    contactEmail: string;
    expiresAt: Date | null;
}

/**
 * Injection token for IReservationPort.
 */
export const RESERVATION_PORT = 'IReservationPort';