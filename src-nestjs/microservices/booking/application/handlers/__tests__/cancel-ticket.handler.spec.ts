import { CancelTicketHandler } from '../cancel-ticket.handler';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { Money } from '../../../domain/value-objects/money';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { BookingCancelledEvent, BookingPassengersUpdatedEvent } from '../../../domain/events/booking.events';

async function createBooking(
    repo: InMemoryBookingRepository,
    passengerCount = 2
) {
    const b = await Booking.create(
        {
            contact: ContactInfo.create('Alice', 'alice@example.com', '+84912345678'),
            totalAmount: Money.create(1000, 'VND'),
            passengers: Array.from({ length: passengerCount }, (_, i) => ({
                fullName: `Pax ${i + 1}`,
                type: 'adult' as const,
            })),
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

describe('CancelTicketHandler', () => {
    let handler: CancelTicketHandler;
    let repo: InMemoryBookingRepository;
    let outbox: { append: jest.Mock; events: any[] };

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        outbox = {
            append: jest.fn().mockImplementation(async (e) => outbox.events.push(e)),
            events: [],
        };
        handler = new CancelTicketHandler(repo as any, outbox as any);
    });

    it('removes one passenger from a multi-passenger booking', async () => {
        const b = await createBooking(repo, 3);
        const result = await handler.execute({
            bookingId: b.id,
            userId: 'user-1',
            ticketIndex: 0,
            reason: 'one passenger cannot fly',
        });
        expect(result.remainingPassengers).toBe(2);
        expect(result.bookingCancelled).toBe(false);
        expect(result.refundAmount).toBe(0);
        expect(outbox.events[0]).toBeInstanceOf(BookingPassengersUpdatedEvent);
    });

    it('cancels the entire booking when last ticket is removed', async () => {
        const b = await createBooking(repo, 1);
        const result = await handler.execute({
            bookingId: b.id,
            userId: 'user-1',
            ticketIndex: 0,
            reason: 'all cancelled',
        });
        expect(result.remainingPassengers).toBe(0);
        expect(result.bookingCancelled).toBe(true);
        expect(result.refundAmount).toBe(900);
        expect(outbox.events[0]).toBeInstanceOf(BookingCancelledEvent);
    });

    it('throws NotFoundException for missing booking', async () => {
        await expect(
            handler.execute({
                bookingId: 'missing',
                userId: 'u1',
                ticketIndex: 0,
                reason: 'x',
            })
        ).rejects.toThrow();
    });

    it('throws ForbiddenException for wrong user', async () => {
        const b = await createBooking(repo, 2);
        await expect(
            handler.execute({
                bookingId: b.id,
                userId: 'other',
                ticketIndex: 0,
                reason: 'x',
            })
        ).rejects.toThrow(/access/i);
    });
});