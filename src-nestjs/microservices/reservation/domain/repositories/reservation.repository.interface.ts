import type { Reservation } from '../aggregates/reservation.aggregate';
import type { ReservationStatus } from '../value-objects/reservation-status';

export interface PageOptions {
    page: number;
    limit: number;
}

export interface Page<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

export interface ReservationFilter {
    status?: ReservationStatus;
    userId?: string | null;
    expiresBefore?: Date;
}

/**
 * IReservationRepository — Domain-layer port for reservation persistence.
 */
export interface IReservationRepository {
    save(reservation: Reservation): Promise<void>;
    findById(id: string): Promise<Reservation | null>;
    findByUserId(userId: string, options: PageOptions): Promise<Page<Reservation>>;
    findExpiringBefore(before: Date, limit: number): Promise<Reservation[]>;
    delete(id: string): Promise<void>;
}

export const RESERVATION_REPOSITORY = 'IReservationRepository';
