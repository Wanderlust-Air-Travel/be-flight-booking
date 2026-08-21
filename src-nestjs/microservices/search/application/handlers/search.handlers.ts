import { Inject, Injectable } from '@nestjs/common';
import type { IOutboxWriter } from '../../../../shared/application/ports/outbox-writer.interface';

/**
 * FlightSearch — Aggregate (read mostly) for flight search criteria/results.
 *
 * Rich model: validates search inputs and tracks recent searches for analytics.
 */
export interface FlightSearchInput {
    origin: string;
    destination: string;
    departureDate: Date;
    returnDate?: Date;
    passengers: number;
    cabinClass: 'economy' | 'business' | 'first';
}

export interface FlightSearchResult {
    flightInstanceId: string;
    airline: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: Date;
    arrivalTime: Date;
    duration: number; // minutes
    availableSeats: number;
    fareClassCode: string;
    price: number;
    currency: string;
}

/**
 * ISearchAdapter — Port to underlying flight data provider (own routes context or external).
 */
export interface ISearchAdapter {
    searchFlights(input: FlightSearchInput): Promise<FlightSearchResult[]>;
    getFareOptions(flightInstanceId: string): Promise<FlightSearchResult[]>;
    getFlightDetails(flightInstanceId: string): Promise<FlightSearchResult | null>;
}

/**
 * SearchFlightHandler — Application use case for searching flights.
 */
@Injectable()
export class SearchFlightHandler {
    constructor(
        @Inject('ISearchAdapter') private readonly adapter: ISearchAdapter,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(input: FlightSearchInput): Promise<FlightSearchResult[]> {
        if (input.origin === input.destination) {
            throw new Error('Origin and destination must differ');
        }
        if (input.passengers <= 0 || input.passengers > 9) {
            throw new Error('Passengers must be between 1 and 9');
        }
        return this.adapter.searchFlights(input);
    }
}

export const SEARCH_FLIGHT_HANDLER = 'SearchFlightHandler';

@Injectable()
export class GetFareOptionsHandler {
    constructor(@Inject('ISearchAdapter') private readonly adapter: ISearchAdapter) {}

    async execute(flightInstanceId: string): Promise<FlightSearchResult[]> {
        return this.adapter.getFareOptions(flightInstanceId);
    }
}

@Injectable()
export class GetFlightDetailsHandler {
    constructor(@Inject('ISearchAdapter') private readonly adapter: ISearchAdapter) {}

    async execute(flightInstanceId: string): Promise<FlightSearchResult | null> {
        return this.adapter.getFlightDetails(flightInstanceId);
    }
}
