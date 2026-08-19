import { Inject, Injectable } from '@nestjs/common';
import type {
    IBookingPort,
    BookingSummary,
} from '../../application/ports/booking.port';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';

/**
 * BookingInternalAdapter — Production IBookingPort for cross-context reads.
 *
 * Implemented in the booking context itself (we own this aggregate).
 * Exposed via @Inject('IBookingPort') for payment/realtime contexts to
 * consume without direct repo access.
 */
@Injectable()
export class BookingInternalAdapter implements IBookingPort {
    constructor(
        @Inject('IBookingRepository') private readonly repo: IBookingRepository
    ) {}

    async findSummaryById(bookingId: string): Promise<BookingSummary | null> {
        const b = await this.repo.findById(bookingId);
        if (!b) return null;
        return {
            id: b.id,
            pnr: b.pnr.value,
            status: b.status.value,
            contactEmail: b.contact.email,
            userId: b.userId,
            totalAmount: b.totalAmount.amount,
            currency: b.totalAmount.currency,
        };
    }
}