import type { BookingSummary, IBookingPort } from '../../application/ports/booking.port';

describe('IBookingPort contract', () => {
    class InMemoryBookingPort implements IBookingPort {
        private readonly data = new Map<string, BookingSummary>();

        async findSummaryById(bookingId: string): Promise<BookingSummary | null> {
            return this.data.get(bookingId) ?? null;
        }

        seed(id: string, summary: BookingSummary): void {
            this.data.set(id, summary);
        }
    }

    let port: InMemoryBookingPort;

    beforeEach(() => {
        port = new InMemoryBookingPort();
    });

    it('findSummaryById() returns null for unknown booking', async () => {
        expect(await port.findSummaryById('nope')).toBeNull();
    });

    it('findSummaryById() returns summary for known booking', async () => {
        port.seed('b-1', {
            id: 'b-1',
            pnr: 'ABC123',
            status: 'pending',
            contactEmail: 'a@b.com',
            userId: 'u-1',
            totalAmount: 1000,
            currency: 'VND',
        });
        const s = await port.findSummaryById('b-1');
        expect(s?.pnr).toBe('ABC123');
    });

    it('handles guest bookings (userId = null)', async () => {
        port.seed('b-2', {
            id: 'b-2',
            pnr: 'GUEST01',
            status: 'pending',
            contactEmail: 'guest@x.com',
            userId: null,
            totalAmount: 500,
            currency: 'VND',
        });
        const s = await port.findSummaryById('b-2');
        expect(s?.userId).toBeNull();
    });
});
