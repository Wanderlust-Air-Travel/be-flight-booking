import type { Payment } from '../aggregates/payment.aggregate';
import type { IdempotencyKey } from '../value-objects/idempotency-key';

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
 * IPaymentRepository — Domain-layer port for payment persistence.
 */
export interface IPaymentRepository {
    save(payment: Payment): Promise<void>;
    findById(id: string): Promise<Payment | null>;
    findByIdempotencyKey(key: IdempotencyKey): Promise<Payment | null>;
    findByBookingId(bookingId: string, options: PageOptions): Promise<Page<Payment>>;
    delete(id: string): Promise<void>;
}

export const PAYMENT_REPOSITORY = 'IPaymentRepository';
