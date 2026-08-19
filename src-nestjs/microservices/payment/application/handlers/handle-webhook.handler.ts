import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';

export interface PaymentWebhookPayload {
    gateway: string;
    transactionRef: string;
    status: 'success' | 'failed';
    failureReason?: string;
    paymentId?: string;
}

/**
 * HandleWebhookHandler — Receives async callbacks from payment gateway.
 *
 * Idempotent: looks up payment by transactionRef and updates its status.
 * Does NOT directly trigger cross-context calls — instead emits
 * PaymentSucceededEvent which booking context consumes via outbox.
 */
@Injectable()
export class HandleWebhookHandler {
    private readonly logger = new Logger(HandleWebhookHandler.name);

    constructor(
        @Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(payload: PaymentWebhookPayload): Promise<{ received: boolean }> {
        this.logger.log(`Webhook received from ${payload.gateway}: ${payload.transactionRef} → ${payload.status}`);

        // Find payment by transaction_ref (in real impl: a separate finder)
        // For now, if paymentId is provided, use it directly
        if (!payload.paymentId) {
            this.logger.warn('Webhook missing paymentId; skipping');
            return { received: false };
        }

        const payment = await this.paymentRepo.findById(payload.paymentId);
        if (!payment) {
            this.logger.warn(`Webhook payment ${payload.paymentId} not found`);
            return { received: false };
        }

        if (payload.status === 'success') {
            payment.markSucceeded(payload.transactionRef, 1, new Date());
        } else {
            payment.markFailed(payload.failureReason ?? 'Gateway failure');
        }

        await this.paymentRepo.save(payment);
        for (const event of payment.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return { received: true };
    }
}