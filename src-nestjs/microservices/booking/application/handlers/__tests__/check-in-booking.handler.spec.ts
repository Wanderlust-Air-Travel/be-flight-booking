import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { BookingCheckedInEvent } from '../../../domain/events/booking.events';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { BookingStatus } from '../../../domain/value-objects/booking-status';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { Money } from '../../../domain/value-objects/money';
import { CheckInBookingHandler } from '../check-in-booking.handler';

async function createPaidBooking(repo: InMemoryBookingRepository) {
    const b = await Booking.create(
        {
            contact: ContactInfo.create('Alice', 'alice@example.com', '+84912345678'),
            totalAmount: Money.create(1000, 'VND'),
            passengers: [{ fullName: 'Alice', type: 'adult' }],
            segments: [{ flightInstanceId: 'fi-1', cabinType: 'economy', fareClassCode: 'Y' }],
            userId: 'user-1',
        },
        repo
    );
    await repo.save(b);
    b.confirm();
    b.markPaid(new Date());
    await repo.save(b);
    b.pullDomainEvents();
    return b;
}

describe('CheckInBookingHandler', () => {
    let handler: CheckInBookingHandler;
    let repo: InMemoryBookingRepository;
    let outbox: { append: jest.Mock; events: any[] };

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        outbox = {
            append: jest.fn().mockImplementation(async (e) => outbox.events.push(e)),
            events: [],
        };
        handler = new CheckInBookingHandler(repo as any, outbox as any);
    });

    it('checks in a PAID booking and emits BookingCheckedInEvent', async () => {
        const b = await createPaidBooking(repo);
        const result = await handler.execute({
            bookingId: b.id,
            userId: 'user-1',
            checkedInAt: new Date('2026-08-19T08:00:00Z'),
        });
        expect(result.status).toBe('checked_in');
        expect(outbox.events[0]).toBeInstanceOf(BookingCheckedInEvent);
        const reloaded = await repo.findById(b.id);
        expect(reloaded?.status).toBe(BookingStatus.CHECKED_IN);
    });

    it('throws NotFoundException', async () => {
        await expect(
            handler.execute({ bookingId: 'missing', userId: 'u1', checkedInAt: new Date() })
        ).rejects.toThrow();
    });

    it('throws ForbiddenException for wrong user', async () => {
        const b = await createPaidBooking(repo);
        await expect(
            handler.execute({ bookingId: b.id, userId: 'wrong', checkedInAt: new Date() })
        ).rejects.toThrow(/access/i);
    });

    it('refuses to check in a PENDING booking', async () => {
        const b = await Booking.create(
            {
                contact: ContactInfo.create('Alice', 'a@b.com', '+1234567'),
                totalAmount: Money.create(100, 'VND'),
                passengers: [{ fullName: 'Alice', type: 'adult' }],
                segments: [{ flightInstanceId: 'f1', cabinType: 'eco', fareClassCode: 'Y' }],
                userId: 'u1',
            },
            repo
        );
        await repo.save(b);
        await expect(
            handler.execute({ bookingId: b.id, userId: 'u1', checkedInAt: new Date() })
        ).rejects.toThrow();
    });
});
