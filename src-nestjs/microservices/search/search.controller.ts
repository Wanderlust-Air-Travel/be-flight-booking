import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AirportListResponseDto } from './dto/airport-list-response.dto';
import { GetFareOptionsDto } from './dto/get-fare-options.dto';
import { GetSeatMapDto } from './dto/get-seat-map.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { SEARCH_MS } from './search.messages';
import { SearchService } from './search.service';

@Controller()
export class SearchMsController {
    private readonly logger = new Logger(SearchMsController.name);

    constructor(private readonly searchService: SearchService) {}

    @MessagePattern(SEARCH_MS.PATTERN.SEARCH_FLIGHTS)
    async handleSearch(@Payload() data: SearchFlightsDto) {
        try {
            this.logger.debug(`Search flights - received data type: ${typeof data}, isArray: ${Array.isArray(data)}, isObject: ${typeof data === 'object' && data !== null}`);
            this.logger.debug(`Search flights - data value: ${JSON.stringify(data)}`);
            if (!data || typeof data !== 'object') {
                throw new Error(`Invalid data received: ${JSON.stringify(data)}`);
            }
            const result = await this.searchService.search(data);
            this.logger.log(`Found ${result.outbound?.length || 0} outbound flights`);
            return result;
        } catch (error: any) {
            this.logger.error('Search flights error:', error);
            // Re-throw để NestJS exception filter xử lý
            throw error;
        }
    }

    @MessagePattern(SEARCH_MS.PATTERN.GET_FARE_OPTIONS)
    async handleGetFareOptions(dto: GetFareOptionsDto) {
        try {
            this.logger.log(`Get fare options: ${dto.flightInstanceId} - ${dto.cabinType}`);
            const result = await this.searchService.getFareOptions(dto);
            this.logger.log(`Found ${result.fareOptions?.length || 0} fare options`);
            return result;
        } catch (error: any) {
            this.logger.error('Get fare options error:', error);
            // Re-throw để NestJS exception filter xử lý
            throw error;
        }
    }

    @MessagePattern(SEARCH_MS.PATTERN.GET_SEAT_MAP)
    async handleGetSeatMap(dto: GetSeatMapDto) {
        try {
            this.logger.log(`Get seat map: ${dto.flightInstanceId} - ${dto.cabinType}`);
            const result = await this.searchService.getSeatMap(dto);
            this.logger.log(`Found ${result.seats.length} cabin groups with seats`);
            return result;
        } catch (error: any) {
            this.logger.error('Get seat map error:', error);
            // Re-throw để NestJS exception filter xử lý
            throw error;
        }
    }

    @MessagePattern(SEARCH_MS.PATTERN.GET_AIRPORTS)
    async handleGetAirports(): Promise<AirportListResponseDto> {
        try {
            this.logger.log('Get airports list');
            const airports = await this.searchService.getAirports();
            this.logger.log(`Found ${airports.length} airports`);
            return { airports };
        } catch (error: any) {
            this.logger.error('Get airports error:', error);
            // Re-throw để NestJS exception filter xử lý
            throw error;
        }
    }
}
