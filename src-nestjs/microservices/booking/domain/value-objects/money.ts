import { ValueObject } from '../../../../shared/domain/base/value-object';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

/**
 * Money — Value object representing a monetary amount with ISO-4217 currency.
 *
 * Booking-context duplicate (DDD pure: each bounded context owns its types).
 * Immutable: all arithmetic operations return new Money instances.
 *
 * Invariants:
 *  - amount is rounded to 2 decimal places on construction
 *  - currency is a 3-letter ISO code
 *  - amount >= 0 (use negative only via subtract())
 */
export class Money extends ValueObject<{ amount: number; currency: string }> {
    private constructor(value: { amount: number; currency: string }) {
        super(value);
    }

    static create(amount: number, currency: string): Money {
        if (amount === null || amount === undefined || Number.isNaN(amount)) {
            throw new DomainException(`Invalid money amount: ${amount}`);
        }
        if (amount < 0) {
            throw new DomainException(`Money amount cannot be negative: ${amount}`);
        }
        if (!currency || currency.length !== 3) {
            throw new DomainException(`Currency must be 3-letter ISO code, got: ${currency}`);
        }
        const rounded = Math.round(amount * 100) / 100;
        return new Money({ amount: rounded, currency: currency.toUpperCase() });
    }

    /** Static factory from a raw object (for repository hydration). */
    static of(value: { amount: number; currency: string }): Money {
        return Money.create(value.amount, value.currency);
    }

    get amount(): number {
        return this.value.amount;
    }

    get currency(): string {
        return this.value.currency;
    }

    add(other: Money): Money {
        this.assertSameCurrency(other);
        return Money.create(this.amount + other.amount, this.currency);
    }

    subtract(other: Money): Money {
        this.assertSameCurrency(other);
        // subtract can produce negative — bypass the >= 0 invariant by direct construction
        return new Money({ amount: this.amount - other.amount, currency: this.currency });
    }

    multiply(factor: number): Money {
        return Money.create(this.amount * factor, this.currency);
    }

    isZero(): boolean {
        return this.amount === 0;
    }

    isPositive(): boolean {
        return this.amount > 0;
    }

    toString(): string {
        return `${this.amount} ${this.currency}`;
    }

    private assertSameCurrency(other: Money): void {
        if (other.currency !== this.currency) {
            throw new DomainException(`Currency mismatch: ${this.currency} vs ${other.currency}`);
        }
    }
}
