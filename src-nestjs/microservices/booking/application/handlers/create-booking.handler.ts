import { Inject, Injectable } from '@nestjs/common';
import type { IOutboxWriter } from 'src/shared/application/ports/outbox-writer.interface';
import { Booking } from '../../domain/aggregates/booking.aggregate';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import type {
    CreateBookingCommand,
    CreateBookingResponse,
} from '../commands/create-booking.command';

/**
 * CreateBookingHandler — Use case for creating a new booking.
 *
 * Flow:
 *  1. Aggregate factory `Booking.create()` — generates PNR with collision check
 *  2. Persist via IBookingRepository (in same transaction as outbox writes)
 *  3. Pull domain events from aggregate
 *  4. Append each event to outbox (transactional with the booking row)
 *  5. Return DTO
 *
 * Dependencies: 2 (was 20 in old booking.service.ts).
 */
@Injectable()
export class CreateBookingHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CreateBookingCommand): Promise<CreateBookingResponse> {
        // 1. Create aggregate (generates unique PNR)
        const booking = await Booking.create(
            {
                contact: command.contact,
                totalAmount: command.totalAmount,
                passengers: command.passengers,
                segments: command.segments,
                userId: command.userId,
            },
            this.bookingRepo
        );

        // 2. Persist aggregate
        await this.bookingRepo.save(booking);

        // 3-4. Drain events and append to outbox (transactional)
        for (const event of booking.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        // 5. Return response DTO
        return {
            bookingId: booking.id,
            pnr: booking.pnr.value,
            status: booking.status.value,
            totalAmount: booking.totalAmount.amount,
            currency: booking.totalAmount.currency,
            contactEmail: booking.contact.email,
            createdAt: booking.createdAt.toISOString(),
        };
    }
}
