import type { Booking } from '../aggregates/booking.aggregate';
import type { IBookingRepository, Page, PageOptions } from './booking.repository.interface';
import { PNR } from '../value-objects/pnr';

/**
 * InMemoryBookingRepository — In-memory implementation of IBookingRepository
 * for unit tests. Stores bookings in a Map keyed by ID.
 */
export class InMemoryBookingRepository implements IBookingRepository {
    private readonly bookings: Map<string, Booking> = new Map();

    async save(booking: Booking): Promise<void> {
        // Persist a deep snapshot via rehydrate to detach the aggregate from any in-memory mutations.
        // For tests, simple Map insertion is sufficient.
        this.bookings.set(booking.id, booking);
    }

    async findById(id: string): Promise<Booking | null> {
        return this.bookings.get(id) ?? null;
    }

    async findByPnr(pnr: PNR | string): Promise<Booking | null> {
        const target = typeof pnr === 'string' ? pnr : pnr.value;
        for (const b of this.bookings.values()) {
            if (b.pnr.value === target) return b;
        }
        return null;
    }

    async findByUserId(userId: string, options: PageOptions): Promise<Page<Booking>> {
        const all = [...this.bookings.values()].filter((b) => b.userId === userId);
        const start = (options.page - 1) * options.limit;
        const items = all.slice(start, start + options.limit);
        return { items, total: all.length, page: options.page, limit: options.limit };
    }

    async delete(id: string): Promise<void> {
        this.bookings.delete(id);
    }

    // --- Test helpers ---

    clear(): void {
        this.bookings.clear();
    }

    count(): number {
        return this.bookings.size;
    }
}