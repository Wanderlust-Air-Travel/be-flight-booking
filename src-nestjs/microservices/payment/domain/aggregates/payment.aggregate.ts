import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';
import { IdempotencyKey } from '../value-objects/idempotency-key';
import { PaymentStatus } from '../value-objects/payment-status';
import { TransactionRef } from '../value-objects/transaction-ref';
import {
    PaymentCreatedEvent,
    PaymentExpiredEvent,
    PaymentFailedEvent,
    PaymentRefundedEvent,
    PaymentSucceededEvent,
} from '../events/payment.events';
import type { IPaymentRepository } from '../repositories/payment.repository.interface';

export interface CreatePaymentInput {
    bookingId: string;
    amount: number;
    currency: string;
    method: 'credit_card' | 'debit_card' | 'bank_transfer' | 'e_wallet';
    idempotencyKey: IdempotencyKey;
}

/**
 * Payment — Aggregate root for the payment bounded context.
 *
 * Rich domain model: all state changes go through behavior methods that
 * enforce invariants and emit domain events.
 *
 * Invariants:
 *  - amount must be positive
 *  - status transitions follow PaymentStatus rules
 *  - cannot refund a non-successful payment
 */
export class Payment extends AggregateRoot<string> {
    private constructor(
        id: string,
        private _bookingId: string,
        private _amount: number,
        private _currency: string,
        private _method: string,
        private _idempotencyKey: IdempotencyKey,
        private _status: PaymentStatus,
        private _transactionRef: TransactionRef | null,
        private _createdAt: Date,
        private _completedAt: Date | null
    ) {
        super(id);
    }

    /**
     * Static factory — creates a new PENDING payment, checking
     * for an existing payment with the same IdempotencyKey to dedupe.
     */
    static async create(
        input: CreatePaymentInput,
        repo: IPaymentRepository
    ): Promise<Payment> {
        if (input.amount <= 0) {
            throw new DomainException(`Payment amount must be positive: ${input.amount}`);
        }

        // Idempotency check
        const existing = await repo.findByIdempotencyKey(input.idempotencyKey);
        if (existing) {
            return existing; // Return existing — caller can treat as success
        }

        const id = randomUUID();
        const payment = new Payment(
            id,
            input.bookingId,
            input.amount,
            input.currency,
            input.method,
            input.idempotencyKey,
            PaymentStatus.PENDING,
            null,
            new Date(),
            null
        );
        payment.addDomainEvent(
            new PaymentCreatedEvent(
                id,
                input.bookingId,
                input.amount,
                input.currency,
                input.method
            )
        );
        return payment;
    }

    static rehydrate(props: {
        id: string;
        bookingId: string;
        amount: number;
        currency: string;
        method: string;
        idempotencyKey: IdempotencyKey;
        status: PaymentStatus;
        transactionRef: TransactionRef | null;
        createdAt: Date;
        completedAt: Date | null;
    }): Payment {
        return new Payment(
            props.id,
            props.bookingId,
            props.amount,
            props.currency,
            props.method,
            props.idempotencyKey,
            props.status,
            props.transactionRef,
            props.createdAt,
            props.completedAt
        );
    }

    // --- Behavior methods ---

    markSucceeded(transactionRef: string, ticketCount: number, at: Date): void {
        this._status.assertCanTransitionTo(PaymentStatus.SUCCESS);
        this._status = PaymentStatus.SUCCESS;
        this._transactionRef = TransactionRef.fromString(transactionRef);
        this._completedAt = at;
        this.addDomainEvent(
            new PaymentSucceededEvent(
                this._id,
                this._bookingId,
                this._transactionRef.value,
                this._amount,
                ticketCount
            )
        );
    }

    markFailed(reason: string): void {
        this._status.assertCanTransitionTo(PaymentStatus.FAILED);
        this._status = PaymentStatus.FAILED;
        this._completedAt = new Date();
        this.addDomainEvent(new PaymentFailedEvent(this._id, reason));
    }

    expire(): void {
        this._status.assertCanTransitionTo(PaymentStatus.EXPIRED);
        this._status = PaymentStatus.EXPIRED;
        this.addDomainEvent(new PaymentExpiredEvent(this._id));
    }

    refund(refundAmount: number, reason: string): void {
        this._status.assertCanTransitionTo(PaymentStatus.REFUNDED);
        if (refundAmount < 0 || refundAmount > this._amount) {
            throw new DomainException(
                `Refund amount must be between 0 and ${this._amount}, got: ${refundAmount}`
            );
        }
        this._status = PaymentStatus.REFUNDED;
        this.addDomainEvent(
            new PaymentRefundedEvent(this._id, refundAmount, reason)
        );
    }

    // --- Queries ---

    get bookingId(): string {
        return this._bookingId;
    }
    get amount(): number {
        return this._amount;
    }
    get currency(): string {
        return this._currency;
    }
    get method(): string {
        return this._method;
    }
    get status(): PaymentStatus {
        return this._status;
    }
    get transactionRef(): TransactionRef | null {
        return this._transactionRef;
    }
    get idempotencyKey(): IdempotencyKey {
        return this._idempotencyKey;
    }
    get createdAt(): Date {
        return this._createdAt;
    }
    get completedAt(): Date | null {
        return this._completedAt;
    }
}