import type { Reservation } from '../aggregates/reservation.aggregate';
import type { IReservationRepository, Page, PageOptions } from './reservation.repository.interface';

export class InMemoryReservationRepository implements IReservationRepository {
    private readonly reservations: Map<string, Reservation> = new Map();

    async save(reservation: Reservation): Promise<void> {
        this.reservations.set(reservation.id, reservation);
    }

    async findById(id: string): Promise<Reservation | null> {
        return this.reservations.get(id) ?? null;
    }

    async findByUserId(userId: string, options: PageOptions): Promise<Page<Reservation>> {
        const all = [...this.reservations.values()].filter((r) => r.userId === userId);
        const start = (options.page - 1) * options.limit;
        const items = all.slice(start, start + options.limit);
        return { items, total: all.length, page: options.page, limit: options.limit };
    }

    async findExpiringBefore(before: Date, limit: number): Promise<Reservation[]> {
        return [...this.reservations.values()].filter((r) => r.isExpired(before)).slice(0, limit);
    }

    async delete(id: string): Promise<void> {
        this.reservations.delete(id);
    }

    clear(): void {
        this.reservations.clear();
    }
}
