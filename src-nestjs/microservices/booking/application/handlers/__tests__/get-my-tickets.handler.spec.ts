import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { Money } from '../../../domain/value-objects/money';
import { GetMyTicketsHandler } from '../get-my-tickets.handler';

async function seed(repo: InMemoryBookingRepository, userId: string, count: number) {
    for (let i = 0; i < count; i++) {
        const b = await Booking.create(
            {
                contact: ContactInfo.create('Alice', 'alice@example.com', '+84912345678'),
                totalAmount: Money.create(1000 + i, 'VND'),
                passengers: [{ fullName: 'Alice', type: 'adult' }],
                segments: [
                    { flightInstanceId: `fi-${i}`, cabinType: 'economy', fareClassCode: 'Y' },
                ],
                userId,
            },
            repo
        );
        await repo.save(b);
        b.pullDomainEvents();
    }
}

describe('GetMyTicketsHandler', () => {
    let handler: GetMyTicketsHandler;
    let repo: InMemoryBookingRepository;

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        handler = new GetMyTicketsHandler(repo as any);
    });

    it('returns paginated bookings for a user', async () => {
        await seed(repo, 'user-1', 3);
        const result = await handler.execute({ userId: 'user-1', page: 1, limit: 2 });
        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
    });

    it('returns empty result for new user', async () => {
        const result = await handler.execute({ userId: 'nobody', page: 1, limit: 10 });
        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
    });

    it('does not return bookings of another user', async () => {
        await seed(repo, 'user-1', 2);
        await seed(repo, 'user-2', 1);
        const result = await handler.execute({ userId: 'user-1', page: 1, limit: 10 });
        expect(result.items).toHaveLength(2);
    });
});
