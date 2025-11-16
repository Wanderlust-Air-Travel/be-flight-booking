import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SearchFlightsDto, TripType } from './dto/search-flights.dto';
import { SearchFlightsResponseDto } from './dto/search-flights-response.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
	constructor(@Inject('SEARCH_CLIENT') private readonly client: ClientProxy) {}

	@Get('flights')
	@ApiOperation({ 
		summary: 'Search available flights',
		description: 'Search for available domestic flights based on origin, destination, dates, trip type, and passenger count. Returns both scheduled instances and recurring schedules that match the criteria.'
	})
	@ApiOkResponse({ 
		description: 'List of available flights matching the search criteria', 
		type: SearchFlightsResponseDto 
	})
	@ApiBadRequestResponse({ 
		description: 'Invalid request parameters or validation failed',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: { 
					type: 'array', 
					items: { type: 'string' },
					example: ['returnDate is required when tripType is round_trip', 'departDate must be a valid ISO 8601 date string']
				},
				error: { type: 'string', example: 'Bad Request' }
			}
		}
	})
	@ApiResponse({ 
		status: 404, 
		description: 'Airport or route not found',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 404 },
				message: { type: 'string', example: 'Origin airport not found' },
				error: { type: 'string', example: 'Not Found' }
			}
		}
	})
	@ApiQuery({ 
		name: 'origin', 
		required: true,
		description: 'Origin airport IATA code (3 characters, e.g., HAN for Hanoi)',
		example: 'HAN',
		type: String
	})
	@ApiQuery({ 
		name: 'destination', 
		required: true,
		description: 'Destination airport IATA code (3 characters, e.g., SGN for Ho Chi Minh City)',
		example: 'SGN',
		type: String
	})
	@ApiQuery({ 
		name: 'departDate', 
		required: true,
		description: 'Departure date in ISO format (YYYY-MM-DD)',
		example: '2025-11-17',
		type: String
	})
	@ApiQuery({ 
		name: 'returnDate', 
		required: false,
		description: 'Return date for round trip in ISO format (YYYY-MM-DD). Required when tripType is round_trip',
		example: '2025-11-24',
		type: String
	})
	@ApiQuery({ 
		name: 'tripType', 
		required: true,
		enum: TripType,
		description: 'Type of trip: one_way or round_trip',
		example: TripType.ONE_WAY
	})
	@ApiQuery({ 
		name: 'adults', 
		required: true,
		description: 'Number of adult passengers (minimum: 1)',
		example: 1,
		type: Number
	})
	@ApiQuery({ 
		name: 'minors', 
		required: true,
		description: 'Number of minor passengers (minimum: 0)',
		example: 0,
		type: Number
	})
	async searchFlights(@Query() query: SearchFlightsDto): Promise<SearchFlightsResponseDto> {
		const payload: SearchFlightsDto = {
			origin: query.origin,
			destination: query.destination,
			departDate: query.departDate,
			returnDate: query.returnDate,
			tripType: query.tripType,
			adults: Number(query.adults),
			minors: Number(query.minors),
		};
		return firstValueFrom(this.client.send<SearchFlightsResponseDto>('search.flights', payload));
	}
}


