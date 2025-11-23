import { Controller, Post, Get, Body, Param, Req, UseGuards, HttpCode, HttpStatus, BadRequestException, InternalServerErrorException, ServiceUnavailableException, HttpException } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { Request } from 'express';
import { RESERVATION_MS } from 'src/microservices/reservation/reservation.messages';
import { ParseUUIDv7Pipe } from 'src/shared/pipes/parse-uuid-v7.pipe';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ReservationController {
	constructor(@Inject('RESERVATION_CLIENT') private readonly client: ClientProxy) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Create a new reservation',
		description:
			'Create a reservation to temporarily hold seats. Supports multi-segment for round-trip bookings. Backend stores segments array in Redis. Reservation expires after 15 minutes (configurable). Requires JWT authentication.',
	})
	@ApiOkResponse({
		description: 'Reservation created successfully',
		type: ReservationResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters, flight not found, or not enough seats',
	})
	async createReservation(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Body() dto: CreateReservationDto,
	): Promise<ReservationResponseDto> {
		try {
			// Extract userId from JWT token (validated by JwtAuthGuard)
			// JWT token is validated at Gateway level, userId is extracted and sent to microservice
			const userId = req.user.userId;
			
			// Send userId to microservice (NOT JWT token)
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.CREATE_RESERVATION, {
					userId, // Send userId (extracted from JWT), NOT token
					dto,
				}),
			);
		} catch (error: any) {
			// Re-throw NestJS exceptions as-is (including BadRequestException, NotFoundException)
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Reservation microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Reservation microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Reservation microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Create reservation failed: ${error.message}`);
			}
			
			// Generic error - log unexpected errors only
			throw new BadRequestException(`Create reservation failed: ${errorMessage}`);
		}
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Get reservation by ID',
		description: 'Get reservation details by reservation ID. Returns reservation information including expiration time.',
	})
	@ApiParam({
		name: 'id',
		description: 'Reservation ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Reservation retrieved successfully',
		type: ReservationResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Reservation not found or expired',
	})
	async getReservation(@Param('id', ParseUUIDv7Pipe) reservationId: string): Promise<ReservationResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.GET_RESERVATION, reservationId),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Reservation microservice is not available. Please ensure the service is running.');
			}
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Reservation microservice connection was closed. Please ensure the service is running.');
			}
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Reservation microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get reservation failed: ${error.message}`);
			}
			throw new BadRequestException(`Get reservation failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get('code/:code')
	@ApiOperation({
		summary: 'Get reservation by code',
		description: 'Get reservation details by reservation code (6 alphanumeric characters).',
	})
	@ApiParam({
		name: 'code',
		description: 'Reservation code (6 alphanumeric characters)',
		example: 'ABC123',
	})
	@ApiOkResponse({
		description: 'Reservation retrieved successfully',
		type: ReservationResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Reservation code not found or expired',
	})
	async getReservationByCode(@Param('code') reservationCode: string): Promise<ReservationResponseDto> {
		// Validate reservation code format BEFORE calling microservice
		// Reservation code should be 6 alphanumeric characters
		const codeRegex = /^[A-Z0-9]{6}$/i;
		if (!codeRegex.test(reservationCode)) {
			throw new BadRequestException('Reservation code must be exactly 6 alphanumeric characters');
		}
		
		try {
			// Send reservation code to microservice - it will auto-detect if it's a code (6 chars) or ID (UUID)
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.GET_RESERVATION, reservationCode),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Reservation microservice is not available. Please ensure the service is running.');
			}
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Reservation microservice connection was closed. Please ensure the service is running.');
			}
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Reservation microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get reservation by code failed: ${error.message}`);
			}
			throw new BadRequestException(`Get reservation by code failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Cancel reservation',
		description: 'Cancel an active reservation. This will release the held seats.',
	})
	@ApiParam({
		name: 'id',
		description: 'Reservation ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Reservation cancelled successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Reservation cancelled successfully' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Reservation not found, expired, or already cancelled',
	})
	async cancelReservation(
		@Param('id', ParseUUIDv7Pipe) reservationId: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			return await firstValueFrom(
				this.client.send<{ success: boolean; message: string }>(
					RESERVATION_MS.PATTERN.CANCEL_RESERVATION,
					reservationId,
				),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Reservation microservice is not available. Please ensure the service is running.');
			}
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Reservation microservice connection was closed. Please ensure the service is running.');
			}
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Reservation microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Cancel reservation failed: ${error.message}`);
			}
			throw new BadRequestException(`Cancel reservation failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get()
	@ApiOperation({
		summary: 'List all active reservations for the current user',
		description: 'Get a list of all active reservations belonging to the authenticated user.',
	})
	@ApiOkResponse({
		description: 'List of reservations retrieved successfully',
		type: [ReservationResponseDto],
	})
	async listReservations(
		@Req() req: Request & { user: { userId: string; email: string } },
	): Promise<ReservationResponseDto[]> {
		try {
			// BEST PRACTICE: Extract userId from JWT token (validated by JwtAuthGuard)
			const userId = req.user.userId;
			
			// Send userId to microservice (NOT JWT token) - Best Practice: Option 2
			return await firstValueFrom(
				this.client.send<ReservationResponseDto[]>(RESERVATION_MS.PATTERN.LIST_RESERVATIONS, userId), // ✅ Send userId, NOT token
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Reservation microservice is not available. Please ensure the service is running.');
			}
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Reservation microservice connection was closed. Please ensure the service is running.');
			}
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Reservation microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`List reservations failed: ${error.message}`);
			}
			throw new BadRequestException(`List reservations failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Post(':id/extend')
	@ApiOperation({
		summary: 'Extend reservation expiration time',
		description: 'Extend the expiration time of an active reservation by a specified number of seconds.',
	})
	@ApiParam({
		name: 'id',
		description: 'Reservation ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Reservation extended successfully',
		type: ReservationResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Reservation not found, expired, or invalid extension time',
	})
	async extendReservation(
		@Param('id', ParseUUIDv7Pipe) reservationId: string,
		@Body() body: { additionalSeconds: number },
	): Promise<ReservationResponseDto> {
		try {
			// Validate additionalSeconds
			if (!body.additionalSeconds || body.additionalSeconds <= 0) {
				throw new BadRequestException('additionalSeconds must be a positive number');
			}
			
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.EXTEND_RESERVATION, {
					reservationId,
					additionalSeconds: body.additionalSeconds,
				}),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Reservation microservice is not available. Please ensure the service is running.');
			}
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Reservation microservice connection was closed. Please ensure the service is running.');
			}
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Reservation microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Extend reservation failed: ${error.message}`);
			}
			throw new BadRequestException(`Extend reservation failed: ${error?.message || 'Unknown error'}`);
		}
	}
}

