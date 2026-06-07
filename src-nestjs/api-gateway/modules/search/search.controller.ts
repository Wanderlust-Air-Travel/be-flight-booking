import {
    BadRequestException,
    Controller,
    Get,
    HttpException,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    Query,
    Req,
    ServiceUnavailableException,
    UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { SEARCH_MS } from 'src/microservices/search/search.messages';
import { CabinType, TripType } from 'src/shared/constants/enums';
import { BookingStateService } from 'src/shared/services/booking-state.service';
import { CabinServiceService } from 'src/shared/services/cabin-service.service';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { AirportListResponseDto } from './dto/airport-list-response.dto';
import {
    type CabinServicePublicDto,
    CabinServicesResponseDto,
} from './dto/cabin-service-public.dto';
import type { FareOptionDto } from './dto/fare-option.dto';
import { FareOptionsResponseDto } from './dto/fare-options-response.dto';
import type { GetCabinServicesDto } from './dto/get-cabin-services.dto';
import type { GetFareOptionsDto } from './dto/get-fare-options.dto';
import type { GetSeatMapDto } from './dto/get-seat-map.dto';
import { SearchFlightsResponseDto } from './dto/search-flights-response.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { SeatMapResponseDto } from './dto/seat-map-response.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
    private readonly logger = new Logger(SearchController.name);

    private get client(): ClientProxy {
        return this._client;
    }

    constructor(
        @Inject('SEARCH_CLIENT') private readonly _client: ClientProxy,
        private readonly bookingStateService: BookingStateService,
        private readonly cabinServiceService: CabinServiceService
    ) {}

    @Get('flights')
    @ApiOperation({
        summary: 'Search available flights',
        description:
            'Search for available domestic flights based on origin, destination, dates, trip type, and passenger count. Returns both scheduled instances and recurring schedules that match the criteria.',
    })
    @ApiOkResponse({
        description: 'List of available flights matching the search criteria',
        type: SearchFlightsResponseDto,
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
                    example: [
                        'returnDate is required when tripType is round_trip',
                        'departDate must be a valid ISO 8601 date string',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Airport or route not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Origin airport not found' },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiQuery({
        name: 'origin',
        required: true,
        description: 'Origin airport IATA code (3 characters, e.g., HAN for Hanoi)',
        example: 'HAN',
        type: String,
    })
    @ApiQuery({
        name: 'destination',
        required: true,
        description: 'Destination airport IATA code (3 characters, e.g., SGN for Ho Chi Minh City)',
        example: 'SGN',
        type: String,
    })
    @ApiQuery({
        name: 'departDate',
        required: true,
        description: 'Departure date in ISO format (YYYY-MM-DD)',
        example: '2025-11-17',
        type: String,
    })
    @ApiQuery({
        name: 'returnDate',
        required: false,
        description:
            'Return date for round trip in ISO format (YYYY-MM-DD). Required when tripType is round_trip',
        example: '2025-11-24',
        type: String,
    })
    @ApiQuery({
        name: 'tripType',
        required: false,
        enum: TripType,
        description:
            'Type of trip: one_way or round_trip. If not provided, defaults to one_way when returnDate is missing, or round_trip when returnDate is provided',
        example: TripType.ONE_WAY,
    })
    @ApiQuery({
        name: 'adults',
        required: true,
        description: 'Number of adult passengers (minimum: 1)',
        example: 1,
        type: Number,
    })
    @ApiQuery({
        name: 'minors',
        required: true,
        description: 'Number of minor passengers (minimum: 0)',
        example: 0,
        type: Number,
    })
    async searchFlights(@Query() query: SearchFlightsDto): Promise<SearchFlightsResponseDto> {
        try {
            // Normalize returnDate: treat empty string or whitespace-only as undefined
            if (!query.returnDate || query.returnDate.trim() === '') {
                query.returnDate = undefined;
            }

            // Auto-set tripType based on returnDate if not provided
            // Logic: Nếu không truyền returnDate (hoặc để trống) → one_way
            //        Nếu có truyền returnDate → round_trip
            let tripType = query.tripType;
            if (!tripType) {
                tripType = query.returnDate ? TripType.ROUND_TRIP : TripType.ONE_WAY;
            }

            // Validate: origin and destination must be different
            if (query.origin.toUpperCase() === query.destination.toUpperCase()) {
                throw new BadRequestException('Origin and destination airports must be different');
            }

            // Validate: departDate must not be in the past
            // Parse departDate as date-only (YYYY-MM-DD) to avoid timezone issues
            const departDateStr = query.departDate.split('T')[0]; // Get date part only
            const departDate = new Date(`${departDateStr}T00:00:00.000Z`); // Use UTC midnight
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues
            if (departDate < today) {
                throw new BadRequestException('Departure date cannot be in the past');
            }

            // Validate: for round trip, returnDate must be provided and after departDate
            if (tripType === TripType.ROUND_TRIP) {
                if (!query.returnDate) {
                    throw new BadRequestException(
                        'returnDate is required when tripType is round_trip'
                    );
                }
                // Parse returnDate as date-only (YYYY-MM-DD) to avoid timezone issues
                const returnDateStr = query.returnDate.split('T')[0]; // Get date part only
                const returnDate = new Date(`${returnDateStr}T00:00:00.000Z`); // Use UTC midnight
                if (returnDate <= departDate) {
                    throw new BadRequestException('Return date must be after departure date');
                }
            }

            const payload: SearchFlightsDto = {
                origin: query.origin,
                destination: query.destination,
                departDate: query.departDate,
                returnDate: query.returnDate,
                tripType: tripType,
                adults: Number(query.adults),
                minors: Number(query.minors),
            };
            this.logger.debug(`Sending search payload to microservice: ${JSON.stringify(payload)}`);
            const message$ = this.client.send<SearchFlightsResponseDto>('search.flights', payload);
            const timeoutMs = 30000;
            const timeout$ = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Search timeout after ${timeoutMs}ms`)), timeoutMs)
            );
            return await Promise.race([firstValueFrom(message$), timeout$]);
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
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
                throw new ServiceUnavailableException(
                    'Search microservice is not available. Please ensure the service is running.'
                );
            }

            // Connection closed - microservice disconnected
            if (
                errorMessage.includes('Connection closed') ||
                errorMessage.includes('Connection closed')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice connection was closed. Please ensure the service is running.'
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice request timeout. The service may be unavailable or overloaded.'
                );
            }
            // Handle microservice error format: { status: 'error', message: '...' }
            if (error?.status === 'error' && error?.message) {
                // Check if message indicates not found
                const message = error.message.toLowerCase();
                if (
                    message.includes('not found') ||
                    message.includes('notfound') ||
                    message.includes('not exist') ||
                    message.includes('does not exist') ||
                    message.includes('airport not found') ||
                    message.includes('route not found') ||
                    message.includes('origin airport not found') ||
                    message.includes('destination airport not found') ||
                    message.includes('no domestic route')
                ) {
                    throw new NotFoundException(error.message || 'Resource not found');
                }
                // If it's a generic "Internal server error", it might be a not found case
                // Check error details if available
                if (message.includes('internal server error')) {
                    // Check error details if available
                    if (error?.details) {
                        const details = String(error.details).toLowerCase();
                        if (
                            details.includes('not found') ||
                            details.includes('airport') ||
                            details.includes('route')
                        ) {
                            throw new NotFoundException('Resource not found');
                        }
                    }
                    // If microservice returns generic error, it might be because airport/route doesn't exist
                    // This is a fallback: if we get generic error, assume it's a not found case for invalid airport codes
                    // This is not ideal but necessary until microservices properly serialize exceptions
                    throw new NotFoundException(
                        'Airport or route not found. Please check the airport codes and try again.'
                    );
                }
                throw new BadRequestException(`Search failed: ${error.message}`);
            }
            // If we get here, it's an unexpected error - log it and return appropriate status
            // Check if it might be a "not found" case first
            const lowerErrorMessage = errorMessage.toLowerCase();
            if (
                lowerErrorMessage.includes('not found') ||
                lowerErrorMessage.includes('not exist')
            ) {
                throw new NotFoundException(
                    'Resource not found. Please check your search parameters and try again.'
                );
            }

            // For any other unexpected errors, return 500 Internal Server Error
            // (This should not happen if microservices are properly configured)
            throw new InternalServerErrorException(
                'An unexpected error occurred while searching for flights. Please try again later.'
            );
        }
    }

    @Get('fare-options')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get fare options (cabins) for a flight instance',
        description:
            'Get available fare classes (cabins) for a specific flight instance and cabin type (economy or business). Returns list of fare options with prices and available seats.',
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
        required: false,
        description:
            'Flight instance ID. Optional - if not provided and user is authenticated, backend will automatically fetch from booking state.',
        example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
        type: String,
    })
    @ApiQuery({
        name: 'cabinType',
        required: false,
        enum: CabinType,
        description:
            'Cabin type: economy or business. Optional - if not provided and user is authenticated, backend will automatically fetch from booking state.',
        example: CabinType.ECONOMY,
    })
    async getFareOptions(
        @Query() query: GetFareOptionsDto,
        @Req() req?: Request & { user?: { userId: string; email: string } }
    ): Promise<FareOptionDto[]> {
        try {
            this.logger.error(`[DEBUG] getFareOptions query keys: ${Object.keys(query || {}).join(', ') || 'none'}`);
            this.logger.error(`[DEBUG] getFareOptions query.flightInstanceId: ${query?.flightInstanceId}`);
            this.logger.error(`[DEBUG] getFareOptions query.cabinType: ${query?.cabinType}`);
            // Auto-fetch flightInstanceId and cabinType from booking state if not provided and user is authenticated
            let flightInstanceId = query.flightInstanceId;
            let cabinType = query.cabinType;

            this.logger.debug('getFareOptions - Before auto-fetch:', {
                hasReq: !!req,
                hasUser: !!req?.user,
                userId: req?.user?.userId,
                queryFlightInstanceId: query.flightInstanceId,
                queryCabinType: query.cabinType,
                needsAutoFetch: !flightInstanceId || !cabinType,
            });

            if ((!flightInstanceId || !cabinType) && req?.user?.userId) {
                // req.user is available when OptionalJwtAuthGuard extracts user from token
                try {
                    this.logger.debug(
                        `Attempting to auto-fetch from booking state for user ${req.user.userId}`
                    );
                    const allStates = await this.bookingStateService.getAllBookingStates(
                        req.user.userId
                    );
                    this.logger.debug(
                        `Found ${allStates.length} booking states for user ${req.user.userId}`
                    );

                    if (allStates.length > 0) {
                        // Get the most recent booking state (first one, sorted by updatedAt if needed)
                        const latestState = allStates[0];
                        this.logger.debug('Latest booking state:', {
                            flightInstanceId: latestState.flightInstanceId,
                            hasCabin: !!latestState.state?.cabin,
                            cabinType: latestState.state?.cabin?.cabinType,
                        });

                        if (!flightInstanceId && latestState.flightInstanceId) {
                            flightInstanceId = latestState.flightInstanceId;
                            this.logger.debug(
                                `Auto-fetched flightInstanceId from booking state: ${flightInstanceId} for user ${req.user.userId}`
                            );
                        }

                        if (!cabinType && latestState.state?.cabin?.cabinType) {
                            cabinType = latestState.state.cabin.cabinType as CabinType;
                            this.logger.debug(
                                `Auto-fetched cabinType from booking state: ${cabinType} for user ${req.user.userId}`
                            );
                        }
                    } else {
                        this.logger.debug(`No booking states found for user ${req.user.userId}`);
                    }
                } catch (error) {
                    // If booking state not found or error, continue without auto-fetch
                    this.logger.error('Error auto-fetching from booking state:', error);
                    this.logger.debug(
                        'Could not auto-fetch flightInstanceId/cabinType from booking state, using provided values or requiring them'
                    );
                }
            }

            this.logger.debug('getFareOptions - After auto-fetch:', {
                flightInstanceId,
                cabinType,
            });

            // Validate flightInstanceId is available (either from query or booking state)
            if (!flightInstanceId || typeof flightInstanceId !== 'string') {
                throw new BadRequestException(
                    'flightInstanceId is required. Either provide it in query parameter or save cabin selection first using POST /api/v1/booking-state/cabin'
                );
            }

            // Validate cabinType is available (either from query or booking state)
            if (!cabinType) {
                throw new BadRequestException(
                    'cabinType is required. Either provide it in query parameter or save cabin selection first using POST /api/v1/booking-state/cabin'
                );
            }

            const trimmedFlightInstanceId = flightInstanceId.trim();
            this.logger.debug('Get fare options request:', {
                original: query.flightInstanceId,
                trimmed: trimmedFlightInstanceId,
                length: trimmedFlightInstanceId.length,
                cabinType: cabinType,
                autoFetched: !query.flightInstanceId || !query.cabinType,
            });

            const payload: GetFareOptionsDto = {
                flightInstanceId: trimmedFlightInstanceId,
                cabinType: cabinType,
            };
            const result = await firstValueFrom(
                this.client.send<FareOptionsResponseDto>('search.fare-options', payload)
            );

            // Return fare options directly (array format for FE compatibility)
            // FE can access: result.fareOptions or result.list (if wrapped)
            return result.fareOptions;
        } catch (error: any) {
            this.logger.error('Get fare options error:', error);
            // Re-throw NestJS HttpException instances as-is (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }
            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                // Map NotFoundException from microservice to 404
                if (error?.statusCode === 404) {
                    throw new NotFoundException(error.message);
                }
                // Re-throw other HTTP exceptions (BadRequestException, etc.)
                if (error?.statusCode >= 400 && error?.statusCode < 500) {
                    throw error;
                }
            }
            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessageForFare = error?.message || error?.toString() || '';
            const errorCodeForFare = error?.code || '';

            // Connection refused - microservice is not running
            if (
                errorCodeForFare === 'ECONNREFUSED' ||
                errorMessageForFare.includes('ECONNREFUSED')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice is not available. Please ensure the service is running.'
                );
            }

            // Connection closed - microservice disconnected
            if (
                errorMessageForFare.includes('Connection closed') ||
                errorMessageForFare.includes('Connection closed')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice connection was closed. Please ensure the service is running.'
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCodeForFare === 'ETIMEDOUT' ||
                errorMessageForFare.includes('timeout') ||
                errorMessageForFare.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice request timeout. The service may be unavailable or overloaded.'
                );
            }
            // Handle microservice error format: { status: 'error', message: '...' }
            if (error?.status === 'error' && error?.message) {
                // Check if message indicates not found
                const message = error.message.toLowerCase();
                if (
                    message.includes('not found') ||
                    message.includes('notfound') ||
                    message.includes('not exist') ||
                    message.includes('does not exist') ||
                    message.includes('flight instance not found') ||
                    message.includes('flight not found')
                ) {
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
                    throw new NotFoundException(
                        'Flight instance not found. Please check the flight instance ID and try again.'
                    );
                }
                throw new BadRequestException(`Get fare options failed: ${error.message}`);
            }

            // If we get here, it's an unexpected error - log it and return appropriate status
            // Check if it might be a "not found" case first
            const lowerErrorMessageForFare = errorMessageForFare.toLowerCase();
            if (
                lowerErrorMessageForFare.includes('not found') ||
                lowerErrorMessageForFare.includes('not exist')
            ) {
                throw new NotFoundException(
                    'Flight instance not found. Please check the flight instance ID and try again.'
                );
            }

            // For any other unexpected errors, return 500 Internal Server Error
            throw new InternalServerErrorException(
                'An unexpected error occurred while getting fare options. Please try again later.'
            );
        }
    }

    @Get('seats')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get seat map for a flight instance',
        description:
            'Get available seat map for a specific flight instance and cabin type. Returns seat map grouped by cabin class with seat availability and details.',
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
        required: false,
        enum: CabinType,
        description:
            'Cabin type: economy or business. Optional - if not provided and user is authenticated, backend will automatically fetch from booking state (if cabin selection was saved).',
        example: CabinType.ECONOMY,
    })
    async getSeatMap(
        @Query() query: GetSeatMapDto,
        @Req() req?: Request & { user?: { userId: string; email: string } }
    ): Promise<SeatMapResponseDto> {
        try {
            // Manual validation and transformation if needed
            if (!query.flightInstanceId || typeof query.flightInstanceId !== 'string') {
                throw new BadRequestException('flightInstanceId is required and must be a string');
            }

            const trimmedFlightInstanceId = query.flightInstanceId.trim();
            if (!trimmedFlightInstanceId) {
                throw new BadRequestException('flightInstanceId cannot be empty');
            }

            // Auto-fetch cabinType from booking state if not provided and user is authenticated
            let cabinType = query.cabinType;
            if (!cabinType && req?.user?.userId) {
                try {
                    const bookingState = await this.bookingStateService.getBookingState(
                        req.user.userId,
                        trimmedFlightInstanceId
                    );
                    if (bookingState?.cabin?.cabinType) {
                        cabinType = bookingState.cabin.cabinType as CabinType;
                        this.logger.debug(
                            `Auto-fetched cabinType from booking state: ${cabinType} for user ${req.user.userId}`
                        );
                    }
                } catch (_error) {
                    // If booking state not found or error, continue without auto-fetch
                    this.logger.debug(
                        'Could not auto-fetch cabinType from booking state, using provided value or requiring it'
                    );
                }
            }

            // Validate cabinType is available (either from query or booking state)
            if (!cabinType) {
                throw new BadRequestException(
                    'cabinType is required. Either provide it in query parameter or save cabin selection first using POST /api/v1/booking-state/cabin'
                );
            }

            const payload: GetSeatMapDto = {
                flightInstanceId: trimmedFlightInstanceId,
                cabinType: cabinType,
            };
            const result = await firstValueFrom(
                this.client.send<SeatMapResponseDto>(SEARCH_MS.PATTERN.GET_SEAT_MAP, payload)
            );

            return result;
        } catch (error: any) {
            this.logger.error('Get seat map error:', error);
            // Re-throw NestJS HttpException instances as-is (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }
            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                if (error.statusCode === 404) {
                    throw new NotFoundException(error.message);
                }
                if (error.statusCode === 400) {
                    throw new BadRequestException(error.message);
                }
                // Re-throw other HTTP exceptions (4xx) as-is
                if (error?.statusCode >= 400 && error?.statusCode < 500) {
                    throw error;
                }
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessageForSeat = error?.message || error?.toString() || '';
            const errorCodeForSeat = error?.code || '';

            // Connection refused - microservice is not running
            if (
                errorCodeForSeat === 'ECONNREFUSED' ||
                errorMessageForSeat.includes('ECONNREFUSED')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice is not available. Please ensure the service is running.'
                );
            }

            // Connection closed - microservice disconnected
            if (
                errorMessageForSeat.includes('Connection closed') ||
                errorMessageForSeat.includes('Connection closed')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice connection was closed. Please ensure the service is running.'
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCodeForSeat === 'ETIMEDOUT' ||
                errorMessageForSeat.includes('timeout') ||
                errorMessageForSeat.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    'Search microservice request timeout. The service may be unavailable or overloaded.'
                );
            }

            // Handle microservice error format: { status: 'error', message: '...' }
            if (error?.status === 'error' && error?.message) {
                const message = String(error.message).toLowerCase();

                // Check if message indicates not found
                if (
                    message.includes('not found') ||
                    message.includes('notfound') ||
                    message.includes('not exist') ||
                    message.includes('does not exist') ||
                    message.includes('flight instance not found') ||
                    message.includes('flight not found')
                ) {
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
                    throw new NotFoundException(
                        'Flight instance not found. Please check the flight instance ID and try again.'
                    );
                }

                // Other error messages
                throw new BadRequestException(`Get seat map failed: ${error.message}`);
            }

            // If we get here, it's an unexpected error - log it and return appropriate status
            // Check if it might be a "not found" case first
            const lowerErrorMessageForSeat = errorMessageForSeat.toLowerCase();
            if (
                lowerErrorMessageForSeat.includes('not found') ||
                lowerErrorMessageForSeat.includes('not exist')
            ) {
                throw new NotFoundException(
                    'Flight instance not found. Please check the flight instance ID and try again.'
                );
            }

            // For any other unexpected errors, return 500 Internal Server Error
            throw new InternalServerErrorException(
                'An unexpected error occurred while getting seat map. Please try again later.'
            );
        }
    }

    @Get('airports')
    @ApiOperation({
        summary: 'Get list of all available airports',
        description:
            'Returns a list of all airports sorted by city name. Used for frontend dropdown selection in flight search form.',
    })
    @ApiOkResponse({
        description: 'List of all available airports',
        type: AirportListResponseDto,
    })
    @ApiResponse({
        status: 500,
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: {
                    type: 'string',
                    example: 'An unexpected error occurred while getting airports',
                },
                error: { type: 'string', example: 'Internal Server Error' },
            },
        },
    })
    async getAirports(): Promise<AirportListResponseDto> {
        try {
            this.logger.log('Get airports list');
            const result = await firstValueFrom(
                this.client.send<AirportListResponseDto>(SEARCH_MS.PATTERN.GET_AIRPORTS, {})
            );
            this.logger.log(`Found ${result.airports?.length || 0} airports`);
            return result;
        } catch (error: any) {
            this.logger.error('Get airports error:', error);

            // Re-throw HttpException instances
            if (error instanceof HttpException) {
                throw error;
            }

            // For any other unexpected errors, return 500 Internal Server Error
            throw new InternalServerErrorException(
                'An unexpected error occurred while getting airports. Please try again later.'
            );
        }
    }

    @Get('cabin-services')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get cabin services for a fare class',
        description:
            'Get all available cabin services (meals, WiFi, etc.) for a specific fare class. Returns services that are included and services available for purchase.',
    })
    @ApiOkResponse({
        description: 'List of cabin services for the fare class',
        type: CabinServicesResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters',
    })
    async getCabinServices(@Query() query: GetCabinServicesDto): Promise<CabinServicesResponseDto> {
        try {
            const services = await this.cabinServiceService.getCabinServices(
                query.fareClassCode,
                query.cabinClassCode
            );

            // Transform to public DTO
            const serviceDtos: CabinServicePublicDto[] = services.map((service) => ({
                cabinServiceId: service.cabin_service_id,
                serviceType: service.service_type,
                serviceName: service.service_name,
                description: service.description,
                isIncluded: service.is_included,
                price: service.price,
                displayOrder: service.display_order,
                iconUrl: service.icon_url,
            }));

            // Calculate total price of services that are not included (for purchase)
            const totalPrice = serviceDtos
                .filter((s) => !s.isIncluded && s.price !== null)
                .reduce((sum, s) => sum + (s.price || 0), 0);

            return {
                services: serviceDtos,
                totalPrice,
            };
        } catch (error: any) {
            this.logger.error('Get cabin services error:', error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new InternalServerErrorException(
                `Failed to retrieve cabin services: ${error?.message || 'Unknown error'}`
            );
        }
    }
}
