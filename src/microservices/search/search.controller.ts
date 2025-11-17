import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { SEARCH_MS } from './search.messages';
import { SearchService } from './search.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { GetFareOptionsDto } from './dto/get-fare-options.dto';

@Controller()
export class SearchMsController {
	private readonly logger = new Logger(SearchMsController.name);

	constructor(private readonly searchService: SearchService) {}

	@MessagePattern(SEARCH_MS.PATTERN.SEARCH_FLIGHTS)
	async handleSearch(dto: SearchFlightsDto) {
		try {
			this.logger.log(`Search flights: ${dto.origin} -> ${dto.destination} on ${dto.departDate}`);
			const result = await this.searchService.search(dto);
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
}


