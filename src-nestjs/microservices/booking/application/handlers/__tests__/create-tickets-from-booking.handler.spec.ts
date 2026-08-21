import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { BookingTicketsIssuedEvent } from '../../../domain/events/booking.events';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { Money } from '../../../domain/value-objects/money';
import { CreateTicketsFromBookingHandler } from '../create-tickets-from-booking.handler';

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

describe('CreateTicketsFromBookingHandler', () => {
    let handler: CreateTicketsFromBookingHandler;
    let repo: InMemoryBookingRepository;
    let outbox: { append: jest.Mock; events: any[] };

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        outbox = {
            append: jest.fn().mockImplementation(async (e) => outbox.events.push(e)),
            events: [],
        };
        handler = new CreateTicketsFromBookingHandler(repo as any, outbox as any);
    });

    it('issues tickets for a PAID booking', async () => {
        const b = await createPaidBooking(repo);
        const result = await handler.execute({ bookingId: b.id, ticketCount: 1 });
        expect(result.ticketCount).toBe(1);
        expect(outbox.events[0]).toBeInstanceOf(BookingTicketsIssuedEvent);
    });

    it('throws NotFoundException for missing booking', async () => {
        await expect(handler.execute({ bookingId: 'missing', ticketCount: 1 })).rejects.toThrow();
    });

    it('refuses to issue tickets for PENDING booking', async () => {
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
        await expect(handler.execute({ bookingId: b.id, ticketCount: 1 })).rejects.toThrow();
    });
});
