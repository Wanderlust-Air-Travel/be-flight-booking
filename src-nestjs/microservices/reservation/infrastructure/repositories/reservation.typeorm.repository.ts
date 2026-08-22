import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Reservation } from '../../domain/aggregates/reservation.aggregate';
import {
    type IReservationRepository,
    type Page,
    type PageOptions,
} from '../../domain/repositories/reservation.repository.interface';
import { ReservationSegment } from '../../domain/value-objects/reservation-segment';
import { ReservationStatus } from '../../domain/value-objects/reservation-status';

/**
 * ReservationTypeOrmRepository — Production IReservationRepository backed by SQL Server.
 *
 * Maps the Reservation aggregate to the Reservations table. The `segments_json`
 * column holds a JSON array of segment objects (flightInstanceId / fareClassCode
 * / cabinType / passengerCount) which is what the seed scripts and other
 * services already emit.
 */
@Injectable()
export class ReservationTypeOrmRepository implements IReservationRepository {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async save(reservation: Reservation): Promise<void> {
        const segmentsJson = JSON.stringify(
            reservation.segments.map((s) => ({
                flightInstanceId: s.flightInstanceId,
                fareClassCode: s.fareClassCode,
                cabinType: s.cabinType,
                passengerCount: s.passengerCount,
            }))
        );

        await this.dataSource.query(
            `
            MERGE Reservations AS target
            USING (SELECT @0 AS reservation_id) AS src
                ON target.reservation_id = src.reservation_id
            WHEN MATCHED THEN
                UPDATE SET
                    user_id = @1,
                    segments_json = @2,
                    number_of_passengers = @3,
                    total_amount = @4,
                    currency_code = @5,
                    status = @6,
                    expires_at = @7,
                    converted_at = @8
            WHEN NOT MATCHED THEN
                INSERT (
                    reservation_id, reservation_code, user_id, segments_json,
                    number_of_passengers, total_amount, currency_code, status, expires_at
                )
                VALUES (
                    @0, @9, @1, @2, @3, @4, @5, @6, @7
                );
            `,
            [
                reservation.id,
                reservation.userId,
                segmentsJson,
                reservation.segments.reduce((acc, s) => acc + s.passengerCount, 0),
                0,
                'VND',
                reservation.status.value,
                reservation.expiresAt,
                null,
                this.deriveCode(reservation.id),
            ]
        );
    }

    async findById(id: string): Promise<Reservation | null> {
        const rows = (await this.dataSource.query(
            `SELECT * FROM Reservations WHERE reservation_id = @0`,
            [id]
        )) as Record<string, unknown>[];
        const row = rows[0];
        return row ? this.toAggregate(row) : null;
    }

    async findByUserId(userId: string, options: PageOptions): Promise<Page<Reservation>> {
        const offset = (options.page - 1) * options.limit;
        const result = (await this.dataSource.query(
            `
            SELECT * FROM Reservations
            WHERE user_id = @0
            ORDER BY created_at DESC
            OFFSET @1 ROWS FETCH NEXT @2 ROWS ONLY;
            SELECT COUNT(*) AS total FROM Reservations WHERE user_id = @0;
            `,
            [userId, offset, options.limit]
        )) as Record<string, unknown>[][];
        const items = (result[0] as Record<string, unknown>[]).map((r) => this.toAggregate(r));
        const total = Number((result[1] as Record<string, unknown>[])[0]?.total ?? 0);
        return { items, total, page: options.page, limit: options.limit };
    }

    async findExpiringBefore(before: Date, limit: number): Promise<Reservation[]> {
        const rows = (await this.dataSource.query(
            `
            SELECT TOP (@0) * FROM Reservations
            WHERE status = 'active' AND expires_at <= @1
            ORDER BY expires_at ASC
            `,
            [limit, before]
        )) as Record<string, unknown>[];
        return rows.map((r) => this.toAggregate(r));
    }

    async delete(id: string): Promise<void> {
        await this.dataSource.query(`DELETE FROM Reservations WHERE reservation_id = @0`, [id]);
    }

    private toAggregate(row: Record<string, unknown>): Reservation {
        const rawSegments = JSON.parse(String(row.segments_json ?? '[]')) as Array<{
            flightInstanceId: string;
            fareClassCode: string;
            cabinType: string;
            passengerCount: number;
        }>;
        const segments = rawSegments.map((s) =>
            ReservationSegment.create({
                flightInstanceId: s.flightInstanceId,
                fareClassCode: s.fareClassCode,
                cabinType: s.cabinType,
                passengerCount: s.passengerCount,
            })
        );

        return Reservation.rehydrate({
            id: String(row.reservation_id),
            userId: row.user_id ? String(row.user_id) : null,
            contactEmail: 'noreply@flightbooking.com',
            segments,
            status: this.toStatus(String(row.status)),
            createdAt: new Date(row.created_at as string),
            expiresAt: new Date(row.expires_at as string),
            bookingId: row.converted_at ? null : null,
        });
    }

    private toStatus(value: string): ReservationStatus {
        const v = value.toLowerCase();
        return (
            [ReservationStatus.ACTIVE, ReservationStatus.EXPIRED, ReservationStatus.CONVERTED, ReservationStatus.CANCELLED].find(
                (s) => s.value === v
            ) ?? ReservationStatus.ACTIVE
        );
    }

    private deriveCode(id: string): string {
        // ReservationCode must be 6-char alphanumeric; derive deterministically from id.
        const cleaned = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase().padStart(6, '0');
        return cleaned.slice(-6);
    }
}
