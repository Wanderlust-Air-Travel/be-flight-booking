import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';
import { ReservationStatus } from '../value-objects/reservation-status';
import {
    ReservationSegment,
} from '../value-objects/reservation-segment';
import {
    ReservationCancelledEvent,
    ReservationConvertedEvent,
    ReservationCreatedEvent,
    ReservationExpiredEvent,
} from '../events/reservation.events';

export interface CreateReservationInput {
    userId: string | null;
    contactEmail: string;
    segments: Array<{
        flightInstanceId: string;
        fareClassCode: string;
        cabinType: string;
        passengerCount: number;
    }>;
    ttlMinutes: number;
}

const DEFAULT_TTL_MINUTES = 30;

/**
 * Reservation — Aggregate root for the reservation bounded context.
 *
 * Reservations hold flight holds for a limited time (TTL) before being
 * either converted to a booking or expired automatically.
 */
export class Reservation extends AggregateRoot<string> {
    private constructor(
        id: string,
        private _userId: string | null,
        private _contactEmail: string,
        private _segments: ReservationSegment[],
        private _status: ReservationStatus,
        private _createdAt: Date,
        private _expiresAt: Date,
        private _bookingId: string | null
    ) {
        super(id);
    }

    static create(input: CreateReservationInput): Reservation {
        if (input.segments.length === 0) {
            throw new DomainException('Reservation must have at least one segment');
        }
        if (!input.contactEmail || !input.contactEmail.includes('@')) {
            throw new DomainException(`Invalid contactEmail: ${input.contactEmail}`);
        }
        const ttl = input.ttlMinutes > 0 ? input.ttlMinutes : DEFAULT_TTL_MINUTES;

        const id = randomUUID();
        const now = new Date();
        const reservation = new Reservation(
            id,
            input.userId,
            input.contactEmail,
            input.segments.map(ReservationSegment.create),
            ReservationStatus.ACTIVE,
            now,
            new Date(now.getTime() + ttl * 60 * 1000),
            null
        );
        reservation.addDomainEvent(
            new ReservationCreatedEvent(
                id,
                input.userId,
                input.contactEmail,
                ttl
            )
        );
        return reservation;
    }

    static rehydrate(props: {
        id: string;
        userId: string | null;
        contactEmail: string;
        segments: ReservationSegment[];
        status: ReservationStatus;
        createdAt: Date;
        expiresAt: Date;
        bookingId: string | null;
    }): Reservation {
        return new Reservation(
            props.id,
            props.userId,
            props.contactEmail,
            props.segments,
            props.status,
            props.createdAt,
            props.expiresAt,
            props.bookingId
        );
    }

    // --- Behavior ---

    expire(): void {
        if (this._status !== ReservationStatus.ACTIVE) {
            throw new DomainException(
                `Cannot expire reservation in ${this._status.value} status`
            );
        }
        this._status = ReservationStatus.EXPIRED;
        this.addDomainEvent(new ReservationExpiredEvent(this._id));
    }

    /**
     * Convert reservation to a booking. Called by booking context once
     * a booking is created from this reservation's segments.
     */
    convertToBooking(bookingId: string): void {
        this._status.assertCanTransitionTo(ReservationStatus.CONVERTED);
        this._status = ReservationStatus.CONVERTED;
        this._bookingId = bookingId;
        this.addDomainEvent(new ReservationConvertedEvent(this._id, bookingId));
    }

    cancel(by: string, reason: string): void {
        this._status.assertCanTransitionTo(ReservationStatus.CANCELLED);
        this._status = ReservationStatus.CANCELLED;
        this.addDomainEvent(
            new ReservationCancelledEvent(this._id, by, reason)
        );
    }

    isExpired(at: Date = new Date()): boolean {
        return this._status === ReservationStatus.ACTIVE && this._expiresAt <= at;
    }

    // --- Queries ---

    get userId(): string | null {
        return this._userId;
    }
    get contactEmail(): string {
        return this._contactEmail;
    }
    get segments(): ReservationSegment[] {
        return [...this._segments];
    }
    get status(): ReservationStatus {
        return this._status;
    }
    get createdAt(): Date {
        return this._createdAt;
    }
    get expiresAt(): Date {
        return this._expiresAt;
    }
    get bookingId(): string | null {
        return this._bookingId;
    }
}