import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

/**
 * PaymentStatus — State machine for the Payment aggregate.
 *
 *  PENDING ──process──▶ SUCCESS ──refund──▶ REFUNDED
 *     │
 *     ├──process──▶ FAILED
 *     └──expire────▶ EXPIRED
 */
export class PaymentStatus {
    private constructor(
        public readonly value: string,
        private readonly allowedTransitions: Set<PaymentStatus>
    ) {}

    static readonly PENDING = new PaymentStatus('pending', new Set());
    static readonly SUCCESS = new PaymentStatus('success', new Set());
    static readonly FAILED = new PaymentStatus('failed', new Set());
    static readonly EXPIRED = new PaymentStatus('expired', new Set());
    static readonly REFUNDED = new PaymentStatus('refunded', new Set());

    static {
        PaymentStatus.PENDING.allowedTransitions.add(PaymentStatus.SUCCESS);
        PaymentStatus.PENDING.allowedTransitions.add(PaymentStatus.FAILED);
        PaymentStatus.PENDING.allowedTransitions.add(PaymentStatus.EXPIRED);
        PaymentStatus.SUCCESS.allowedTransitions.add(PaymentStatus.REFUNDED);
    }

    static all(): PaymentStatus[] {
        return [
            PaymentStatus.PENDING,
            PaymentStatus.SUCCESS,
            PaymentStatus.FAILED,
            PaymentStatus.EXPIRED,
            PaymentStatus.REFUNDED,
        ];
    }

    canTransitionTo(target: PaymentStatus): boolean {
        return this.allowedTransitions.has(target);
    }

    assertCanTransitionTo(target: PaymentStatus): void {
        if (!this.canTransitionTo(target)) {
            throw new DomainException(
                `Cannot transition payment from ${this.value} to ${target.value}`
            );
        }
    }

    isTerminal(): boolean {
        return (
            this === PaymentStatus.FAILED ||
            this === PaymentStatus.EXPIRED ||
            this === PaymentStatus.REFUNDED
        );
    }

    isSuccessful(): boolean {
        return this === PaymentStatus.SUCCESS;
    }
}
