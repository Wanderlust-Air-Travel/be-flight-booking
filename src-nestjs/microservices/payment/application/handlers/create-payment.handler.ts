import { Inject, Injectable } from '@nestjs/common';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';
import type { CreatePaymentCommand, CreatePaymentResponse } from '../commands/create-payment.command';
import { Payment } from '../../domain/aggregates/payment.aggregate';
import { IdempotencyKey } from '../../domain/value-objects/idempotency-key';

/**
 * CreatePaymentHandler — Idempotent payment creation.
 *
 * The aggregate's `create()` factory does the idempotency check via
 * the repository. If a payment with the same IdempotencyKey exists,
 * it returns that one (idempotent retry).
 */
@Injectable()
export class CreatePaymentHandler {
    constructor(
        @Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CreatePaymentCommand): Promise<CreatePaymentResponse> {
        const payment = await Payment.create(
            {
                bookingId: command.bookingId,
                amount: command.amount,
                currency: command.currency,
                method: command.method,
                idempotencyKey: IdempotencyKey.fromString(command.idempotencyKey),
            },
            this.paymentRepo
        );

        await this.paymentRepo.save(payment);
        for (const event of payment.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            paymentId: payment.id,
            bookingId: payment.bookingId,
            status: payment.status.value,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            createdAt: payment.createdAt.toISOString(),
        };
    }
}