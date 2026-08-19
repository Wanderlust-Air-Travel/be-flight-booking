import { randomUUID } from 'node:crypto';
import type { IDomainEvent } from '../../../../shared/domain/events/domain-event';

abstract class BasePaymentEvent implements IDomainEvent {
    public readonly eventId: string;
    public readonly aggregateId: string;
    public readonly occurredAt: Date;
    public readonly version = 1;

    constructor(
        aggregateId: string,
        public readonly eventName: string,
        public readonly payload: Record<string, unknown>,
        occurredAt?: Date
    ) {
        this.eventId = randomUUID();
        this.aggregateId = aggregateId;
        this.occurredAt = occurredAt ?? new Date();
    }
}

export class PaymentCreatedEvent extends BasePaymentEvent {
    static readonly EVENT_NAME = 'payment.created';
    constructor(
        public readonly paymentId: string,
        public readonly bookingId: string,
        public readonly amount: number,
        public readonly currency: string,
        public readonly method: string
    ) {
        super(
            paymentId,
            PaymentCreatedEvent.EVENT_NAME,
            { bookingId, amount, currency, method }
        );
    }
}

export class PaymentSucceededEvent extends BasePaymentEvent {
    static readonly EVENT_NAME = 'payment.succeeded';
    constructor(
        public readonly paymentId: string,
        public readonly bookingId: string,
        public readonly transactionRef: string,
        public readonly amount: number,
        public readonly ticketCount: number
    ) {
        super(
            paymentId,
            PaymentSucceededEvent.EVENT_NAME,
            { bookingId, transactionRef, amount, ticketCount }
        );
    }
}

export class PaymentFailedEvent extends BasePaymentEvent {
    static readonly EVENT_NAME = 'payment.failed';
    constructor(
        public readonly paymentId: string,
        public readonly reason: string
    ) {
        super(paymentId, PaymentFailedEvent.EVENT_NAME, { reason });
    }
}

export class PaymentExpiredEvent extends BasePaymentEvent {
    static readonly EVENT_NAME = 'payment.expired';
    constructor(public readonly paymentId: string) {
        super(paymentId, PaymentExpiredEvent.EVENT_NAME, {});
    }
}

export class PaymentRefundedEvent extends BasePaymentEvent {
    static readonly EVENT_NAME = 'payment.refunded';
    constructor(
        public readonly paymentId: string,
        public readonly refundAmount: number,
        public readonly reason: string
    ) {
        super(
            paymentId,
            PaymentRefundedEvent.EVENT_NAME,
            { refundAmount, reason }
        );
    }
}