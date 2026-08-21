import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

/**
 * ReservationStatus — State machine for the Reservation aggregate.
 *
 *  ACTIVE ──expire──────▶ EXPIRED
 *   │
 *   ├──confirm────────▶ CONFIRMED
 *   ├──cancel─────────▶ CANCELLED
 *   └──convertToBooking▶ CONVERTED
 */
export class ReservationStatus {
    private constructor(
        public readonly value: string,
        private readonly allowedTransitions: Set<ReservationStatus>
    ) {}

    static readonly ACTIVE = new ReservationStatus('active', new Set());
    static readonly EXPIRED = new ReservationStatus('expired', new Set());
    static readonly CONVERTED = new ReservationStatus('converted', new Set());
    static readonly CANCELLED = new ReservationStatus('cancelled', new Set());

    static {
        ReservationStatus.ACTIVE.allowedTransitions.add(ReservationStatus.EXPIRED);
        ReservationStatus.ACTIVE.allowedTransitions.add(ReservationStatus.CONVERTED);
        ReservationStatus.ACTIVE.allowedTransitions.add(ReservationStatus.CANCELLED);
    }

    canTransitionTo(target: ReservationStatus): boolean {
        return this.allowedTransitions.has(target);
    }

    assertCanTransitionTo(target: ReservationStatus): void {
        if (!this.canTransitionTo(target)) {
            throw new DomainException(
                `Cannot transition reservation from ${this.value} to ${target.value}`
            );
        }
    }

    isTerminal(): boolean {
        return (
            this === ReservationStatus.EXPIRED ||
            this === ReservationStatus.CONVERTED ||
            this === ReservationStatus.CANCELLED
        );
    }
}
