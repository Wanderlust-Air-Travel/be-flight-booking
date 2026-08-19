import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root';
import { Money } from '../value-objects/money';
import { PNR } from '../value-objects/pnr';
import { BookingStatus } from '../value-objects/booking-status';
import { ContactInfo } from '../value-objects/contact-info';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';
import type { IBookingRepository } from '../repositories/booking.repository.interface';
import {
    BookingCancelledEvent,
    BookingCheckedInEvent,
    BookingCreatedEvent,
    BookingPassengersUpdatedEvent,
    BookingPaidEvent,
    BookingTicketsIssuedEvent,
} from '../events/booking.events';

export interface PassengerInput {
    fullName: string;
    type: 'adult' | 'child' | 'infant';
}

export interface SegmentInput {
    flightInstanceId: string;
    cabinType: string;
    fareClassCode: string;
}

export interface CreateBookingInput {
    contact: ContactInfo;
    totalAmount: Money;
    passengers: PassengerInput[];
    segments: SegmentInput[];
    userId: string | null;
}

/**
 * Booking — Aggregate root for the booking bounded context.
 *
 * Rich domain model (DDD): all state transitions go through behavior
 * methods that enforce invariants and emit domain events.
 *
 * Invariants:
 *  - status transitions follow BookingStatus rules
 *  - cannot cancel a COMPLETED booking
 *  - cannot issue tickets for a non-PAID booking
 *  - passengers count must be > 0
 */
export class Booking extends AggregateRoot<string> {
    private constructor(
        id: string,
        private _pnr: PNR,
        private _status: BookingStatus,
        private _totalAmount: Money,
        private _contact: ContactInfo,
        private _passengers: PassengerInput[],
        private _segments: SegmentInput[],
        private _userId: string | null,
        private _createdAt: Date
    ) {
        super(id);
    }

    /**
     * Static factory — creates a new PENDING Booking with a unique PNR.
     * Calls IBookingRepository.findByPnr() to ensure PNR uniqueness.
     */
    static async create(
        input: CreateBookingInput,
        repo: IBookingRepository
    ): Promise<Booking> {
        if (input.passengers.length === 0) {
            throw new DomainException('Booking must have at least one passenger');
        }
        if (input.segments.length === 0) {
            throw new DomainException('Booking must have at least one segment');
        }

        const id = randomUUID();
        const pnr = await PNR.generateWithCollisionCheck(repo);
        const booking = new Booking(
            id,
            pnr,
            BookingStatus.PENDING,
            input.totalAmount,
            input.contact,
            input.passengers,
            input.segments,
            input.userId,
            new Date()
        );
        booking.addDomainEvent(
            new BookingCreatedEvent(
                id,
                pnr.value,
                input.contact.email,
                input.totalAmount.amount,
                input.totalAmount.currency
            )
        );
        return booking;
    }

    /**
     * Rehydrate constructor — used by infrastructure to rebuild aggregate
     * from persistence. Does NOT emit any domain events.
     */
    static rehydrate(props: {
        id: string;
        pnr: PNR;
        status: BookingStatus;
        totalAmount: Money;
        contact: ContactInfo;
        passengers: PassengerInput[];
        segments: SegmentInput[];
        userId: string | null;
        createdAt: Date;
    }): Booking {
        return new Booking(
            props.id,
            props.pnr,
            props.status,
            props.totalAmount,
            props.contact,
            props.passengers,
            props.segments,
            props.userId,
            props.createdAt
        );
    }

    // --- Behavior methods ---

    confirm(): void {
        this._status.assertCanTransitionTo(BookingStatus.CONFIRMED);
        this._status = BookingStatus.CONFIRMED;
    }

    markPaid(at: Date): void {
        this._status.assertCanTransitionTo(BookingStatus.PAID);
        this._status = BookingStatus.PAID;
        this.addDomainEvent(new BookingPaidEvent(this._id, at));
    }

    /**
     * Cancel this booking. Returns the refund amount.
     * Throws DomainException if booking is in a terminal state.
     */
    cancel(by: string, reason: string): Money {
        if (!this._status.isCancellable()) {
            throw new DomainException(
                `Cannot cancel booking in ${this._status.value} status`
            );
        }
        const wasPaid = this._status === BookingStatus.PAID;
        this._status = BookingStatus.CANCELLED;
        const refund = wasPaid ? this.calculateRefund() : Money.create(0, this._totalAmount.currency);
        this.addDomainEvent(
            new BookingCancelledEvent(this._id, by, reason, refund.amount)
        );
        return refund;
    }

    updatePassengers(passengers: PassengerInput[]): void {
        if (this._status.isTerminal()) {
            throw new DomainException(
                `Cannot update passengers in ${this._status.value} status`
            );
        }
        if (passengers.length === 0) {
            throw new DomainException('Booking must have at least one passenger');
        }
        this._passengers = passengers;
        this.addDomainEvent(
            new BookingPassengersUpdatedEvent(this._id, passengers.length)
        );
    }

    issueTickets(ticketCount: number): void {
        if (this._status !== BookingStatus.PAID && this._status !== BookingStatus.CHECKED_IN) {
            throw new DomainException(
                `Cannot issue tickets: booking must be PAID or CHECKED_IN (current: ${this._status.value})`
            );
        }
        this.addDomainEvent(new BookingTicketsIssuedEvent(this._id, ticketCount));
    }

    checkIn(at: Date): void {
        if (this._status !== BookingStatus.PAID && this._status !== BookingStatus.CONFIRMED) {
            throw new DomainException(
                `Cannot check in: booking must be PAID or CONFIRMED (current: ${this._status.value})`
            );
        }
        if (this._status === BookingStatus.PAID) {
            this._status.assertCanTransitionTo(BookingStatus.CHECKED_IN);
            this._status = BookingStatus.CHECKED_IN;
        }
        this.addDomainEvent(new BookingCheckedInEvent(this._id, at));
    }

    expire(): void {
        if (this._status !== BookingStatus.PENDING) {
            throw new DomainException(
                `Cannot expire booking in ${this._status.value} status`
            );
        }
        this._status = BookingStatus.EXPIRED;
    }

    // --- Queries ---

    get status(): BookingStatus {
        return this._status;
    }

    get pnr(): PNR {
        return this._pnr;
    }

    get totalAmount(): Money {
        return this._totalAmount;
    }

    get contact(): ContactInfo {
        return this._contact;
    }

    get passengers(): PassengerInput[] {
        return [...this._passengers];
    }

    get segments(): SegmentInput[] {
        return [...this._segments];
    }

    get userId(): string | null {
        return this._userId;
    }

    get createdAt(): Date {
        return this._createdAt;
    }

    // --- Private ---

    private calculateRefund(): Money {
        // Simple refund policy: full refund if cancelled before departure
        // (real impl would use cancellation rules). For now: 90% refund if PAID.
        const refundRate = 0.9;
        return Money.create(this._totalAmount.amount * refundRate, this._totalAmount.currency);
    }
}

// Local import to avoid uuid ESM issue
import { randomUUID } from 'node:crypto';