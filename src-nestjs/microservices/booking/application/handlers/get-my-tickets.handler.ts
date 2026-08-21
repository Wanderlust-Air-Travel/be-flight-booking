import { Inject, Injectable } from '@nestjs/common';
import type { IBookingRepository } from '../../domain/repositories/booking.repository.interface';

export interface GetMyTicketsQuery {
    userId: string;
    page: number;
    limit: number;
}

export interface MyTicket {
    bookingId: string;
    pnr: string;
    status: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
}

export interface GetMyTicketsResponse {
    items: MyTicket[];
    total: number;
    page: number;
    limit: number;
}

/**
 * GetMyTicketsHandler — Returns paginated bookings for a user.
 * (In real impl, joins with Tickets table; here returns bookings as tickets.)
 */
@Injectable()
export class GetMyTicketsHandler {
    constructor(@Inject('IBookingRepository') private readonly bookingRepo: IBookingRepository) {}

    async execute(query: GetMyTicketsQuery): Promise<GetMyTicketsResponse> {
        const result = await this.bookingRepo.findByUserId(query.userId, {
            page: query.page,
            limit: query.limit,
        });
        return {
            items: result.items.map((b) => ({
                bookingId: b.id,
                pnr: b.pnr.value,
                status: b.status.value,
                totalAmount: b.totalAmount.amount,
                currency: b.totalAmount.currency,
                createdAt: b.createdAt.toISOString(),
            })),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}
