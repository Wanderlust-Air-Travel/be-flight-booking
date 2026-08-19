import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';
import type { IPaymentGateway } from '../ports/payment-gateway.port';
import type { ProcessPaymentCommand, ProcessPaymentResponse } from '../commands/process-payment.command';
import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';

/**
 * ProcessPaymentHandler — Charges via IPaymentGateway and emits success/fail events.
 *
 * Single ticket count is determined by the booking (1 payment = N tickets
 * where N is the booking's passenger count). For now we default to N=1.
 *
 * On successful charge, emits PaymentSucceededEvent which booking context
 * consumes to issue tickets.
 */
@Injectable()
export class ProcessPaymentHandler {
    constructor(
        @Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository,
        @Inject('IPaymentGateway') private readonly gateway: IPaymentGateway,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: ProcessPaymentCommand): Promise<ProcessPaymentResponse> {
        const payment = await this.paymentRepo.findById(command.paymentId);
        if (!payment) throw new NotFoundException(`Payment ${command.paymentId} not found`);

        const result = await this.gateway.charge({
            amount: payment.amount,
            currency: payment.currency,
            method: command.method,
            cardToken: command.cardToken,
            idempotencyKey: payment.idempotencyKey.value,
        });

        if (result.success && result.transactionRef) {
            payment.markSucceeded(result.transactionRef, 1, new Date());
        } else {
            payment.markFailed(result.failureReason ?? 'Unknown gateway error');
        }

        await this.paymentRepo.save(payment);
        for (const event of payment.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        if (!payment.transactionRef && !payment.status.isSuccessful() && !payment.status.isTerminal()) {
            throw new DomainException('Payment processing did not reach terminal state');
        }

        return {
            paymentId: payment.id,
            status: payment.status.value,
            transactionRef: payment.transactionRef?.value ?? null,
            completedAt: payment.completedAt?.toISOString() ?? new Date().toISOString(),
        };
    }
}