import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Payment } from '../../domain/aggregates/payment.aggregate';
import {
    type IPaymentRepository,
    type Page,
    type PageOptions,
} from '../../domain/repositories/payment.repository.interface';
import { IdempotencyKey } from '../../domain/value-objects/idempotency-key';
import { PaymentStatus } from '../../domain/value-objects/payment-status';
import { TransactionRef } from '../../domain/value-objects/transaction-ref';

/**
 * PaymentTypeOrmRepository — Production IPaymentRepository backed by SQL Server.
 *
 * Maps Payment aggregate to the Payments table. Uses raw queries (rather
 * than the @nestjs/typeorm Repository) so the microservice can register
 * just this class with the DataSource that main.payment.ts configures.
 */
@Injectable()
export class PaymentTypeOrmRepository implements IPaymentRepository {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async save(payment: Payment): Promise<void> {
        await this.dataSource.query(
            `
            MERGE Payments AS target
            USING (SELECT @0 AS payment_id) AS src
                ON target.payment_id = src.payment_id
            WHEN MATCHED THEN
                UPDATE SET
                    booking_id = @1,
                    amount = @2,
                    currency_code = @3,
                    payment_method_code = @4,
                    status = @5,
                    paid_at = @6,
                    transaction_ref = @7,
                    idempotency_key = @8
            WHEN NOT MATCHED THEN
                INSERT (
                    payment_id, booking_id, amount, currency_code,
                    payment_method_code, status, paid_at, transaction_ref, idempotency_key
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, @6, @7, @8
                );
            `,
            [
                payment.id,
                payment.bookingId,
                payment.amount,
                payment.currency,
                payment.method,
                payment.status.value,
                payment.completedAt,
                payment.transactionRef ? payment.transactionRef.value : null,
                payment.idempotencyKey.value,
            ]
        );
    }

    async findById(id: string): Promise<Payment | null> {
        const rows = (await this.dataSource.query(
            `SELECT * FROM Payments WHERE payment_id = @0`,
            [id]
        )) as Record<string, unknown>[];
        const row = rows[0];
        return row ? this.toAggregate(row) : null;
    }

    async findByIdempotencyKey(key: IdempotencyKey): Promise<Payment | null> {
        const rows = (await this.dataSource.query(
            `SELECT TOP 1 * FROM Payments WHERE idempotency_key = @0`,
            [key.value]
        )) as Record<string, unknown>[];
        const row = rows[0];
        return row ? this.toAggregate(row) : null;
    }

    async findByBookingId(bookingId: string, options: PageOptions): Promise<Page<Payment>> {
        const offset = (options.page - 1) * options.limit;
        const result = (await this.dataSource.query(
            `
            SELECT * FROM Payments
            WHERE booking_id = @0
            ORDER BY created_at DESC
            OFFSET @1 ROWS FETCH NEXT @2 ROWS ONLY;
            SELECT COUNT(*) AS total FROM Payments WHERE booking_id = @0;
            `,
            [bookingId, offset, options.limit]
        )) as Record<string, unknown>[][];
        const items = (result[0] as Record<string, unknown>[]).map((r) => this.toAggregate(r));
        const total = Number((result[1] as Record<string, unknown>[])[0]?.total ?? 0);
        return { items, total, page: options.page, limit: options.limit };
    }

    async delete(id: string): Promise<void> {
        await this.dataSource.query(`DELETE FROM Payments WHERE payment_id = @0`, [id]);
    }

    private toAggregate(row: Record<string, unknown>): Payment {
        return Payment.rehydrate({
            id: String(row.payment_id),
            bookingId: String(row.booking_id),
            amount: Number(row.amount),
            currency: String(row.currency_code),
            method: String(row.payment_method_code),
            idempotencyKey: IdempotencyKey.fromString(String(row.idempotency_key ?? '')),
            status: PaymentStatus.all().find((s) => s.value === String(row.status).toLowerCase()) ??
                PaymentStatus.PENDING,
            transactionRef: row.transaction_ref
                ? TransactionRef.fromString(String(row.transaction_ref))
                : null,
            createdAt: new Date(row.created_at as string),
            completedAt: row.paid_at ? new Date(row.paid_at as string) : null,
        });
    }
}
