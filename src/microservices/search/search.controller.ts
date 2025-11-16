import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { SEARCH_MS } from './search.messages';
import { SearchService } from './search.service';
import { SearchFlightsDto } from './dto/search-flights.dto';

@Controller()
export class SearchMsController {
	constructor(private readonly searchService: SearchService) {}

	@MessagePattern(SEARCH_MS.PATTERN.SEARCH_FLIGHTS)
	handleSearch(dto: SearchFlightsDto) {
		return this.searchService.search(dto);
	}
}


