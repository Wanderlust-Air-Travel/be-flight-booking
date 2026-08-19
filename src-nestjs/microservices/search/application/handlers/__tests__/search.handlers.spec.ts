import { SearchFlightHandler } from '../search.handlers';
import type { ISearchAdapter } from '../search.handlers';

describe('SearchFlightHandler', () => {
    let handler: SearchFlightHandler;
    let adapter: jest.Mocked<ISearchAdapter>;
    let outbox: { append: jest.Mock };

    beforeEach(() => {
        adapter = {
            searchFlights: jest.fn().mockResolvedValue([]),
            getFareOptions: jest.fn(),
            getFlightDetails: jest.fn(),
        };
        outbox = { append: jest.fn() };
        handler = new SearchFlightHandler(adapter, outbox as any);
    });

    it('calls adapter.searchFlights with validated inputs', async () => {
        await handler.execute({
            origin: 'HAN',
            destination: 'SGN',
            departureDate: new Date('2026-09-01'),
            passengers: 1,
            cabinClass: 'economy',
        });
        expect(adapter.searchFlights).toHaveBeenCalledTimes(1);
    });

    it('rejects same origin and destination', async () => {
        await expect(
            handler.execute({
                origin: 'HAN',
                destination: 'HAN',
                departureDate: new Date('2026-09-01'),
                passengers: 1,
                cabinClass: 'economy',
            })
        ).rejects.toThrow(/must differ/);
    });

    it('rejects invalid passenger count', async () => {
        await expect(
            handler.execute({
                origin: 'HAN',
                destination: 'SGN',
                departureDate: new Date('2026-09-01'),
                passengers: 0,
                cabinClass: 'economy',
            })
        ).rejects.toThrow();
        await expect(
            handler.execute({
                origin: 'HAN',
                destination: 'SGN',
                departureDate: new Date('2026-09-01'),
                passengers: 10,
                cabinClass: 'economy',
            })
        ).rejects.toThrow();
    });
});