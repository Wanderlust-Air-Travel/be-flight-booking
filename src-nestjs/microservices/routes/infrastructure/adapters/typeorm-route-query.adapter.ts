import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
    type FlightSchedule,
    type IRouteQueryPort,
    type RouteSummary,
} from '../../application/handlers/routes.handlers';

/**
 * TypeOrmRouteQueryAdapter — Production IRouteQueryPort backed by SQL Server.
 *
 * Maps `Routes` rows + joined airport IATA codes to the `RouteSummary` DTO,
 * and lists concrete flight instances grouped by route as `FlightSchedule`.
 */
@Injectable()
export class TypeOrmRouteQueryAdapter implements IRouteQueryPort {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async findAllRoutes(): Promise<RouteSummary[]> {
        const rows = await this.dataSource.query(`
            SELECT
                r.route_id          AS route_id,
                ao.iata_code        AS origin,
                ad.iata_code        AS destination,
                r.distance_km       AS distance_km
            FROM Routes r
            INNER JOIN Airports ao ON ao.airport_id = r.origin_airport_id
            INNER JOIN Airports ad ON ad.airport_id = r.destination_airport_id
            ORDER BY ao.iata_code, ad.iata_code
        `);

        return (rows as Record<string, unknown>[]).map((row) => ({
            routeId: String(row.route_id),
            origin: String(row.origin),
            destination: String(row.destination),
            airlineCode: 'N/A',
            distanceKm: Number(row.distance_km ?? 0),
        }));
    }

    async findRoute(id: string): Promise<RouteSummary | null> {
        const rows = await this.dataSource.query(
            `
            SELECT
                r.route_id          AS route_id,
                ao.iata_code        AS origin,
                ad.iata_code        AS destination,
                r.distance_km       AS distance_km
            FROM Routes r
            INNER JOIN Airports ao ON ao.airport_id = r.origin_airport_id
            INNER JOIN Airports ad ON ad.airport_id = r.destination_airport_id
            WHERE r.route_id = @0
            `,
            [id]
        );

        const row = (rows as Record<string, unknown>[])[0];
        if (!row) return null;
        return {
            routeId: String(row.route_id),
            origin: String(row.origin),
            destination: String(row.destination),
            airlineCode: 'N/A',
            distanceKm: Number(row.distance_km ?? 0),
        };
    }

    async findSchedule(routeId: string): Promise<FlightSchedule[]> {
        const rows = await this.dataSource.query(
            `
            SELECT
                fi.flight_instance_id          AS flight_instance_id,
                fs.route_id                    AS route_id,
                ISNULL(at.code, '')            AS aircraft_code,
                fi.departure_datetime_local    AS departure_time,
                fi.arrival_datetime_local      AS arrival_time,
                fi.status                      AS status
            FROM FlightInstances fi
            INNER JOIN FlightSchedules fs ON fs.flight_schedule_id = fi.flight_schedule_id
            LEFT  JOIN Aircrafts ac       ON ac.aircraft_id = fi.aircraft_id
            LEFT  JOIN AircraftTypes at   ON at.aircraft_type_id = ac.aircraft_type_id
            WHERE fs.route_id = @0
            ORDER BY fi.departure_datetime_local ASC
            `,
            [routeId]
        );

        return (rows as Record<string, unknown>[]).map((row) => ({
            flightInstanceId: String(row.flight_instance_id),
            routeId: String(row.route_id),
            aircraft: String(row.aircraft_code ?? 'N/A'),
            departureTime: new Date(row.departure_time as string),
            arrivalTime: new Date(row.arrival_time as string),
            status: this.toScheduleStatus(row.status as string),
        }));
    }

    private toScheduleStatus(raw: string): FlightSchedule['status'] {
        switch ((raw ?? '').toLowerCase()) {
            case 'scheduled':
                return 'SCHEDULED';
            case 'delayed':
                return 'DELAYED';
            case 'cancelled':
                return 'CANCELLED';
            case 'completed':
                return 'COMPLETED';
            default:
                return 'SCHEDULED';
        }
    }
}
