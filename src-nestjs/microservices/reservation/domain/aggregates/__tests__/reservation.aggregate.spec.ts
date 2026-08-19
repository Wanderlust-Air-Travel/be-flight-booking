import { Reservation } from '../reservation.aggregate';
import { ReservationStatus } from '../../value-objects/reservation-status';
import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';
import {
    ReservationCancelledEvent,
    ReservationConvertedEvent,
    ReservationCreatedEvent,
    ReservationExpiredEvent,
} from '../../events/reservation.events';

describe('Reservation aggregate', () => {
    describe('create()', () => {
        it('creates an ACTIVE reservation with TTL', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'alice@example.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 2 },
                ],
                ttlMinutes: 30,
            });
            expect(r.status).toBe(ReservationStatus.ACTIVE);
            expect(r.expiresAt.getTime() - r.createdAt.getTime()).toBe(30 * 60 * 1000);
            expect(r.pullDomainEvents()[0]).toBeInstanceOf(ReservationCreatedEvent);
        });

        it('rejects empty segments', () => {
            expect(() =>
                Reservation.create({
                    userId: 'user-1',
                    contactEmail: 'a@b.com',
                    segments: [],
                    ttlMinutes: 30,
                })
            ).toThrow(DomainException);
        });

        it('rejects invalid email', () => {
            expect(() =>
                Reservation.create({
                    userId: 'user-1',
                    contactEmail: 'notanemail',
                    segments: [
                        { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                    ],
                    ttlMinutes: 30,
                })
            ).toThrow(DomainException);
        });

        it('uses 30-minute default TTL when ttlMinutes <= 0', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 0,
            });
            expect(r.expiresAt.getTime() - r.createdAt.getTime()).toBe(30 * 60 * 1000);
        });
    });

    describe('expire()', () => {
        it('transitions ACTIVE → EXPIRED', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 30,
            });
            r.pullDomainEvents();
            r.expire();
            expect(r.status).toBe(ReservationStatus.EXPIRED);
            expect(r.pullDomainEvents()[0]).toBeInstanceOf(ReservationExpiredEvent);
        });

        it('refuses to expire already-converted reservation', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 30,
            });
            r.convertToBooking('booking-1');
            expect(() => r.expire()).toThrow(DomainException);
        });
    });

    describe('convertToBooking()', () => {
        it('transitions ACTIVE → CONVERTED and stores bookingId', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 30,
            });
            r.pullDomainEvents();
            r.convertToBooking('booking-1');
            expect(r.status).toBe(ReservationStatus.CONVERTED);
            expect(r.bookingId).toBe('booking-1');
            expect(r.pullDomainEvents()[0]).toBeInstanceOf(ReservationConvertedEvent);
        });
    });

    describe('cancel()', () => {
        it('transitions ACTIVE → CANCELLED', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 30,
            });
            r.pullDomainEvents();
            r.cancel('user-1', 'changed plans');
            expect(r.status).toBe(ReservationStatus.CANCELLED);
            expect(r.pullDomainEvents()[0]).toBeInstanceOf(ReservationCancelledEvent);
        });

        it('refuses to cancel terminal reservations', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 30,
            });
            r.expire();
            expect(() => r.cancel('user-1', 'x')).toThrow();
        });
    });

    describe('isExpired()', () => {
        it('returns true when expiresAt is in the past', () => {
            const r = Reservation.create({
                userId: 'user-1',
                contactEmail: 'a@b.com',
                segments: [
                    { flightInstanceId: 'fi-1', fareClassCode: 'Y', cabinType: 'eco', passengerCount: 1 },
                ],
                ttlMinutes: 30,
            });
            const future = new Date(Date.now() + 1000000);
            expect(r.isExpired(future)).toBe(false);
            // Simulate reservation that already expired (TTL in the past)
            const longPast = new Date(Date.now() - 1000000);
            // Reservation created "now" can't already be expired, so test the predicate
            // by giving it a comparison time AFTER expiresAt
            expect(r.isExpired(new Date(r.expiresAt.getTime() + 1))).toBe(true);
            // Comparison time BEFORE expiresAt
            expect(r.isExpired(new Date(r.expiresAt.getTime() - 1))).toBe(false);
            // Make sure the unused var is referenced
            expect(future.getTime()).toBeGreaterThan(0);
            expect(longPast.getTime()).toBeLessThan(Date.now());
        });
    });
});