import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type {
    GetFareOptionsHandler,
    GetFlightDetailsHandler,
    SearchFlightHandler,
} from '../application/handlers/search.handlers';

/**
 * SearchMessageHandler — Thin interface for search context.
 * Replaces parts of the old 812-line search.service.ts.
 */
@Controller()
export class SearchMessageHandler {
    constructor(
        private readonly searchHandler: SearchFlightHandler,
        private readonly fareOptionsHandler: GetFareOptionsHandler,
        private readonly flightDetailsHandler: GetFlightDetailsHandler
    ) {}

    @MessagePattern('search_flights')
    async search(payload: any): Promise<any> {
        return this.searchHandler.execute({
            origin: payload.origin,
            destination: payload.destination,
            departureDate: new Date(payload.departureDate),
            returnDate: payload.returnDate ? new Date(payload.returnDate) : undefined,
            passengers: payload.passengers ?? 1,
            cabinClass: payload.cabinClass ?? 'economy',
        });
    }

    @MessagePattern('get_fare_options')
    async fareOptions(payload: { flightInstanceId: string }): Promise<any> {
        return this.fareOptionsHandler.execute(payload.flightInstanceId);
    }

    @MessagePattern('get_flight_details')
    async flightDetails(payload: { flightInstanceId: string }): Promise<any> {
        return this.flightDetailsHandler.execute(payload.flightInstanceId);
    }
}
