import { Controller, Post, Get, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiBearerAuth,
	ApiNotFoundResponse,
	ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { Request } from 'express';
import { BookingStateService } from 'src/shared/services/booking-state.service';
import { SaveCabinSelectionDto } from './dto/save-cabin-selection.dto';
import { SaveSeatSelectionDto } from './dto/save-seat-selection.dto';
import { BookingStateResponseDto } from './dto/booking-state-response.dto';
import {
	BookingStateException,
	BookingStateNotFoundException,
	CabinNotSelectedException,
	BookingStateStorageException,
} from 'src/shared/exceptions/booking-state.exceptions';

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

	@Get(':flightInstanceId')
	@ApiOperation({
		summary: 'Get current booking state',
		description: 'Get current booking state (cabin and seat selections) from Redis for a specific flight instance.',
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
		description: 'Booking state not found',
	})
	async getBookingState(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('flightInstanceId') flightInstanceId: string,
	): Promise<BookingStateResponseDto> {
		const userId = req.user.userId;
		const state = await this.bookingStateService.getBookingState(userId, flightInstanceId);
		
		if (!state) {
			throw new BookingStateNotFoundException(flightInstanceId);
		}

		return state;
	}
}

