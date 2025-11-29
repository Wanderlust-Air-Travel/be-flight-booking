import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException, Headers, Logger } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiBearerAuth,
	ApiNotFoundResponse,
	ApiInternalServerErrorResponse,
	ApiNoContentResponse,
	ApiHeader,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { Request } from 'express';
import { BookingStateService } from 'src/shared/services/booking-state.service';
import { SaveCabinSelectionDto } from './dto/save-cabin-selection.dto';
import { SaveSeatSelectionDto } from './dto/save-seat-selection.dto';
import { BookingStateResponseDto } from './dto/booking-state-response.dto';
import { AllBookingStatesResponseDto } from './dto/all-booking-states-response.dto';
import {
	BookingStateException,
	BookingStateNotFoundException,
	CabinNotSelectedException,
	BookingStateStorageException,
	InvalidFareClassException,
} from 'src/shared/exceptions/booking-state.exceptions';
import { ParseUUIDv7Pipe } from 'src/shared/pipes/parse-uuid-v7.pipe';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { SessionHelper } from 'src/shared/utils/session-helper';

@ApiTags('booking-state')
@Controller('booking-state')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth('access-token')
export class BookingStateController {
	private readonly logger = new Logger(BookingStateController.name);

	constructor(
		private readonly bookingStateService: BookingStateService,
		@InjectRepository(FlightSeat) private readonly flightSeatRepo: Repository<FlightSeat>,
		@InjectRepository(FlightInstance) private readonly flightInstanceRepo: Repository<FlightInstance>,
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
	) {}

