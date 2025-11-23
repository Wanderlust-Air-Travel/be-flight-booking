import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
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
} from 'src/shared/exceptions/booking-state.exceptions';
import { ParseUUIDv7Pipe } from 'src/shared/pipes/parse-uuid-v7.pipe';

@ApiTags('booking-state')
@Controller('booking-state')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class BookingStateController {
	constructor(private readonly bookingStateService: BookingStateService) {}

	@Post('cabin')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Save cabin selection',
		description:
			'Save cabin selection (cabin type and fare class) to Redis. This must be done before selecting a seat. State expires after 30 minutes.',
	})
	@ApiOkResponse({
		description: 'Cabin selection saved successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Cabin selection saved successfully' },
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
		@Req() req: Request & { user: { userId: string; email: string } },
		@Body() dto: SaveCabinSelectionDto,
	): Promise<{ success: boolean; message: string }> {
		const userId = req.user.userId;
		try {
			return await this.bookingStateService.saveCabinSelection(userId, dto);
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
			'Save seat selection to Redis. Cabin must be selected first. State expires after 30 minutes.',
	})
	@ApiOkResponse({
		description: 'Seat selection saved successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Seat selection saved successfully' },
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
		@Req() req: Request & { user: { userId: string; email: string } },
		@Body() dto: SaveSeatSelectionDto,
	): Promise<{ success: boolean; message: string }> {
		const userId = req.user.userId;
		try {
			return await this.bookingStateService.saveSeatSelection(userId, dto);
		} catch (error) {
			// Re-throw custom exceptions as-is
			if (error instanceof BookingStateException) {
				throw error;
			}
			// Wrap unexpected errors
			throw new BookingStateStorageException('save seat selection', error instanceof Error ? error.message : String(error));
		}
	}

	@Get()
	@ApiOperation({
		summary: 'Get all booking states',
		description:
			'Get all booking states (cabin and seat selections) for the authenticated user. Returns array of booking states with flightInstanceId. Useful for frontend to get flightInstanceId without storing in session.',
	})
	@ApiOkResponse({
		description: 'List of all booking states for the user',
		type: AllBookingStatesResponseDto,
	})
	async getAllBookingStates(
		@Req() req: Request & { user: { userId: string; email: string } },
	): Promise<AllBookingStatesResponseDto> {
		const userId = req.user.userId;
		const allStates = await this.bookingStateService.getAllBookingStates(userId);
		
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
		description: 'Get current booking state (cabin and seat selections) from Redis for a specific flight instance. Recommended to call before creating reservation to verify state.',
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
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('flightInstanceId', ParseUUIDv7Pipe) flightInstanceId: string,
	): Promise<BookingStateResponseDto> {
		const userId = req.user.userId;
		const state = await this.bookingStateService.getBookingState(userId, flightInstanceId);
		
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
			'Clear booking state (cabin and seat selections) from Redis for a specific flight instance. Useful when user wants to start over or cancel the booking process. State is automatically cleared after successful reservation creation.',
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
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('flightInstanceId', ParseUUIDv7Pipe) flightInstanceId: string,
	): Promise<void> {
		const userId = req.user.userId;
		const deleted = await this.bookingStateService.clearBookingState(userId, flightInstanceId);
		
		// Return 204 No Content regardless of whether state existed or not (idempotent)
		// This follows REST best practice: DELETE is idempotent
		if (!deleted) {
			// State didn't exist, but we still return 204 (idempotent behavior)
			// This is acceptable as DELETE operations should be idempotent
		}
	}
}

