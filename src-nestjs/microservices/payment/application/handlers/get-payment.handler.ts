import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import type { GetPaymentQuery, GetPaymentResponse } from '../commands/get-payment.command';

/**
 * GetPaymentHandler — Read a single payment by ID.
 */
@Injectable()
export class GetPaymentHandler {
    constructor(@Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository) {}

    async execute(query: GetPaymentQuery): Promise<GetPaymentResponse> {
        const p = await this.paymentRepo.findById(query.paymentId);
        if (!p) throw new NotFoundException(`Payment ${query.paymentId} not found`);
        return {
            paymentId: p.id,
            bookingId: p.bookingId,
            status: p.status.value,
            amount: p.amount,
            currency: p.currency,
            method: p.method,
            transactionRef: p.transactionRef?.value ?? null,
            createdAt: p.createdAt.toISOString(),
            completedAt: p.completedAt?.toISOString() ?? null,
        };
    }
}
