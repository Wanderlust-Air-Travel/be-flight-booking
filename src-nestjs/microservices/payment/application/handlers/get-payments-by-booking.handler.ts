import { Inject, Injectable } from '@nestjs/common';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import type {
    GetPaymentsByBookingQuery,
    GetPaymentsByBookingResponse,
} from '../commands/get-payments-by-booking.command';

/**
 * GetPaymentsByBookingHandler — Lists all payments for a booking.
 */
@Injectable()
export class GetPaymentsByBookingHandler {
    constructor(@Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository) {}

    async execute(query: GetPaymentsByBookingQuery): Promise<GetPaymentsByBookingResponse> {
        const result = await this.paymentRepo.findByBookingId(query.bookingId, {
            page: query.page,
            limit: query.limit,
        });
        return {
            items: result.items.map((p) => ({
                paymentId: p.id,
                status: p.status.value,
                amount: p.amount,
                currency: p.currency,
                transactionRef: p.transactionRef?.value ?? null,
                createdAt: p.createdAt.toISOString(),
            })),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}
