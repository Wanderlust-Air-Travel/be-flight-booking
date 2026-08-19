import { GetBookingHandler } from '../get-booking.handler';
import type { IBookingRepository } from '../../../domain/repositories/booking.repository.interface';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import { Booking } from '../../../domain/aggregates/booking.aggregate';
import { Money } from '../../../domain/value-objects/money';
import { ContactInfo } from '../../../domain/value-objects/contact-info';

async function createBooking(repo: InMemoryBookingRepository, userId: string | null) {
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
    return booking;
}

describe('GetBookingHandler', () => {
    let handler: GetBookingHandler;
    let repo: InMemoryBookingRepository;

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        handler = new GetBookingHandler(repo as any);
    });

    it('returns booking for the owner', async () => {
        const b = await createBooking(repo, 'user-1');
        const result = await handler.execute({ bookingId: b.id, userId: 'user-1' });
        expect(result.bookingId).toBe(b.id);
        expect(result.pnr).toBe(b.pnr.value);
        expect(result.userId).toBe('user-1');
    });

    it('throws NotFoundException for non-existent booking', async () => {
        await expect(handler.execute({ bookingId: 'missing', userId: null })).rejects.toThrow();
    });

    it('throws ForbiddenException for another user', async () => {
        const b = await createBooking(repo, 'user-1');
        await expect(
            handler.execute({ bookingId: b.id, userId: 'user-2' })
        ).rejects.toThrow(/access/i);
    });

    it('allows guest to view guest booking (userId null)', async () => {
        const b = await createBooking(repo, null);
        const result = await handler.execute({ bookingId: b.id, userId: null });
        expect(result.userId).toBeNull();
    });

    it('throws when guest tries to view owned booking', async () => {
        const b = await createBooking(repo, 'user-1');
        await expect(handler.execute({ bookingId: b.id, userId: null })).rejects.toThrow(/login/i);
    });
});