import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Booking } from '../../domain/aggregates/booking.aggregate';
import {
    type IBookingRepository,
    type Page,
    type PageOptions,
} from '../../domain/repositories/booking.repository.interface';
import { BookingStatus } from '../../domain/value-objects/booking-status';
import { ContactInfo } from '../../domain/value-objects/contact-info';
import { Money } from '../../domain/value-objects/money';
import { PNR } from '../../domain/value-objects/pnr';

/**
 * BookingTypeOrmRepository — Production IBookingRepository backed by SQL Server.
 *
 * The current schema (Bookings + BookingPassengers + BookingSegments +
 * Tickets) keeps passengers and segments in child rows. For now this
 * adapter stores/loads the aggregate "shallow" — the aggregate's
 * `passengers` and `segments` lists reflect what was on the Booking row
 * at save time but the source of truth for child rows remains the API
 * gateway's booking flow. Repo's findById returns a rehydrated Booking
 * whose lists may be empty unless the caller has populated them.
 *
 * All write operations are guarded by SQL parameter binding; pnr_code is
 * stored uppercased to match the PNR value-object invariant.
 */
@Injectable()
export class BookingTypeOrmRepository implements IBookingRepository {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async save(booking: Booking): Promise<void> {
        await this.dataSource.query(
            `
            MERGE Bookings AS target
            USING (SELECT @0 AS booking_id) AS src
                ON target.booking_id = src.booking_id
            WHEN MATCHED THEN
                UPDATE SET
                    pnr_code = @1,
                    user_id = @2,
                    currency_code = @3,
                    total_amount = @4,
                    status = @5,
                    contact_fullname = @6,
                    contact_email = @7,
                    contact_phone = @8,
                    updated_at = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (
                    booking_id, pnr_code, user_id, currency_code, total_amount,
                    status, channel, contact_fullname, contact_email, contact_phone
                )
                VALUES (
                    @0, @1, @2, @3, @4, @5, 'direct', @6, @7, @8
                );
            `,
            [
                booking.id,
                booking.pnr.value,
                booking.userId,
                booking.totalAmount.currency,
                booking.totalAmount.amount,
                booking.status.value,
                booking.contact.fullName,
                booking.contact.email,
                booking.contact.phone,
            ]
        );
    }

    async findById(id: string): Promise<Booking | null> {
        const rows = (await this.dataSource.query(
            `SELECT * FROM Bookings WHERE booking_id = @0`,
            [id]
        )) as Record<string, unknown>[];
        const row = rows[0];
        return row ? this.toAggregate(row) : null;
    }

    async findByPnr(pnr: PNR | string): Promise<Booking | null> {
        const code = typeof pnr === 'string' ? pnr : pnr.value;
        const rows = (await this.dataSource.query(
            `SELECT TOP 1 * FROM Bookings WHERE UPPER(pnr_code) = @0`,
            [code.toUpperCase()]
        )) as Record<string, unknown>[];
        const row = rows[0];
        return row ? this.toAggregate(row) : null;
    }

    async findByUserId(userId: string, options: PageOptions): Promise<Page<Booking>> {
        const offset = (options.page - 1) * options.limit;
        const rows = (await this.dataSource.query(
            `
            SELECT * FROM Bookings
            WHERE user_id = @0
            ORDER BY created_at DESC
            OFFSET @1 ROWS FETCH NEXT @2 ROWS ONLY;
            SELECT COUNT(*) AS total FROM Bookings WHERE user_id = @0;
            `,
            [userId, offset, options.limit]
        )) as Record<string, unknown>[][];
        const items = (rows[0] as Record<string, unknown>[]).map((r) => this.toAggregate(r));
        const total = Number((rows[1] as Record<string, unknown>[])[0]?.total ?? 0);
        return { items, total, page: options.page, limit: options.limit };
    }

    async delete(id: string): Promise<void> {
        await this.dataSource.query(`DELETE FROM Bookings WHERE booking_id = @0`, [id]);
    }

    private toAggregate(row: Record<string, unknown>): Booking {
        return Booking.rehydrate({
            id: String(row.booking_id),
            pnr: PNR.fromString(String(row.pnr_code)),
            status: BookingStatus.fromString(String(row.status)),
            totalAmount: Money.of({
                amount: Number(row.total_amount),
                currency: String(row.currency_code),
            }),
            contact: ContactInfo.create(
                String(row.contact_fullname),
                String(row.contact_email),
                String(row.contact_phone)
            ),
            passengers: [],
            segments: [],
            userId: row.user_id ? String(row.user_id) : null,
            createdAt: new Date(row.created_at as string),
        });
    }
}
