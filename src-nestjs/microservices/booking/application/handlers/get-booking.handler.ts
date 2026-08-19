import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';
import type { GetBookingQuery, GetBookingResponse } from '../commands/get-booking.command';

/**
 * GetBookingHandler — Returns booking details with ownership check.
 *
 * - Authenticated users may only see their own bookings.
 * - Guest users may see bookings where userId is null.
 * - Returns 404 when booking does not exist.
 */
@Injectable()
export class GetBookingHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository
    ) {}

    async execute(query: GetBookingQuery): Promise<GetBookingResponse> {
        const booking = await this.bookingRepo.findById(query.bookingId);
        if (!booking) {
            throw new NotFoundException(`Booking ${query.bookingId} not found`);
        }

        // Ownership check
        if (query.userId && booking.userId !== query.userId) {
            throw new ForbiddenException('You do not have access to this booking');
        }
        if (!query.userId && booking.userId !== null) {
            throw new ForbiddenException('Login to view this booking');
        }

        return {
            bookingId: booking.id,
            pnr: booking.pnr.value,
            status: booking.status.value,
            contactEmail: booking.contact.email,
            userId: booking.userId,
            totalAmount: booking.totalAmount.amount,
            currency: booking.totalAmount.currency,
            passengers: booking.passengers,
            segments: booking.segments,
            createdAt: booking.createdAt.toISOString(),
        };
    }
}