export interface CancelBookingCommand {
    bookingId: string;
    userId: string;
    reason: string;
}

export interface CancelBookingResponse {
    bookingId: string;
    pnr: string;
    status: string;
    refundAmount: number;
    currency: string;
    cancelledAt: string;
}

export const CANCEL_BOOKING_COMMAND = 'CancelBookingCommand';