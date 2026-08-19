import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';

export interface CreateTicketsFromBookingCommand {
    bookingId: string;
    ticketCount: number;
}

export interface CreateTicketsFromBookingResponse {
    bookingId: string;
    ticketCount: number;
    generatedAt: string;
}

/**
 * CreateTicketsFromBookingHandler — Converts a PAID booking into tickets.
 *
 * Invoked by the PaymentSucceededEvent handler (cross-context, via
 * @EventPattern('payment.succeeded')). Idempotent: if called twice, the
 * second call sees an already-PAID booking and emits a fresh TicketsIssuedEvent.
 */
@Injectable()
export class CreateTicketsFromBookingHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(
        command: CreateTicketsFromBookingCommand
    ): Promise<CreateTicketsFromBookingResponse> {
        const booking = await this.bookingRepo.findById(command.bookingId);
        if (!booking) throw new NotFoundException(`Booking ${command.bookingId} not found`);

        booking.issueTickets(command.ticketCount);
        await this.bookingRepo.save(booking);
        for (const event of booking.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            bookingId: booking.id,
            ticketCount: command.ticketCount,
            generatedAt: new Date().toISOString(),
        };
    }
}