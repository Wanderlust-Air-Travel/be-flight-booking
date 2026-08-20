import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import type { IOutboxWriter } from '../../../../shared/application/ports/outbox-writer.interface';
import type { RefundPaymentCommand, RefundPaymentResponse } from '../commands/refund-payment.command';

/**
 * RefundPaymentHandler — Refunds a successful payment.
 *
 * Enforces: only SUCCESS payments can be refunded; refund amount cannot
 * exceed payment amount (invariant in aggregate).
 */
@Injectable()
export class RefundPaymentHandler {
    constructor(
        @Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: RefundPaymentCommand): Promise<RefundPaymentResponse> {
        const payment = await this.paymentRepo.findById(command.paymentId);
        if (!payment) throw new NotFoundException(`Payment ${command.paymentId} not found`);

        payment.refund(command.refundAmount, command.reason);
        await this.paymentRepo.save(payment);
        for (const event of payment.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            paymentId: payment.id,
            status: payment.status.value,
            refundAmount: command.refundAmount,
            currency: payment.currency,
        };
    }
}