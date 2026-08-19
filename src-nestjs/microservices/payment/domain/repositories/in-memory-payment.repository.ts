import type { Payment } from '../aggregates/payment.aggregate';
import type { IdempotencyKey } from '../value-objects/idempotency-key';
import type { IPaymentRepository, Page, PageOptions } from './payment.repository.interface';

/**
 * InMemoryPaymentRepository — Test implementation.
 */
export class InMemoryPaymentRepository implements IPaymentRepository {
    private readonly payments: Map<string, Payment> = new Map();

    async save(payment: Payment): Promise<void> {
        this.payments.set(payment.id, payment);
    }

    async findById(id: string): Promise<Payment | null> {
        return this.payments.get(id) ?? null;
    }

    async findByIdempotencyKey(key: IdempotencyKey): Promise<Payment | null> {
        for (const p of this.payments.values()) {
            if (p.idempotencyKey.equals(key)) return p;
        }
        return null;
    }

    async findByBookingId(bookingId: string, options: PageOptions): Promise<Page<Payment>> {
        const all = [...this.payments.values()].filter((p) => p.bookingId === bookingId);
        const start = (options.page - 1) * options.limit;
        const items = all.slice(start, start + options.limit);
        return { items, total: all.length, page: options.page, limit: options.limit };
    }

    async delete(id: string): Promise<void> {
        this.payments.delete(id);
    }

    clear(): void {
        this.payments.clear();
    }
}