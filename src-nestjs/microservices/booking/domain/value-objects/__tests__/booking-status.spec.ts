import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';
import { BookingStatus } from '../booking-status';

describe('BookingStatus', () => {
    it('exposes all status values as enum members', () => {
        const all = BookingStatus.all();
        expect(all).toContain(BookingStatus.PENDING);
        expect(all).toContain(BookingStatus.CONFIRMED);
        expect(all).toContain(BookingStatus.PAID);
        expect(all).toContain(BookingStatus.CANCELLED);
        expect(all).toContain(BookingStatus.COMPLETED);
        expect(all).toContain(BookingStatus.EXPIRED);
    });

    it('canTransitionTo() returns true for valid transitions', () => {
        expect(BookingStatus.PENDING.canTransitionTo(BookingStatus.CONFIRMED)).toBe(true);
        expect(BookingStatus.PENDING.canTransitionTo(BookingStatus.CANCELLED)).toBe(true);
        expect(BookingStatus.PENDING.canTransitionTo(BookingStatus.EXPIRED)).toBe(true);
        expect(BookingStatus.CONFIRMED.canTransitionTo(BookingStatus.PAID)).toBe(true);
        expect(BookingStatus.CONFIRMED.canTransitionTo(BookingStatus.CANCELLED)).toBe(true);
        expect(BookingStatus.PAID.canTransitionTo(BookingStatus.CANCELLED)).toBe(true);
        expect(BookingStatus.PAID.canTransitionTo(BookingStatus.COMPLETED)).toBe(true);
        expect(BookingStatus.PAID.canTransitionTo(BookingStatus.CHECKED_IN)).toBe(true);
    });

    it('canTransitionTo() returns false for invalid transitions', () => {
        expect(BookingStatus.CANCELLED.canTransitionTo(BookingStatus.PAID)).toBe(false);
        expect(BookingStatus.COMPLETED.canTransitionTo(BookingStatus.CANCELLED)).toBe(false);
        expect(BookingStatus.EXPIRED.canTransitionTo(BookingStatus.PAID)).toBe(false);
        expect(BookingStatus.PAID.canTransitionTo(BookingStatus.PENDING)).toBe(false);
    });

    it('cannot transition to itself', () => {
        expect(BookingStatus.PENDING.canTransitionTo(BookingStatus.PENDING)).toBe(false);
        expect(BookingStatus.PAID.canTransitionTo(BookingStatus.PAID)).toBe(false);
    });

    it('assertCanTransitionTo() throws DomainException for invalid', () => {
        expect(() => BookingStatus.CANCELLED.assertCanTransitionTo(BookingStatus.PAID)).toThrow(
            DomainException
        );
    });

    it('assertCanTransitionTo() does nothing for valid', () => {
        expect(() =>
            BookingStatus.PENDING.assertCanTransitionTo(BookingStatus.CONFIRMED)
        ).not.toThrow();
    });

    it('fromString() parses string to enum', () => {
        expect(BookingStatus.fromString('pending')).toBe(BookingStatus.PENDING);
        expect(BookingStatus.fromString('CONFIRMED')).toBe(BookingStatus.CONFIRMED);
    });

    it('fromString() throws on unknown value', () => {
        expect(() => BookingStatus.fromString('unknown')).toThrow(DomainException);
    });

    it('isTerminal() returns true for COMPLETED, CANCELLED, EXPIRED', () => {
        expect(BookingStatus.COMPLETED.isTerminal()).toBe(true);
        expect(BookingStatus.CANCELLED.isTerminal()).toBe(true);
        expect(BookingStatus.EXPIRED.isTerminal()).toBe(true);
        expect(BookingStatus.PENDING.isTerminal()).toBe(false);
        expect(BookingStatus.CONFIRMED.isTerminal()).toBe(false);
        expect(BookingStatus.PAID.isTerminal()).toBe(false);
    });

    it('isCancellable() returns true for non-terminal statuses', () => {
        expect(BookingStatus.PENDING.isCancellable()).toBe(true);
        expect(BookingStatus.CONFIRMED.isCancellable()).toBe(true);
        expect(BookingStatus.PAID.isCancellable()).toBe(true);
        expect(BookingStatus.COMPLETED.isCancellable()).toBe(false);
        expect(BookingStatus.CANCELLED.isCancellable()).toBe(false);
    });
});
