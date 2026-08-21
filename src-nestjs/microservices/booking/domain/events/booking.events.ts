import { randomUUID } from 'node:crypto';
import type { IDomainEvent } from '../../../../shared/domain/events/domain-event';

/**
 * BaseBookingEvent — Shared shape for all booking events.
 *
 * Booking events all carry `aggregateId` (= booking_id) and a payload
 * describing the change. Concrete events extend this with their own
 * fields (PNR, contact email, refund amount, etc.).
 */
export abstract class BaseBookingEvent implements IDomainEvent {
    public readonly eventId: string;
    public readonly aggregateId: string;
    public readonly occurredAt: Date;
    public readonly version = 1;

    protected constructor(
        aggregateId: string,
        public readonly payload: Record<string, unknown>,
        public readonly eventName: string,
        occurredAt?: Date
    ) {
        this.eventId = randomUUID();
        this.aggregateId = aggregateId;
        this.occurredAt = occurredAt ?? new Date();
    }
}

export class BookingCreatedEvent extends BaseBookingEvent {
    static readonly EVENT_NAME = 'booking.created';
    constructor(
        bookingId: string,
        public readonly pnr: string,
        public readonly contactEmail: string,
        public readonly totalAmount: number,
        public readonly currency: string
    ) {
        super(
            bookingId,
            { pnr, contactEmail, totalAmount, currency },
            BookingCreatedEvent.EVENT_NAME
        );
    }
}

export class BookingPaidEvent extends BaseBookingEvent {
    static readonly EVENT_NAME = 'booking.paid';
    constructor(
        bookingId: string,
        public readonly paidAt: Date
    ) {
        super(bookingId, { paidAt: paidAt.toISOString() }, BookingPaidEvent.EVENT_NAME);
    }
}

export class BookingCancelledEvent extends BaseBookingEvent {
    static readonly EVENT_NAME = 'booking.cancelled';
    constructor(
        bookingId: string,
        public readonly cancelledBy: string,
        public readonly reason: string,
        public readonly refundAmount: number
    ) {
        super(bookingId, { cancelledBy, reason, refundAmount }, BookingCancelledEvent.EVENT_NAME);
    }
}

export class BookingPassengersUpdatedEvent extends BaseBookingEvent {
    static readonly EVENT_NAME = 'booking.passengers_updated';
    constructor(
        bookingId: string,
        public readonly totalPassengers: number
    ) {
        super(bookingId, { totalPassengers }, BookingPassengersUpdatedEvent.EVENT_NAME);
    }
}

export class BookingTicketsIssuedEvent extends BaseBookingEvent {
    static readonly EVENT_NAME = 'booking.tickets_issued';
    constructor(
        bookingId: string,
        public readonly ticketCount: number
    ) {
        super(bookingId, { ticketCount }, BookingTicketsIssuedEvent.EVENT_NAME);
    }
}

export class BookingCheckedInEvent extends BaseBookingEvent {
    static readonly EVENT_NAME = 'booking.checked_in';
    constructor(
        bookingId: string,
        public readonly checkedInAt: Date
    ) {
        super(
            bookingId,
            { checkedInAt: checkedInAt.toISOString() },
            BookingCheckedInEvent.EVENT_NAME
        );
    }
}
