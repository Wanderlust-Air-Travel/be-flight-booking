import { ReservationTcpAdapter } from '../reservation-tcp.adapter';
import type { ReservationSummary } from '../../../application/ports/reservation.port';

describe('ReservationTcpAdapter', () => {
    let adapter: ReservationTcpAdapter;
    let client: { send: jest.Mock };

    beforeEach(() => {
        client = { send: jest.fn() };
        adapter = new ReservationTcpAdapter(client as any);
    });

    it('findById() sends find_reservation_by_id message', async () => {
        const summary: ReservationSummary = {
            id: 'r-1',
            status: 'ACTIVE',
            contactEmail: 'a@b.com',
            expiresAt: null,
        };
        client.send.mockReturnValue({ toPromise: () => Promise.resolve(summary) });
        const result = await adapter.findById('r-1');
        expect(client.send).toHaveBeenCalledWith('find_reservation_by_id', { reservationId: 'r-1' });
        expect(result).toEqual(summary);
    });

    it('findById() returns null on error (does not throw)', async () => {
        client.send.mockReturnValue({
            toPromise: () => Promise.reject(new Error('connection refused')),
        });
        const result = await adapter.findById('r-1');
        expect(result).toBeNull();
    });

    it('cancel() sends cancel_reservation message', async () => {
        client.send.mockReturnValue({ toPromise: () => Promise.resolve(undefined) });
        await adapter.cancel('r-1', 'user-1');
        expect(client.send).toHaveBeenCalledWith('cancel_reservation', {
            reservationId: 'r-1',
            by: 'user-1',
        });
    });
});