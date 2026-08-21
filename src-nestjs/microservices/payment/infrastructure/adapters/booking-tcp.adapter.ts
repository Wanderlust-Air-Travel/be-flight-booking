import { Inject, Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type {
    BookingSummaryForPayment,
    IBookingPortForPayment,
} from '../../application/ports/booking.port';

/**
 * BookingTcpAdapter — Production IBookingPortForPayment.
 * Replaces `@InjectRepository(Booking)` in old payment.service.ts.
 *
 * Calls booking context via TCP for read-only summaries.
 */
@Injectable()
export class BookingTcpAdapter implements IBookingPortForPayment {
    constructor(@Inject('BOOKING_CLIENT') private readonly client: ClientProxy) {}

    async findSummaryById(bookingId: string): Promise<BookingSummaryForPayment | null> {
        const result = await this.client
            .send<BookingSummaryForPayment | null>('get_booking_summary', { bookingId })
            .toPromise();
        return result ?? null;
    }
}
