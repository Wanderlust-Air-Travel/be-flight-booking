/**
 * IBookingPortForPayment — Read-only port from payment context to booking.
 *
 * Replaces the old `@InjectRepository(Booking)` cross-context leak.
 * Used to check booking ownership before processing payment.
 */
export interface IBookingPortForPayment {
    /** Returns the booking summary if it exists, else null. */
    findSummaryById(bookingId: string): Promise<BookingSummaryForPayment | null>;
}

export interface BookingSummaryForPayment {
    id: string;
    userId: string | null;
    status: string;
}

export const PAYMENT_BOOKING_PORT = 'IBookingPortForPayment';
