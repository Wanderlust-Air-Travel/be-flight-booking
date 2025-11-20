import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { TripType } from 'src/shared/constants/enums';
import { SearchFlightsResponseDto } from './dto/search-flights-response.dto';
import { GetFareOptionsDto, CabinType } from './dto/get-fare-options.dto';
import { FareOptionsResponseDto } from './dto/fare-options-response.dto';
import { FareOptionDto } from './dto/fare-option.dto';

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
		try {
			const payload: SearchFlightsDto = {
				origin: query.origin,
				destination: query.destination,
				departDate: query.departDate,
				returnDate: query.returnDate,
				tripType: query.tripType,
				adults: Number(query.adults),
				minors: Number(query.minors),
			};
			return await firstValueFrom(this.client.send<SearchFlightsResponseDto>('search.flights', payload));
		} catch (error: any) {
			console.error('Search flights error:', error);
			// Re-throw NestJS exceptions as-is
			if (error?.statusCode && error?.message) {
				throw error;
			}
			// Handle microservice connection errors
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Search microservice is not running. Please start it with: npm run start:search');
			}
			// Handle timeout errors
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Search microservice request timeout. Please check if the service is running.');
			}
			// Generic error
			throw new Error(`Search failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get('fare-options')
	@ApiOperation({
		summary: 'Get fare options (cabins) for a flight instance',
		description: 'Get available fare classes (cabins) for a specific flight instance and cabin type (economy or business). Returns list of fare options with prices and available seats.',
	})
	@ApiOkResponse({
		description: 'List of available fare options for the flight instance',
		type: FareOptionsResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters',
	})
	@ApiResponse({
		status: 404,
		description: 'Flight instance not found',
	})
	@ApiQuery({
		name: 'flightInstanceId',
		required: true,
		description: 'Flight instance ID',
		example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
		type: String,
	})
	@ApiQuery({
		name: 'cabinType',
		required: true,
		enum: CabinType,
		description: 'Cabin type: economy or business',
		example: CabinType.ECONOMY,
	})
	async getFareOptions(@Query() query: GetFareOptionsDto): Promise<FareOptionDto[]> {
		try {
			// Manual validation and transformation if needed
			if (!query.flightInstanceId || typeof query.flightInstanceId !== 'string') {
				throw new Error('flightInstanceId is required and must be a string');
			}
			
			const trimmedFlightInstanceId = query.flightInstanceId.trim();
			console.log('[DEBUG] Get fare options request:', {
				original: query.flightInstanceId,
				trimmed: trimmedFlightInstanceId,
				length: trimmedFlightInstanceId.length,
				cabinType: query.cabinType,
			});
			
			const payload: GetFareOptionsDto = {
				flightInstanceId: trimmedFlightInstanceId,
				cabinType: query.cabinType,
			};
			const result = await firstValueFrom(this.client.send<FareOptionsResponseDto>('search.fare-options', payload));
			
			// Return fare options directly (array format for FE compatibility)
			// FE can access: result.fareOptions or result.list (if wrapped)
			return result.fareOptions;
		} catch (error: any) {
			console.error('Get fare options error:', error);
			// Re-throw NestJS exceptions as-is
			if (error?.statusCode && error?.message) {
				throw error;
			}
			// Handle microservice connection errors
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Search microservice is not running. Please start it with: npm run start:search');
			}
			// Handle timeout errors
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Search microservice request timeout. Please check if the service is running.');
			}
			// Generic error
			throw new Error(`Get fare options failed: ${error?.message || 'Unknown error'}`);
		}
	}
}


