import { CancelBookingHandler } from '../cancel-booking.handler';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { Money } from '../../../domain/value-objects/money';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { BookingCancelledEvent } from '../../../domain/events/booking.events';

async function createBooking(repo: InMemoryBookingRepository, userId: string) {
    const booking = await Booking.create(
        {
            contact: ContactInfo.create('Alice', 'alice@example.com', '+84912345678'),
            totalAmount: Money.create(1000, 'VND'),
            passengers: [{ fullName: 'Alice', type: 'adult' }],
            segments: [{ flightInstanceId: 'fi-1', cabinType: 'economy', fareClassCode: 'Y' }],
            userId,
        },
        repo
    );
    await repo.save(booking);
    booking.pullDomainEvents(); // clear created event
    return booking;
}

describe('CancelBookingHandler', () => {
    let handler: CancelBookingHandler;
    let repo: InMemoryBookingRepository;
    let outbox: { append: jest.Mock; events: any[] };

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        outbox = {
            append: jest.fn().mockImplementation(async (e) => outbox.events.push(e)),
            events: [],
        };
        handler = new CancelBookingHandler(repo as any, outbox as any);
    });

    it('cancels booking and returns refund info', async () => {
        const b = await createBooking(repo, 'user-1');
        b.confirm();
        b.markPaid(new Date());
        await repo.save(b);
        const result = await handler.execute({
            bookingId: b.id,
            userId: 'user-1',
            reason: 'plans changed',
        });
        expect(result.status).toBe('cancelled');
        expect(result.refundAmount).toBe(900); // 90% of 1000
        expect(result.cancelledAt).toBeDefined();
    });

    it('emits BookingCancelledEvent with reason and refund', async () => {
        const b = await createBooking(repo, 'user-1');
        b.confirm();
        b.markPaid(new Date());
        await repo.save(b);
        b.pullDomainEvents(); // clear paid event
        outbox.events = [];
        await handler.execute({ bookingId: b.id, userId: 'user-1', reason: 'medical' });
        expect(outbox.events).toHaveLength(1);
        expect(outbox.events[0]).toBeInstanceOf(BookingCancelledEvent);
        expect(outbox.events[0].reason).toBe('medical');
    });

    it('throws NotFoundException for non-existent booking', async () => {
        await expect(
            handler.execute({ bookingId: 'missing', userId: 'u1', reason: 'x' })
        ).rejects.toThrow();
    });

    it('throws ForbiddenException for wrong user', async () => {
        const b = await createBooking(repo, 'user-1');
        await expect(
            handler.execute({ bookingId: b.id, userId: 'user-2', reason: 'x' })
        ).rejects.toThrow(/access/i);
    });

    it('refuses to cancel already-cancelled booking (domain invariant)', async () => {
        const b = await createBooking(repo, 'user-1');
        await handler.execute({ bookingId: b.id, userId: 'user-1', reason: 'first' });
        await expect(
            handler.execute({ bookingId: b.id, userId: 'user-1', reason: 'second' })
        ).rejects.toThrow();
    });

    it('persists the cancelled booking to repository', async () => {
        const b = await createBooking(repo, 'user-1');
        await handler.execute({ bookingId: b.id, userId: 'user-1', reason: 'x' });
        const reloaded = await repo.findById(b.id);
        expect(reloaded?.status.value).toBe('cancelled');
    });
});