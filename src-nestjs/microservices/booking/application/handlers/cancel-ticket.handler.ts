import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IOutboxWriter } from 'src/shared/application/ports/outbox-writer.interface';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';

export interface CancelTicketCommand {
    bookingId: string;
    userId: string;
    ticketIndex: number;
    reason: string;
}

export interface CancelTicketResponse {
    bookingId: string;
    pnr: string;
    remainingPassengers: number;
    bookingCancelled: boolean;
    refundAmount: number;
    currency: string;
}

/**
 * CancelTicketHandler — Cancel one passenger's ticket within a booking.
 *
 * If the cancelled ticket was the only passenger, the whole booking is
 * cancelled (auto-cancel-all rule). Otherwise, the booking remains and
 * the passenger list shrinks.
 */
@Injectable()
export class CancelTicketHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CancelTicketCommand): Promise<CancelTicketResponse> {
        const booking = await this.bookingRepo.findById(command.bookingId);
        if (!booking) throw new NotFoundException(`Booking ${command.bookingId} not found`);
        if (booking.userId !== command.userId)
            throw new ForbiddenException('You do not have access to this booking');

        const passengers = booking.passengers;
        const wasLastPassenger = passengers.length <= 1;

        if (wasLastPassenger) {
            // Cancel whole booking
            const refund = booking.cancel(command.userId, command.reason);
            await this.bookingRepo.save(booking);
            for (const event of booking.pullDomainEvents()) {
                await this.outbox.append(event);
            }
            return {
                bookingId: booking.id,
                pnr: booking.pnr.value,
                remainingPassengers: 0,
                bookingCancelled: true,
                refundAmount: refund.amount,
                currency: refund.currency,
            };
        } else {
            // Remove one passenger and update
            const updated = passengers.filter((_, idx) => idx !== command.ticketIndex);
            booking.updatePassengers(updated);
            await this.bookingRepo.save(booking);
            for (const event of booking.pullDomainEvents()) {
                await this.outbox.append(event);
            }
            return {
                bookingId: booking.id,
                pnr: booking.pnr.value,
                remainingPassengers: updated.length,
                bookingCancelled: false,
                refundAmount: 0,
                currency: booking.totalAmount.currency,
            };
        }
    }
}
