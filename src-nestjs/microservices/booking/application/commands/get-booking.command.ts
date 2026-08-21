/**
 * GetBookingCommand + GetBookingResponse — Query use case for a single booking.
 */

export interface GetBookingQuery {
    bookingId: string;
    userId: string | null; // null = guest
}

export interface GetBookingResponse {
    bookingId: string;
    pnr: string;
    status: string;
    contactEmail: string;
    userId: string | null;
    totalAmount: number;
    currency: string;
    passengers: Array<{ fullName: string; type: string }>;
    segments: Array<{ flightInstanceId: string; cabinType: string; fareClassCode: string }>;
    createdAt: string;
}

export const GET_BOOKING_QUERY = 'GetBookingQuery';
