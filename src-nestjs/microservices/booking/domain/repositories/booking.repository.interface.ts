import type { Booking } from '../aggregates/booking.aggregate';
import type { PNR } from '../value-objects/pnr';

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

/**
 * IBookingRepository — Domain-layer port for booking persistence.
 *
 * Implementation lives in infrastructure/repositories/booking.typeorm.repository.ts.
 * Used by:
 *  - Application handlers (CreateBookingHandler, GetBookingHandler, etc.)
 *  - PNR.generateWithCollisionCheck()
 *
 * Methods that do not return a Booking (e.g. save, addPassenger) are
 * declared on the interface but the Booking aggregate is the source of
 * truth — handlers should call save() after mutating the aggregate.
 */
export interface IBookingRepository {
    /** Persist a new or updated Booking aggregate. */
    save(booking: Booking): Promise<void>;

    /** Find by primary ID. Returns null if not found. */
    findById(id: string): Promise<Booking | null>;

    /** Find by PNR code (used for collision check + lookup). */
    findByPnr(pnr: PNR | string): Promise<Booking | null>;

    /** Find all bookings for a user (with pagination). */
    findByUserId(userId: string, options: PageOptions): Promise<Page<Booking>>;

    /** Delete a booking (rare; mostly for tests). */
    delete(id: string): Promise<void>;
}

/**
 * Injection token for IBookingRepository. Use this string token in
 * `@Inject('IBookingRepository')` and bind in the module:
 *   { provide: 'IBookingRepository', useClass: BookingTypeOrmRepository }
 */
export const BOOKING_REPOSITORY = 'IBookingRepository';