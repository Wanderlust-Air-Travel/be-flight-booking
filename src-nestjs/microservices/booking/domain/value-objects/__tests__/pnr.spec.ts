import type { IBookingRepository } from '../../repositories/booking.repository.interface';
import { PNR } from '../pnr';

function makeRepoStub(existing: string[] = []): IBookingRepository {
    return {
        findByPnr: jest
            .fn()
            .mockImplementation(async (pnr: string) =>
                existing.includes(pnr) ? ({ pnr } as any) : null
            ),
    } as any;
}

describe('PNR (booking context)', () => {
    describe('format invariants', () => {
        it('fromString() accepts exactly 6 chars', () => {
            const p = PNR.fromString('ABC123');
            expect(p.value).toBe('ABC123');
        });

        it('fromString() normalizes to uppercase', () => {
            const p = PNR.fromString('abc123');
            expect(p.value).toBe('ABC123');
        });

        it('fromString() throws if length != 6', () => {
            expect(() => PNR.fromString('ABC12')).toThrow();
            expect(() => PNR.fromString('ABC1234')).toThrow();
            expect(() => PNR.fromString('')).toThrow();
        });

        it('fromString() throws if contains non-alphanumeric', () => {
            expect(() => PNR.fromString('ABC-23')).toThrow();
            expect(() => PNR.fromString('ABC 23')).toThrow();
            expect(() => PNR.fromString('ABC!23')).toThrow();
        });
    });

    describe('generate()', () => {
        it('generate() returns PNR with 6 alphanumeric chars', () => {
            const p = PNR.generate();
            expect(p.value).toMatch(/^[A-Z0-9]{6}$/);
        });

        it('generate(repo) avoids collision via findByPnr', async () => {
            const repo = makeRepoStub(['ABC123']);
            const p = await PNR.generateWithCollisionCheck(repo);
            expect(p.value).not.toBe('ABC123');
            expect(p.value).toMatch(/^[A-Z0-9]{6}$/);
            expect(repo.findByPnr).toHaveBeenCalled();
        });

        it('generateWithCollisionCheck() retries up to 10 times then throws', async () => {
            // Force collision on every attempt by returning existing for ANY PNR
            const repo = {
                findByPnr: jest.fn().mockResolvedValue({} as any),
            } as any;
            await expect(PNR.generateWithCollisionCheck(repo)).rejects.toThrow();
            expect(repo.findByPnr.mock.calls.length).toBeGreaterThanOrEqual(1);
            expect(repo.findByPnr.mock.calls.length).toBeLessThanOrEqual(11);
        });
    });

    describe('equality', () => {
        it('equals() returns true for same value', () => {
            const a = PNR.fromString('ABC123');
            const b = PNR.fromString('ABC123');
            expect(a.equals(b)).toBe(true);
        });

        it('equals() returns false for different value', () => {
            const a = PNR.fromString('ABC123');
            const b = PNR.fromString('XYZ789');
            expect(a.equals(b)).toBe(false);
        });
    });
});
