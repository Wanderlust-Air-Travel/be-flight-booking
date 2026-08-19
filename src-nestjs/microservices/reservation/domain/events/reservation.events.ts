import { randomUUID } from 'node:crypto';
import type { IDomainEvent } from '../../../../shared/domain/events/domain-event';

abstract class BaseReservationEvent implements IDomainEvent {
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

export class ReservationCreatedEvent extends BaseReservationEvent {
    static readonly EVENT_NAME = 'reservation.created';
    constructor(
        public readonly reservationId: string,
        public readonly userId: string | null,
        public readonly contactEmail: string,
        public readonly ttlMinutes: number
    ) {
        super(
            reservationId,
            ReservationCreatedEvent.EVENT_NAME,
            { userId, contactEmail, ttlMinutes }
        );
    }
}

export class ReservationExpiredEvent extends BaseReservationEvent {
    static readonly EVENT_NAME = 'reservation.expired';
    constructor(public readonly reservationId: string) {
        super(reservationId, ReservationExpiredEvent.EVENT_NAME, {});
    }
}

export class ReservationConvertedEvent extends BaseReservationEvent {
    static readonly EVENT_NAME = 'reservation.converted';
    constructor(
        public readonly reservationId: string,
        public readonly bookingId: string
    ) {
        super(reservationId, ReservationConvertedEvent.EVENT_NAME, { bookingId });
    }
}

export class ReservationCancelledEvent extends BaseReservationEvent {
    static readonly EVENT_NAME = 'reservation.cancelled';
    constructor(
        public readonly reservationId: string,
        public readonly cancelledBy: string,
        public readonly reason: string
    ) {
        super(
            reservationId,
            ReservationCancelledEvent.EVENT_NAME,
            { cancelledBy, reason }
        );
    }
}