import type { ContactInfo } from '../../domain/value-objects/contact-info';
import type { Money } from '../../domain/value-objects/money';

/**
 * CreateBookingCommand — Application-layer command.
 *
 * Handlers translate this into aggregate creation. DTOs from the
 * interface layer are converted to value objects before reaching here.
 */
export interface CreateBookingCommand {
    contact: ContactInfo;
    totalAmount: Money;
    passengers: Array<{ fullName: string; type: 'adult' | 'child' | 'infant' }>;
    segments: Array<{
        flightInstanceId: string;
        cabinType: string;
        fareClassCode: string;
    }>;
    userId: string | null;
}

export interface CreateBookingResponse {
    bookingId: string;
    pnr: string;
    status: string;
    totalAmount: number;
    currency: string;
    contactEmail: string;
    createdAt: string;
}

export const CREATE_BOOKING_COMMAND = 'CreateBookingCommand';