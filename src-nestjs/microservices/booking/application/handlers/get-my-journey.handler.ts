import { Inject, Injectable } from '@nestjs/common';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';

export interface GetMyJourneyQuery {
    userId: string;
}

export interface Journey {
    bookingId: string;
    pnr: string;
    status: string;
    totalAmount: number;
    currency: string;
    segments: Array<{ flightInstanceId: string; cabinType: string; fareClassCode: string }>;
    passengers: number;
}

export interface GetMyJourneyResponse {
    journeys: Journey[];
}

/**
 * GetMyJourneyHandler — Returns all journeys (confirmed/upcoming + past) for a user.
 * Grouped per booking; in real impl may join with flights and tickets.
 */
@Injectable()
export class GetMyJourneyHandler {
    constructor(
        @Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository
    ) {}

    async execute(query: GetMyJourneyQuery): Promise<GetMyJourneyResponse> {
        const result = await this.bookingRepo.findByUserId(query.userId, {
            page: 1,
            limit: 100,
        });
        return {
            journeys: result.items.map((b) => ({
                bookingId: b.id,
                pnr: b.pnr.value,
                status: b.status.value,
                totalAmount: b.totalAmount.amount,
                currency: b.totalAmount.currency,
                segments: b.segments,
                passengers: b.passengers.length,
            })),
        };
    }
}