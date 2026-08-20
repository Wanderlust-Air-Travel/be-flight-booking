import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import type { IOutboxWriter } from '../../../shared/application/ports/outbox-writer.interface';
import type { CancelBookingCommand, CancelBookingResponse } from '../commands/cancel-booking.command';

/**
 * CancelBookingHandler — Cancels a booking with ownership check.
 *
 * The aggregate's `cancel()` enforces invariants (cannot cancel terminal
 * bookings) and emits BookingCancelledEvent with refund amount.
 */
@Injectable()
export class CancelBookingHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CancelBookingCommand): Promise<CancelBookingResponse> {
        const booking = await this.bookingRepo.findById(command.bookingId);
        if (!booking) {
            throw new NotFoundException(`Booking ${command.bookingId} not found`);
        }

        if (booking.userId !== command.userId) {
            throw new ForbiddenException('You do not have access to this booking');
        }

        const refund = booking.cancel(command.userId, command.reason);
        await this.bookingRepo.save(booking);

        for (const event of booking.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            bookingId: booking.id,
            pnr: booking.pnr.value,
            status: booking.status.value,
            refundAmount: refund.amount,
            currency: refund.currency,
            cancelledAt: new Date().toISOString(),
        };
    }
}