import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

/**
 * BookingStatus — State machine for the Booking aggregate.
 *
 *  PENDING  ──confirm──▶ CONFIRMED ──pay──▶ PAID
 *  │                       │                  │
 *  │                       │                  ├──complete──▶ COMPLETED
 *  │                       │                  └──checkIn───▶ CHECKED_IN
 *  ├──cancel──▶ CANCELLED ◀───────────────────┘
 *  └──expire──▶ EXPIRED
 *
 * Invariants enforced:
 *  - Cannot cancel a COMPLETED booking
 *  - Cannot transition out of terminal states
 *  - Cannot transition to itself
 */
export class BookingStatus {
    private constructor(
        public readonly value: string,
        private readonly allowedTransitions: ReadonlySet<BookingStatus>
    ) {}

    static readonly PENDING = new BookingStatus('pending', new Set([]));
    static readonly CONFIRMED = new BookingStatus('confirmed', new Set([]));
    static readonly PAID = new BookingStatus('paid', new Set([]));
    static readonly CANCELLED = new BookingStatus('cancelled', new Set([]));
    static readonly COMPLETED = new BookingStatus('completed', new Set([]));
    static readonly EXPIRED = new BookingStatus('expired', new Set([]));
    static readonly CHECKED_IN = new BookingStatus('checked_in', new Set([]));

    static {
        BookingStatus.PENDING.allowedTransitions.add(BookingStatus.CONFIRMED);
        BookingStatus.PENDING.allowedTransitions.add(BookingStatus.CANCELLED);
        BookingStatus.PENDING.allowedTransitions.add(BookingStatus.EXPIRED);

        BookingStatus.CONFIRMED.allowedTransitions.add(BookingStatus.PAID);
        BookingStatus.CONFIRMED.allowedTransitions.add(BookingStatus.CANCELLED);

        BookingStatus.PAID.allowedTransitions.add(BookingStatus.CANCELLED);
        BookingStatus.PAID.allowedTransitions.add(BookingStatus.COMPLETED);
        BookingStatus.PAID.allowedTransitions.add(BookingStatus.CHECKED_IN);
    }

    static all(): BookingStatus[] {
        return [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.PAID,
            BookingStatus.CANCELLED,
            BookingStatus.COMPLETED,
            BookingStatus.EXPIRED,
            BookingStatus.CHECKED_IN,
        ];
    }

    static fromString(value: string): BookingStatus {
        const found = BookingStatus.all().find((s) => s.value === value.toLowerCase());
        if (!found) throw new DomainException(`Unknown booking status: ${value}`);
        return found;
    }

    canTransitionTo(target: BookingStatus): boolean {
        return this.allowedTransitions.has(target);
    }

    assertCanTransitionTo(target: BookingStatus): void {
        if (!this.canTransitionTo(target)) {
            throw new DomainException(
                `Cannot transition booking from ${this.value} to ${target.value}`
            );
        }
    }

    isTerminal(): boolean {
        return (
            this === BookingStatus.COMPLETED ||
            this === BookingStatus.CANCELLED ||
            this === BookingStatus.EXPIRED
        );
    }

    isCancellable(): boolean {
        return !this.isTerminal();
    }

    toString(): string {
        return this.value;
    }
}