	@Post('cabin')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Save cabin selection',
		description:
			'Save cabin selection (cabin type and fare class) to Redis. This must be done before selecting a seat. State expires after 30 minutes. Supports both authenticated users and guest users (via X-Session-Id header).',
	})
	@ApiHeader({
		name: 'X-Session-Id',
		description: 'Session ID for guest users (optional, required if not authenticated)',
		required: false,
	})
	@ApiOkResponse({
		description: 'Cabin selection saved successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Cabin selection saved successfully' },
				sessionId: { type: 'string', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71', description: 'Session ID (only for guest users)' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters',
	})
	@ApiInternalServerErrorResponse({
		description: 'Failed to save cabin selection to Redis',
	})
	async saveCabinSelection(
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Headers('x-session-id') sessionIdHeader: string | undefined,
		@Body() dto: SaveCabinSelectionDto,
	): Promise<{ success: boolean; message: string; sessionId?: string }> {
		const userId = req.user?.userId || null;
		const isGuest = !userId;
		
		// For guest users, get or generate session ID
		let sessionId: string | null = null;
		if (isGuest) {
			sessionId = sessionIdHeader || SessionHelper.generateSessionId();
		}
		
		const identifier = userId || sessionId!;
		
		try {
			const result = await this.bookingStateService.saveCabinSelection(identifier, dto, isGuest);
			
			// Return sessionId for guest users so frontend can use it in subsequent requests
			if (isGuest) {
				return { ...result, sessionId: sessionId! };
			}
			
			return result;
		} catch (error) {
			// Re-throw custom exceptions as-is
			if (error instanceof BookingStateException) {
				throw error;
			}
			// Wrap unexpected errors
			throw new BookingStateStorageException('save cabin selection', error instanceof Error ? error.message : String(error));
		}
	}

	@Post('seat')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Save seat selection',
		description:
			'Save seat selection to Redis. Cabin must be selected first. State expires after 30 minutes. Supports both authenticated users and guest users (via X-Session-Id header).',
	})
	@ApiHeader({
		name: 'X-Session-Id',
		description: 'Session ID for guest users (optional, required if not authenticated)',
		required: false,
	})
	@ApiOkResponse({
		description: 'Seat selection saved successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Seat selection saved successfully' },
				sessionId: { type: 'string', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71', description: 'Session ID (only for guest users)' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters or cabin not selected',
	})
	@ApiInternalServerErrorResponse({
		description: 'Failed to save seat selection to Redis',
	})
	async saveSeatSelection(
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Headers('x-session-id') sessionIdHeader: string | undefined,
		@Body() dto: SaveSeatSelectionDto,
	): Promise<{ success: boolean; message: string; sessionId?: string }> {
		const userId = req.user?.userId || null;
		const sessionId = sessionIdHeader || null;
		
		// Log for debugging
		this.logger.log(`[saveSeatSelection] userId: ${userId}, sessionId: ${sessionId}, flightInstanceId: ${dto.flightInstanceId}`);
		
		// BEST PRACTICE: Try to find booking state with both userId and sessionId
		// This handles cases where JWT token expires between cabin and seat selection
		// Priority: userId (authenticated) > sessionId (guest)
		let identifier: string;
		let isGuest: boolean;
		let fallbackIdentifier: string | undefined;
		let fallbackIsGuest: boolean | undefined;
		
		if (userId) {
			// User is authenticated - try with userId first
			identifier = userId;
			isGuest = false;
			
			// If have sessionId, use it as fallback
			if (sessionId) {
				fallbackIdentifier = sessionId;
				fallbackIsGuest = true;
				this.logger.log(`[saveSeatSelection] Authenticated user with sessionId fallback: ${sessionId}`);
			}
		} else {
			// User is guest - sessionId is required
			if (!sessionId) {
				this.logger.error(`[saveSeatSelection] Guest user without sessionId for flight ${dto.flightInstanceId}`);
				throw new BadRequestException('X-Session-Id header is required for guest users. Please provide the session ID from the cabin selection response.');
			}
			identifier = sessionId;
			isGuest = true;
			this.logger.log(`[saveSeatSelection] Guest user with sessionId: ${sessionId}`);
		}
		
		try {
			// BEST PRACTICE: Validate seat before saving to booking state
			// This provides early validation feedback to users
			// Pass fallback identifier to try both userId and sessionId if needed
			await this.validateSeatSelection(dto, identifier, isGuest, fallbackIdentifier, fallbackIsGuest);
			
			const result = await this.bookingStateService.saveSeatSelection(identifier, dto, isGuest);
			
			// Return sessionId for guest users so frontend can use it in subsequent requests
			if (isGuest) {
				return { ...result, sessionId: sessionId! };
			}
			
			return result;
		} catch (error) {
			// Re-throw custom exceptions as-is (including validation errors)
			if (error instanceof BookingStateException || error instanceof BadRequestException || error instanceof NotFoundException) {
				throw error;
			}
			// Wrap unexpected errors
			throw new BookingStateStorageException('save seat selection', error instanceof Error ? error.message : String(error));
		}
	}

	/**
	 * Validate seat selection before saving to booking state
	 * Business logic: Ensures seat exists, is available, belongs to correct flight instance, and matches cabin class
	 */
	private async validateSeatSelection(
		dto: SaveSeatSelectionDto, 
		identifier: string, 
		isGuest: boolean = false,
		fallbackIdentifier?: string,
		fallbackIsGuest?: boolean
	): Promise<void> {
		// 1. Get booking state to check cabin selection
		// Try with primary identifier first
		this.logger.log(`[validateSeatSelection] Trying with identifier: ${identifier}, isGuest: ${isGuest}, flightInstanceId: ${dto.flightInstanceId}`);
		let bookingState = await this.bookingStateService.getBookingState(identifier, dto.flightInstanceId, isGuest);
		
		// If not found and have fallback identifier, try with fallback
		// This handles cases where cabin was saved with different identifier (e.g., userId vs sessionId)
		if ((!bookingState || !bookingState.cabin) && fallbackIdentifier && fallbackIsGuest !== undefined) {
			this.logger.log(`[validateSeatSelection] Not found with primary identifier, trying fallback: ${fallbackIdentifier}, isGuest: ${fallbackIsGuest}`);
			bookingState = await this.bookingStateService.getBookingState(fallbackIdentifier, dto.flightInstanceId, fallbackIsGuest);
		}
		
		if (!bookingState || !bookingState.cabin) {
			this.logger.error(`[validateSeatSelection] Cabin not found for identifier: ${identifier}, isGuest: ${isGuest}, flightInstanceId: ${dto.flightInstanceId}, fallback: ${fallbackIdentifier}`);
			throw new CabinNotSelectedException(dto.flightInstanceId);
		}
		
		this.logger.log(`[validateSeatSelection] Found cabin selection: ${bookingState.cabin.cabinType}, fareClass: ${bookingState.cabin.fareClassCode}`);

		// 2. Validate flight instance exists
		const flightInstance = await this.flightInstanceRepo.findOne({
			where: { flight_instance_id: dto.flightInstanceId },
		});
		if (!flightInstance) {
			throw new NotFoundException(`Flight instance ${dto.flightInstanceId} not found`);
		}

		// 3. Validate seat exists and load relations
		const flightSeat = await this.flightSeatRepo.findOne({
			where: { flight_seat_id: dto.flightSeatId },
			relations: ['seat_config', 'seat_config.cabin_class', 'flight_instance'],
		});

		if (!flightSeat) {
			throw new BadRequestException(`Seat ${dto.flightSeatId} not found. Please select a valid seat.`);
		}

		// 4. Validate seat belongs to the correct flight instance
		if (flightSeat.flight_instance_id !== dto.flightInstanceId) {
			throw new BadRequestException(
				`Seat ${dto.seatNumber} (${dto.flightSeatId}) does not belong to flight instance ${dto.flightInstanceId}. Please select a seat from the correct flight.`,
			);
		}

		// 5. Validate seat number matches
		if (flightSeat.seat_number !== dto.seatNumber) {
			throw new BadRequestException(
				`Seat number mismatch. Expected ${flightSeat.seat_number} for seat ${dto.flightSeatId}, but received ${dto.seatNumber}.`,
			);
		}

		// 6. Validate seat is available
		if (!flightSeat.is_available) {
			throw new BadRequestException(`Seat ${dto.seatNumber} is not available. Please select another seat.`);
		}

		// 7. Validate seat matches cabin class from booking state
		// Get fare class to determine expected cabin class
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: bookingState.cabin.fareClassCode },
			relations: ['cabin_class'],
		});

		if (!fareClass) {
			throw new BadRequestException(`Fare class ${bookingState.cabin.fareClassCode} not found`);
		}

		const expectedCabinClassCode = fareClass.cabin_class.cabin_class_code;
		const actualCabinClassCode = flightSeat.seat_config.cabin_class.cabin_class_code;

		if (actualCabinClassCode !== expectedCabinClassCode) {
			throw new BadRequestException(
				`Seat ${dto.seatNumber} is in ${actualCabinClassCode === 'Y' ? 'Economy' : 'Business'} class, but you selected ${expectedCabinClassCode === 'Y' ? 'Economy' : 'Business'} class. Please select a seat from the correct cabin.`,
			);
		}
	}

	@Get()
	@ApiOperation({
		summary: 'Get all booking states',
		description:
			'Get all booking states (cabin and seat selections) for the authenticated user or guest session. Returns array of booking states with flightInstanceId. Useful for frontend to get flightInstanceId without storing in session.',
	})
	@ApiHeader({
		name: 'X-Session-Id',
		description: 'Session ID for guest users (optional, required if not authenticated)',
		required: false,
	})
	@ApiOkResponse({
		description: 'List of all booking states',
		type: AllBookingStatesResponseDto,
	})
	async getAllBookingStates(
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Headers('x-session-id') sessionIdHeader: string | undefined,
	): Promise<AllBookingStatesResponseDto> {
		const userId = req.user?.userId || null;
		const isGuest = !userId;
		
		if (isGuest && !sessionIdHeader) {
			throw new BadRequestException('X-Session-Id header is required for guest users.');
		}
		
		const identifier = userId || sessionIdHeader!;
		const allStates = await this.bookingStateService.getAllBookingStates(identifier, isGuest);
		
		return {
			states: allStates.map(({ flightInstanceId, state }) => ({
				flightInstanceId,
				cabin: state.cabin,
				seat: state.seat,
				updatedAt: state.updatedAt,
			})),
		};
	}

	@Get(':flightInstanceId')
	@ApiOperation({
		summary: 'Get current booking state',
		description: 'Get current booking state (cabin and seat selections) from Redis for a specific flight instance. Recommended to call before creating reservation to verify state. Supports both authenticated users and guest users (via X-Session-Id header).',
	})
	@ApiHeader({
		name: 'X-Session-Id',
		description: 'Session ID for guest users (optional, required if not authenticated)',
		required: false,
	})
	@ApiParam({
		name: 'flightInstanceId',
		description: 'Flight instance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Booking state retrieved successfully',
		type: BookingStateResponseDto,
	})
	@ApiNotFoundResponse({
		description: 'Booking state not found (expired or never created)',
	})
	async getBookingState(
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Headers('x-session-id') sessionIdHeader: string | undefined,
		@Param('flightInstanceId', ParseUUIDv7Pipe) flightInstanceId: string,
	): Promise<BookingStateResponseDto> {
		const userId = req.user?.userId || null;
		const isGuest = !userId;
		
		if (isGuest && !sessionIdHeader) {
			throw new BadRequestException('X-Session-Id header is required for guest users.');
		}
		
		const identifier = userId || sessionIdHeader!;
		const state = await this.bookingStateService.getBookingState(identifier, flightInstanceId, isGuest);
		
		if (!state) {
			throw new BookingStateNotFoundException(flightInstanceId);
		}

		return state;
	}

	@Delete(':flightInstanceId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Clear booking state',
		description:
			'Clear booking state (cabin and seat selections) from Redis for a specific flight instance. Useful when user wants to start over or cancel the booking process. State is automatically cleared after successful reservation creation. Supports both authenticated users and guest users (via X-Session-Id header).',
	})
	@ApiHeader({
		name: 'X-Session-Id',
		description: 'Session ID for guest users (optional, required if not authenticated)',
		required: false,
	})
	@ApiParam({
		name: 'flightInstanceId',
		description: 'Flight instance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiNoContentResponse({
		description: 'Booking state cleared successfully (or did not exist)',
	})
	@ApiNotFoundResponse({
		description: 'Booking state not found (already cleared or expired)',
	})
	async clearBookingState(
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Headers('x-session-id') sessionIdHeader: string | undefined,
		@Param('flightInstanceId', ParseUUIDv7Pipe) flightInstanceId: string,
	): Promise<void> {
		const userId = req.user?.userId || null;
		const isGuest = !userId;
		
		if (isGuest && !sessionIdHeader) {
			throw new BadRequestException('X-Session-Id header is required for guest users.');
		}
		
		const identifier = userId || sessionIdHeader!;
		const deleted = await this.bookingStateService.clearBookingState(identifier, flightInstanceId, isGuest);
		
		// Return 204 No Content regardless of whether state existed or not (idempotent)
		// This follows REST best practice: DELETE is idempotent
		if (!deleted) {
			// State didn't exist, but we still return 204 (idempotent behavior)
			// This is acceptable as DELETE operations should be idempotent
		}
	}
}

