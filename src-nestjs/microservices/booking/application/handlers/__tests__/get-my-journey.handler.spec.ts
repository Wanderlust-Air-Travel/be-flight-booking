import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { Money } from '../../../domain/value-objects/money';
import { GetMyJourneyHandler } from '../get-my-journey.handler';

describe('GetMyJourneyHandler', () => {
    let handler: GetMyJourneyHandler;
    let repo: InMemoryBookingRepository;

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        handler = new GetMyJourneyHandler(repo as any);
    });

    it('returns all bookings as journeys for a user', async () => {
        for (let i = 0; i < 3; i++) {
            const b = await Booking.create(
                {
                    contact: ContactInfo.create('Alice', 'alice@example.com', '+84912345678'),
                    totalAmount: Money.create(1000, 'VND'),
                    passengers: [{ fullName: 'Alice', type: 'adult' }],
                    segments: [
                        { flightInstanceId: `fi-${i}`, cabinType: 'economy', fareClassCode: 'Y' },
                    ],
                    userId: 'user-1',
                },
                repo
            );
            await repo.save(b);
            b.pullDomainEvents();
        }
        const result = await handler.execute({ userId: 'user-1' });
        expect(result.journeys).toHaveLength(3);
        expect(result.journeys[0].passengers).toBe(1);
    });

    it('returns empty journeys for user with no bookings', async () => {
        const result = await handler.execute({ userId: 'nobody' });
        expect(result.journeys).toHaveLength(0);
    });
});
