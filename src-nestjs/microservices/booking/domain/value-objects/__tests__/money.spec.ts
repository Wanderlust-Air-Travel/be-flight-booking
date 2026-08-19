import { Money } from '../money';
import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';

describe('Money (booking context)', () => {
    describe('create()', () => {
        it('creates a Money with positive amount', () => {
            const m = Money.create(100, 'VND');
            expect(m.amount).toBe(100);
            expect(m.currency).toBe('VND');
        });

        it('creates Money with zero amount', () => {
            const m = Money.create(0, 'USD');
            expect(m.amount).toBe(0);
        });

        it('throws DomainException for negative amount', () => {
            expect(() => Money.create(-1, 'VND')).toThrow();
        });

        it('throws DomainException for invalid currency code (not 3 chars)', () => {
            expect(() => Money.create(100, 'VN')).toThrow();
            expect(() => Money.create(100, 'VNDD')).toThrow();
            expect(() => Money.create(100, '')).toThrow();
        });

        it('throws DomainException for empty amount (null/undefined)', () => {
            expect(() => Money.create(null as any, 'VND')).toThrow();
            expect(() => Money.create(undefined as any, 'VND')).toThrow();
        });

        it('accepts decimal amounts and rounds to 2 places', () => {
            const m = Money.create(99.999, 'USD');
            expect(m.amount).toBe(100); // rounded
        });
    });

    describe('arithmetic', () => {
        it('add() returns new Money with sum amount (same currency)', () => {
            const a = Money.create(100, 'VND');
            const b = Money.create(50, 'VND');
            const sum = a.add(b);
            expect(sum.amount).toBe(150);
            expect(sum.currency).toBe('VND');
        });

        it('add() throws DomainException on currency mismatch', () => {
            const a = Money.create(100, 'VND');
            const b = Money.create(50, 'USD');
            expect(() => a.add(b)).toThrow();
        });

        it('subtract() returns new Money with difference (same currency)', () => {
            const a = Money.create(100, 'VND');
            const b = Money.create(30, 'VND');
            const diff = a.subtract(b);
            expect(diff.amount).toBe(70);
        });

        it('subtract() allows negative result (e.g. refund > amount)', () => {
            const a = Money.create(30, 'VND');
            const b = Money.create(100, 'VND');
            const diff = a.subtract(b);
            expect(diff.amount).toBe(-70);
        });

        it('multiply() returns new Money with amount * factor', () => {
            const a = Money.create(100, 'VND');
            const m = a.multiply(3);
            expect(m.amount).toBe(300);
        });

        it('multiply(0) returns zero', () => {
            const a = Money.create(100, 'VND');
            const m = a.multiply(0);
            expect(m.amount).toBe(0);
        });
    });

    describe('equality and immutability', () => {
        it('equals() returns true for structurally same Money', () => {
            const a = Money.create(100, 'VND');
            const b = Money.create(100, 'VND');
            expect(a.equals(b)).toBe(true);
        });

        it('equals() returns false for different amounts', () => {
            const a = Money.create(100, 'VND');
            const b = Money.create(200, 'VND');
            expect(a.equals(b)).toBe(false);
        });

        it('equals() returns false for different currencies', () => {
            const a = Money.create(100, 'VND');
            const b = Money.create(100, 'USD');
            expect(a.equals(b)).toBe(false);
        });

        it('arithmetic operations do not mutate original Money', () => {
            const a = Money.create(100, 'VND');
            a.add(Money.create(50, 'VND'));
            expect(a.amount).toBe(100);
        });
    });

    describe('formatting', () => {
        it('toString() returns "AMOUNT CURRENCY"', () => {
            const m = Money.create(100, 'VND');
            expect(m.toString()).toBe('100 VND');
        });
    });
});