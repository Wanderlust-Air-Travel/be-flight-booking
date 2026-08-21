import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { BookingPassengersUpdatedEvent } from '../../../domain/events/booking.events';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { Money } from '../../../domain/value-objects/money';
import { UpdateBookingPassengersHandler } from '../update-booking-passengers.handler';

async function createBooking(repo: InMemoryBookingRepository) {
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
    b.pullDomainEvents();
    return b;
}

describe('UpdateBookingPassengersHandler', () => {
    let handler: UpdateBookingPassengersHandler;
    let repo: InMemoryBookingRepository;
    let outbox: { append: jest.Mock; events: any[] };

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        outbox = {
            append: jest.fn().mockImplementation(async (e) => outbox.events.push(e)),
            events: [],
        };
        handler = new UpdateBookingPassengersHandler(repo as any, outbox as any);
    });

    it('updates passengers and emits PassengersUpdatedEvent', async () => {
        const b = await createBooking(repo);
        const result = await handler.execute({
            bookingId: b.id,
            userId: 'user-1',
            passengers: [
                { fullName: 'Alice', type: 'adult' },
                { fullName: 'Bob', type: 'child' },
            ],
        });
        expect(result.totalPassengers).toBe(2);
        expect(outbox.events[0]).toBeInstanceOf(BookingPassengersUpdatedEvent);
    });

    it('persists updated booking', async () => {
        const b = await createBooking(repo);
        await handler.execute({
            bookingId: b.id,
            userId: 'user-1',
            passengers: [{ fullName: 'X', type: 'adult' }],
        });
        const reloaded = await repo.findById(b.id);
        expect(reloaded?.passengers).toHaveLength(1);
    });

    it('throws NotFoundException', async () => {
        await expect(
            handler.execute({
                bookingId: 'missing',
                userId: 'u1',
                passengers: [{ fullName: 'X', type: 'adult' }],
            })
        ).rejects.toThrow();
    });

    it('throws ForbiddenException for wrong user', async () => {
        const b = await createBooking(repo);
        await expect(
            handler.execute({
                bookingId: b.id,
                userId: 'other',
                passengers: [{ fullName: 'X', type: 'adult' }],
            })
        ).rejects.toThrow(/access/i);
    });

    it('rejects empty passenger list', async () => {
        const b = await createBooking(repo);
        await expect(
            handler.execute({ bookingId: b.id, userId: 'user-1', passengers: [] })
        ).rejects.toThrow();
    });

    it('refuses to update cancelled booking', async () => {
        const b = await createBooking(repo);
        b.cancel('user-1', 'no plans');
        await repo.save(b);
        await expect(
            handler.execute({
                bookingId: b.id,
                userId: 'user-1',
                passengers: [{ fullName: 'X', type: 'adult' }],
            })
        ).rejects.toThrow();
    });
});
