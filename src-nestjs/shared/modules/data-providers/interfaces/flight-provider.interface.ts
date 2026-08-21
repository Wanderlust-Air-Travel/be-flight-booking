import type { DataProvider, RateLimitInfo } from '../enums/data-provider.enum';
import type {
    AircraftDto,
    AirlineDto,
    AirportDto,
    FlightSearchParams,
    FlightSearchResultDto,
} from './data-provider.dto';

export interface FlightProvider {
    readonly name: DataProvider;
    readonly priority: number;
    readonly isEnabled: boolean;

    getAirports(): Promise<AirportDto[]>;
    getAirlines(): Promise<AirlineDto[]>;
    getAircraft(): Promise<AircraftDto[]>;
    searchFlights(params: FlightSearchParams): Promise<FlightSearchResultDto>;

    getRateLimit(): RateLimitInfo;
    isAvailable(): Promise<boolean>;
}

export interface FlightStatusDto {
    flightNumber: string;
    date: string;
    status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'incident' | 'diverted' | 'unknown';
    departure: {
        airport: string;
        scheduled: string;
        estimated?: string;
        actual?: string;
        delay?: number;
    };
    arrival: {
        airport: string;
        scheduled: string;
        estimated?: string;
        actual?: string;
        delay?: number;
    };
    aircraft?: string;
}
