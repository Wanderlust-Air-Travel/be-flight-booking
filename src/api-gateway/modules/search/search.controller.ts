import { Controller, Get, Query, BadRequestException, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { TripType, CabinType } from 'src/shared/constants/enums';
import { SearchFlightsResponseDto } from './dto/search-flights-response.dto';
import { GetFareOptionsDto } from './dto/get-fare-options.dto';
import { FareOptionsResponseDto } from './dto/fare-options-response.dto';
import { FareOptionDto } from './dto/fare-option.dto';
import { GetSeatMapDto } from './dto/get-seat-map.dto';
import { SeatMapResponseDto } from './dto/seat-map-response.dto';
import { SEARCH_MS } from 'src/microservices/search/search.messages';

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
			// Validate: origin and destination must be different
			if (query.origin.toUpperCase() === query.destination.toUpperCase()) {
				throw new BadRequestException('Origin and destination airports must be different');
			}
			
			// Validate: departDate must not be in the past
			const departDate = new Date(query.departDate);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (departDate < today) {
				throw new BadRequestException('Departure date cannot be in the past');
			}
			
			// Validate: for round trip, returnDate must be after departDate
			if (query.tripType === TripType.ROUND_TRIP && query.returnDate) {
				const returnDate = new Date(query.returnDate);
				if (returnDate <= departDate) {
					throw new BadRequestException('Return date must be after departure date');
				}
			}
			
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
			// Re-throw NestJS exceptions as-is (including NotFoundException)
			if (error?.statusCode && error?.message) {
				// Map NotFoundException from microservice to 404
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Search microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Search microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Search microservice request timeout. The service may be unavailable or overloaded.');
			}
			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				// Check if message indicates not found
				const message = error.message.toLowerCase();
				if (message.includes('not found') || message.includes('notfound') || 
				    message.includes('not exist') || message.includes('does not exist') ||
				    message.includes('airport not found') || message.includes('route not found') ||
				    message.includes('origin airport not found') || message.includes('destination airport not found') ||
				    message.includes('no domestic route')) {
					throw new NotFoundException(error.message || 'Resource not found');
				}
				// If it's a generic "Internal server error", it might be a not found case
				// Check error details if available
				if (message.includes('internal server error')) {
					// Check error details if available
					if (error?.details) {
						const details = String(error.details).toLowerCase();
						if (details.includes('not found') || details.includes('airport') || details.includes('route')) {
							throw new NotFoundException('Resource not found');
						}
					}
					// If microservice returns generic error, it might be because airport/route doesn't exist
					// This is a fallback: if we get generic error, assume it's a not found case for invalid airport codes
					// This is not ideal but necessary until microservices properly serialize exceptions
					throw new NotFoundException('Airport or route not found. Please check the airport codes and try again.');
				}
				throw new BadRequestException(`Search failed: ${error.message}`);
			}
			// If we get here, it's an unexpected error - log it and return appropriate status
			// Check if it might be a "not found" case first
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException('Resource not found. Please check your search parameters and try again.');
			}
			
			// For any other unexpected errors, return 500 Internal Server Error
			// (This should not happen if microservices are properly configured)
			throw new InternalServerErrorException(`An unexpected error occurred while searching for flights. Please try again later.`);
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
			// Re-throw NestJS exceptions as-is (including NotFoundException)
			if (error?.statusCode && error?.message) {
				// Map NotFoundException from microservice to 404
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessageForFare = error?.message || error?.toString() || '';
			const errorCodeForFare = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCodeForFare === 'ECONNREFUSED' || errorMessageForFare.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Search microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessageForFare.includes('Connection closed') || errorMessageForFare.includes('Connection closed')) {
				throw new ServiceUnavailableException('Search microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCodeForFare === 'ETIMEDOUT' || errorMessageForFare.includes('timeout') || errorMessageForFare.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Search microservice request timeout. The service may be unavailable or overloaded.');
			}
			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				// Check if message indicates not found
				const message = error.message.toLowerCase();
				if (message.includes('not found') || message.includes('notfound') || 
				    message.includes('not exist') || message.includes('does not exist') ||
				    message.includes('flight instance not found') || message.includes('flight not found')) {
					throw new NotFoundException(error.message || 'Flight instance not found');
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error')) {
					// Check error details if available
					if (error?.details) {
						const details = String(error.details).toLowerCase();
						if (details.includes('not found') || details.includes('flight instance')) {
							throw new NotFoundException('Flight instance not found');
						}
					}
					// If microservice returns generic error, it might be because flight instance doesn't exist
					// This is a fallback: if we get generic error, assume it's a not found case for invalid flight instance ID
					// This is not ideal but necessary until microservices properly serialize exceptions
					throw new NotFoundException('Flight instance not found. Please check the flight instance ID and try again.');
				}
				throw new BadRequestException(`Get fare options failed: ${error.message}`);
			}
			
			// If we get here, it's an unexpected error - log it and return appropriate status
			// Check if it might be a "not found" case first
			const lowerErrorMessageForFare = errorMessageForFare.toLowerCase();
			if (lowerErrorMessageForFare.includes('not found') || lowerErrorMessageForFare.includes('not exist')) {
				throw new NotFoundException('Flight instance not found. Please check the flight instance ID and try again.');
			}
			
			// For any other unexpected errors, return 500 Internal Server Error
			throw new InternalServerErrorException(`An unexpected error occurred while getting fare options. Please try again later.`);
		}
	}

	@Get('seats')
	@ApiOperation({
		summary: 'Get seat map for a flight instance',
		description: 'Get available seat map for a specific flight instance and cabin type. Returns seat map grouped by cabin class with seat availability and details.',
	})
	@ApiOkResponse({
		description: 'Seat map for the flight instance',
		type: SeatMapResponseDto,
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
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		type: String,
	})
	@ApiQuery({
		name: 'cabinType',
		required: true,
		enum: CabinType,
		description: 'Cabin type: economy or business',
		example: CabinType.ECONOMY,
	})
	async getSeatMap(@Query() query: GetSeatMapDto): Promise<SeatMapResponseDto> {
		try {
			// Manual validation and transformation if needed
			if (!query.flightInstanceId || typeof query.flightInstanceId !== 'string') {
				throw new BadRequestException('flightInstanceId is required and must be a string');
			}
			
			const trimmedFlightInstanceId = query.flightInstanceId.trim();
			if (!trimmedFlightInstanceId) {
				throw new BadRequestException('flightInstanceId cannot be empty');
			}
			
			const payload: GetSeatMapDto = {
				flightInstanceId: trimmedFlightInstanceId,
				cabinType: query.cabinType,
			};
			const result = await firstValueFrom(this.client.send<SeatMapResponseDto>(SEARCH_MS.PATTERN.GET_SEAT_MAP, payload));
			
			return result;
		} catch (error: any) {
			// Re-throw NestJS exceptions as-is (including NotFoundException, BadRequestException)
			if (error?.statusCode && error?.message) {
				if (error.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				if (error.statusCode === 400) {
					throw new BadRequestException(error.message);
				}
				// Re-throw other HTTP exceptions as-is
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessageForSeat = error?.message || error?.toString() || '';
			const errorCodeForSeat = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCodeForSeat === 'ECONNREFUSED' || errorMessageForSeat.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Search microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessageForSeat.includes('Connection closed') || errorMessageForSeat.includes('Connection closed')) {
				throw new ServiceUnavailableException('Search microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCodeForSeat === 'ETIMEDOUT' || errorMessageForSeat.includes('timeout') || errorMessageForSeat.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Search microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = String(error.message).toLowerCase();
				
				// Check if message indicates not found
				if (message.includes('not found') || message.includes('notfound') || 
				    message.includes('not exist') || message.includes('does not exist') ||
				    message.includes('flight instance not found') || message.includes('flight not found')) {
					throw new NotFoundException(error.message || 'Flight instance not found');
				}
				
				// Handle generic "Internal server error" - might be a not found case
				if (message.includes('internal server error')) {
					// Check error details if available
					if (error?.details) {
						const details = String(error.details).toLowerCase();
						if (details.includes('not found') || details.includes('flight instance')) {
							throw new NotFoundException('Flight instance not found');
						}
					}
					// Fallback: for invalid flight instance ID, assume it's a not found case
					// This handles cases where microservice doesn't properly serialize NotFoundException
					throw new NotFoundException('Flight instance not found. Please check the flight instance ID and try again.');
				}
				
				// Other error messages
				throw new BadRequestException(`Get seat map failed: ${error.message}`);
			}
			
			// If we get here, it's an unexpected error - log it and return appropriate status
			// Check if it might be a "not found" case first
			const lowerErrorMessageForSeat = errorMessageForSeat.toLowerCase();
			if (lowerErrorMessageForSeat.includes('not found') || lowerErrorMessageForSeat.includes('not exist')) {
				throw new NotFoundException('Flight instance not found. Please check the flight instance ID and try again.');
			}
			
			// For any other unexpected errors, return 500 Internal Server Error
			throw new InternalServerErrorException(`An unexpected error occurred while getting seat map. Please try again later.`);
		}
	}
}


