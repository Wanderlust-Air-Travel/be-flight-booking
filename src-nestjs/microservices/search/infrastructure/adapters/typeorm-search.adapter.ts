import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
    type FlightSearchInput,
    type FlightSearchResult,
    type ISearchAdapter,
} from '../../application/handlers/search.handlers';

/**
 * TypeOrmSearchAdapter — Production ISearchAdapter backed by SQL Server.
 *
 * Reads FlightInstances joined with FlightSchedules → Routes → Airports
 * for the given origin/destination/date and returns them as the search
 * result DTO consumed by `SearchFlightHandler`. Falls back to price 0 /
 * "N/A" when the related fare or seat counts are not yet priced.
 *
 * Currency defaults to "VND" until a fare-pricing table is wired up.
 */
@Injectable()
export class TypeOrmSearchAdapter implements ISearchAdapter {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async searchFlights(input: FlightSearchInput): Promise<FlightSearchResult[]> {
        const departureDay = this.toDateOnly(input.departureDate);

        const rows = await this.dataSource.query(
            `
            SELECT
                fi.flight_instance_id   AS flight_instance_id,
                fs.flight_number        AS flight_number,
                ao.iata_code            AS origin,
                ad.iata_code            AS destination,
                fi.departure_datetime_local AS departure_time,
                fi.arrival_datetime_local   AS arrival_time,
                ao.country              AS origin_country,
                ad.country              AS destination_country,
                ati.total_seats         AS total_seats
            FROM FlightInstances fi
            INNER JOIN FlightSchedules fs ON fs.flight_schedule_id = fi.flight_schedule_id
            INNER JOIN Routes r           ON r.route_id = fs.route_id
            INNER JOIN Airports ao        ON ao.airport_id = r.origin_airport_id
            INNER JOIN Airports ad        ON ad.airport_id = r.destination_airport_id
            INNER JOIN Aircrafts ac       ON ac.aircraft_id = fi.aircraft_id
            INNER JOIN AircraftTypes ati  ON ati.aircraft_type_id = ac.aircraft_type_id
            WHERE ao.iata_code = @0
              AND ad.iata_code = @1
              AND CAST(fi.flight_date AS DATE) = @2
              AND fi.status <> 'cancelled'
            ORDER BY fi.departure_datetime_local ASC
            `,
            [input.origin.toUpperCase(), input.destination.toUpperCase(), departureDay]
        );

        return rows.map((row: Record<string, unknown>) =>
            this.toResult(row, input.passengers, input.cabinClass)
        );
    }

    async getFareOptions(flightInstanceId: string): Promise<FlightSearchResult[]> {
        const rows = await this.dataSource.query(
            `
            SELECT
                fi.flight_instance_id   AS flight_instance_id,
                fs.flight_number        AS flight_number,
                ao.iata_code            AS origin,
                ad.iata_code            AS destination,
                fi.departure_datetime_local AS departure_time,
                fi.arrival_datetime_local   AS arrival_time,
                ao.country              AS origin_country,
                ad.country              AS destination_country,
                ati.total_seats         AS total_seats
            FROM FlightInstances fi
            INNER JOIN FlightSchedules fs ON fs.flight_schedule_id = fi.flight_schedule_id
            INNER JOIN Routes r           ON r.route_id = fs.route_id
            INNER JOIN Airports ao        ON ao.airport_id = r.origin_airport_id
            INNER JOIN Airports ad        ON ad.airport_id = r.destination_airport_id
            INNER JOIN Aircrafts ac       ON ac.aircraft_id = fi.aircraft_id
            INNER JOIN AircraftTypes ati  ON ati.aircraft_type_id = ac.aircraft_type_id
            WHERE fi.flight_instance_id = @0
            `,
            [flightInstanceId]
        );

        if (rows.length === 0) return [];
        return [this.toResult(rows[0] as Record<string, unknown>, 1, 'economy')];
    }

    async getFlightDetails(flightInstanceId: string): Promise<FlightSearchResult | null> {
        const results = await this.getFareOptions(flightInstanceId);
        return results[0] ?? null;
    }

    private toDateOnly(d: Date): string {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    private toResult(
        row: Record<string, unknown>,
        passengers: number,
        _cabinClass: FlightSearchInput['cabinClass']
    ): FlightSearchResult {
        const departure = new Date(row.departure_time as string);
        const arrival = new Date(row.arrival_time as string);
        const duration = Math.max(
            0,
            Math.round((arrival.getTime() - departure.getTime()) / 60000)
        );
        const totalSeats = Number(row.total_seats ?? 0);
        const availableSeats = Math.max(0, totalSeats - passengers);

        return {
            flightInstanceId: String(row.flight_instance_id),
            airline: 'N/A',
            flightNumber: String(row.flight_number),
            origin: String(row.origin),
            destination: String(row.destination),
            departureTime: departure,
            arrivalTime: arrival,
            duration,
            availableSeats,
            fareClassCode: 'ECON',
            price: 0,
            currency: 'VND',
        };
    }
}
