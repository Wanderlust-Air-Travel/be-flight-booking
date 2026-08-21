/**
 * IBookingPort — Port from other contexts (payment, realtime) to booking.
 *
 * Used by payment context to confirm booking ownership, by realtime to
 * subscribe to booking events, etc.
 */
export interface IBookingPort {
    /**
     * Get booking summary for cross-context reads.
     */
    findSummaryById(bookingId: string): Promise<BookingSummary | null>;
}

export interface BookingSummary {
    id: string;
    pnr: string;
    status: string;
    contactEmail: string;
    userId: string | null;
    totalAmount: number;
    currency: string;
}

export const BOOKING_PORT = 'IBookingPort';
