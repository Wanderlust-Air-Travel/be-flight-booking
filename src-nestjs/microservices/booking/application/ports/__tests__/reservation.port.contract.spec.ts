import type { IReservationPort } from '../../application/ports/reservation.port';

/**
 * Contract test for IReservationPort — verify the interface contract
 * using an in-memory fake implementation. Any production adapter must
 * satisfy this contract.
 */
describe('IReservationPort contract', () => {
    class InMemoryReservationPort implements IReservationPort {
        private readonly data = new Map<string, any>();

        async findById(reservationId: string): Promise<any> {
            return this.data.get(reservationId) ?? null;
        }

        async cancel(reservationId: string, by: string): Promise<void> {
            this.data.set(reservationId, { ...this.data.get(reservationId), status: 'CANCELLED' });
        }

        seed(id: string, summary: any): void {
            this.data.set(id, summary);
        }
    }

    let port: InMemoryReservationPort;

    beforeEach(() => {
        port = new InMemoryReservationPort();
    });

    it('findById() returns null when reservation does not exist', async () => {
        const result = await port.findById('missing');
        expect(result).toBeNull();
    });

    it('findById() returns the reservation summary when it exists', async () => {
        port.seed('r-1', {
            id: 'r-1',
            status: 'ACTIVE',
            contactEmail: 'a@b.com',
            expiresAt: null,
        });
        const result = await port.findById('r-1');
        expect(result).not.toBeNull();
        expect(result?.id).toBe('r-1');
    });

    it('cancel() marks the reservation as cancelled', async () => {
        port.seed('r-1', { id: 'r-1', status: 'ACTIVE' });
        await port.cancel('r-1', 'user-1');
        const after = await port.findById('r-1');
        expect(after?.status).toBe('CANCELLED');
    });

    it('returns Promise<void> from cancel()', async () => {
        port.seed('r-1', { id: 'r-1' });
        const ret = await port.cancel('r-1', 'u');
        expect(ret).toBeUndefined();
    });

    it('findById() returns Promise that resolves with summary or null', async () => {
        const ret = port.findById('r-2');
        expect(ret).toBeInstanceOf(Promise);
        const resolved = await ret;
        expect(resolved).toBeNull();
    });
});
