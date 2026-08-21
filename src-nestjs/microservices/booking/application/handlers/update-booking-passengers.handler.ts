import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IOutboxWriter } from 'src/shared/application/ports/outbox-writer.interface';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';

export interface UpdateBookingPassengersCommand {
    bookingId: string;
    userId: string;
    passengers: Array<{ fullName: string; type: 'adult' | 'child' | 'infant' }>;
}

export interface UpdateBookingPassengersResponse {
    bookingId: string;
    totalPassengers: number;
    updatedAt: string;
}

/**
 * UpdateBookingPassengersHandler — Replaces the passenger list on a booking.
 *
 * Domain invariant: cannot update passengers on a cancelled/completed booking.
 * The aggregate's updatePassengers() enforces this and emits PassengersUpdatedEvent.
 */
@Injectable()
export class UpdateBookingPassengersHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(
        command: UpdateBookingPassengersCommand
    ): Promise<UpdateBookingPassengersResponse> {
        const booking = await this.bookingRepo.findById(command.bookingId);
        if (!booking) throw new NotFoundException(`Booking ${command.bookingId} not found`);
        if (booking.userId !== command.userId)
            throw new ForbiddenException('You do not have access to this booking');

        booking.updatePassengers(command.passengers);
        await this.bookingRepo.save(booking);
        for (const event of booking.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            bookingId: booking.id,
            totalPassengers: booking.passengers.length,
            updatedAt: new Date().toISOString(),
        };
    }
}
