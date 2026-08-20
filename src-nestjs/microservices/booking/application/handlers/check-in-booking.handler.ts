import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import type { IOutboxWriter } from '../../../shared/application/ports/outbox-writer.interface';

export interface CheckInBookingCommand {
    bookingId: string;
    userId: string;
    checkedInAt: Date;
}

export interface CheckInBookingResponse {
    bookingId: string;
    status: string;
    checkedInAt: string;
}

/**
 * CheckInBookingHandler — Marks a PAID/CONFIRMED booking as checked in.
 *
 * The aggregate's checkIn() enforces invariants and emits CheckedInEvent.
 */
@Injectable()
export class CheckInBookingHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CheckInBookingCommand): Promise<CheckInBookingResponse> {
        const booking = await this.bookingRepo.findById(command.bookingId);
        if (!booking) throw new NotFoundException(`Booking ${command.bookingId} not found`);
        if (booking.userId !== command.userId)
            throw new ForbiddenException('You do not have access to this booking');

        booking.checkIn(command.checkedInAt);
        await this.bookingRepo.save(booking);
        for (const event of booking.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            bookingId: booking.id,
            status: booking.status.value,
            checkedInAt: command.checkedInAt.toISOString(),
        };
    }
}