import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';
import {
    BookingCancelledEvent,
    BookingCheckedInEvent,
    BookingCreatedEvent,
    BookingPaidEvent,
    BookingPassengersUpdatedEvent,
    BookingTicketsIssuedEvent,
} from '../../events/booking.events';
import type { IBookingRepository } from '../../repositories/booking.repository.interface';
import { BookingStatus } from '../../value-objects/booking-status';
import { ContactInfo } from '../../value-objects/contact-info';
import { Money } from '../../value-objects/money';
import { PNR } from '../../value-objects/pnr';
import { Booking, type CreateBookingInput } from '../booking.aggregate';

function makeRepo(existing: string[] = []): IBookingRepository {
    return {
        save: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn().mockResolvedValue(null),
        findByPnr: jest.fn().mockImplementation(async (pnr: string | PNR) => {
            const v = typeof pnr === 'string' ? pnr : pnr.value;
            return existing.includes(v) ? ({ id: 'existing', pnr_code: v } as any) : null;
        }),
        findByUserId: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
        delete: jest.fn().mockResolvedValue(undefined),
    };
}

function makeInput(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
    return {
        contact: ContactInfo.create('Alice Nguyen', 'alice@example.com', '+84912345678'),
        totalAmount: Money.create(1000000, 'VND'),
        passengers: [{ fullName: 'Alice', type: 'adult' }],
        segments: [{ flightInstanceId: 'fi-1', cabinType: 'economy', fareClassCode: 'Y' }],
        userId: 'user-1',
        ...overrides,
    };
}

describe('Booking aggregate', () => {
    describe('create()', () => {
        it('creates a PENDING booking with a unique PNR and BookingCreatedEvent', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            expect(b.id).toBeDefined();
            expect(b.pnr.value).toMatch(/^[A-Z0-9]{6}$/);
            expect(b.status).toBe(BookingStatus.PENDING);
            const events = b.pullDomainEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(BookingCreatedEvent);
            expect(events[0].aggregateId).toBe(b.id);
        });

        it('rejects booking with zero passengers', async () => {
            const repo = makeRepo();
            await expect(Booking.create(makeInput({ passengers: [] }), repo)).rejects.toThrow(
                DomainException
            );
        });

        it('rejects booking with zero segments', async () => {
            const repo = makeRepo();
            await expect(Booking.create(makeInput({ segments: [] }), repo)).rejects.toThrow(
                DomainException
            );
        });

        it('generates a new PNR on collision', async () => {
            // Always collide on first attempt, succeed on second
            let callCount = 0;
            const repo = {
                ...makeRepo(),
                findByPnr: jest.fn().mockImplementation(async () => {
                    callCount++;
                    return callCount === 1 ? ({ id: 'collide' } as any) : null;
                }),
            };
            const b = await Booking.create(makeInput(), repo);
            expect(repo.findByPnr).toHaveBeenCalledTimes(2);
            expect(b.pnr).toBeDefined();
        });
    });

    describe('markPaid()', () => {
        it('transitions PENDING → CONFIRMED → PAID and emits BookingPaidEvent', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents(); // clear created event
            b.confirm();
            b.markPaid(new Date('2026-08-19T10:00:00Z'));
            expect(b.status).toBe(BookingStatus.PAID);
            const events = b.pullDomainEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(BookingPaidEvent);
        });

        it('throws DomainException if not in CONFIRMED state', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents();
            expect(() => b.markPaid(new Date())).toThrow(DomainException);
        });
    });

    describe('cancel()', () => {
        it('cancels and emits BookingCancelledEvent with refund amount', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents();
            b.confirm();
            b.markPaid(new Date());
            b.pullDomainEvents();
            const refund = b.cancel('user-1', 'change of plans');
            expect(b.status).toBe(BookingStatus.CANCELLED);
            expect(refund.amount).toBe(900000); // 90% of 1,000,000
            const events = b.pullDomainEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toBeInstanceOf(BookingCancelledEvent);
            expect((events[0] as BookingCancelledEvent).refundAmount).toBe(900000);
        });

        it('throws DomainException when cancelling in terminal state', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents();
            b.cancel('user-1', 'no longer needed');
            expect(() => b.cancel('user-1', 'again')).toThrow(DomainException);
        });

        it('PENDING booking cancellation has zero refund', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents();
            const refund = b.cancel('user-1', 'changed mind');
            expect(refund.amount).toBe(0);
        });
    });

    describe('updatePassengers()', () => {
        it('replaces passenger list and emits BookingPassengersUpdatedEvent', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents();
            b.updatePassengers([
                { fullName: 'Alice', type: 'adult' },
                { fullName: 'Bob', type: 'child' },
            ]);
            expect(b.passengers).toHaveLength(2);
            const events = b.pullDomainEvents();
            expect(events[0]).toBeInstanceOf(BookingPassengersUpdatedEvent);
        });

        it('rejects empty passenger list', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.pullDomainEvents();
            expect(() => b.updatePassengers([])).toThrow(DomainException);
        });

        it('rejects update in terminal state', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.cancel('user-1', 'reason');
            expect(() => b.updatePassengers([{ fullName: 'X', type: 'adult' }])).toThrow(
                DomainException
            );
        });
    });

    describe('issueTickets()', () => {
        it('emits BookingTicketsIssuedEvent when in PAID state', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.confirm();
            b.markPaid(new Date());
            b.pullDomainEvents();
            b.issueTickets(2);
            const events = b.pullDomainEvents();
            expect(events[0]).toBeInstanceOf(BookingTicketsIssuedEvent);
            expect((events[0] as BookingTicketsIssuedEvent).ticketCount).toBe(2);
        });

        it('throws when not in PAID/CHECKED_IN state', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            expect(() => b.issueTickets(1)).toThrow(DomainException);
        });
    });

    describe('checkIn()', () => {
        it('transitions PAID → CHECKED_IN and emits event', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            b.confirm();
            b.markPaid(new Date());
            b.pullDomainEvents();
            b.checkIn(new Date());
            expect(b.status).toBe(BookingStatus.CHECKED_IN);
            const events = b.pullDomainEvents();
            expect(events[0]).toBeInstanceOf(BookingCheckedInEvent);
        });

        it('throws when in PENDING state', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            expect(() => b.checkIn(new Date())).toThrow(DomainException);
        });
    });

    describe('rehydrate()', () => {
        it('rebuilds a Booking without emitting events', () => {
            const b = Booking.rehydrate({
                id: 'id-1',
                pnr: PNR.fromString('ABC123'),
                status: BookingStatus.PAID,
                totalAmount: Money.create(100, 'VND'),
                contact: ContactInfo.create('Alice', 'a@b.com', '+1234567'),
                passengers: [{ fullName: 'Alice', type: 'adult' }],
                segments: [{ flightInstanceId: 'f1', cabinType: 'eco', fareClassCode: 'Y' }],
                userId: 'u1',
                createdAt: new Date('2026-01-01'),
            });
            expect(b.id).toBe('id-1');
            expect(b.status).toBe(BookingStatus.PAID);
            expect(b.pullDomainEvents()).toHaveLength(0);
        });
    });

    describe('pullDomainEvents()', () => {
        it('returns immutable array (cannot be mutated)', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            const events = b.pullDomainEvents();
            expect(Object.isFrozen(events)).toBe(true);
            expect(() => (events as any).push(null)).toThrow();
        });

        it('clears internal events after pull', async () => {
            const repo = makeRepo();
            const b = await Booking.create(makeInput(), repo);
            expect(b.pullDomainEvents()).toHaveLength(1);
            expect(b.pullDomainEvents()).toHaveLength(0);
        });
    });
});
