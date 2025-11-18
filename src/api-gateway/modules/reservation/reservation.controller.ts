import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
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

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ReservationController {
	constructor(@Inject('RESERVATION_CLIENT') private readonly client: ClientProxy) {}

	@Post()
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
			const userId = req.user.userId;
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.CREATE_RESERVATION, {
					userId,
					dto,
				}),
			);
		} catch (error: any) {
			console.error('Create reservation error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error(
					'Reservation microservice is not running. Please start it with: npm run start:reservation:dev',
				);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Reservation microservice request timeout. Please check if the service is running.');
			}
			throw new Error(`Create reservation failed: ${error?.message || 'Unknown error'}`);
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
	async getReservation(@Param('id') reservationId: string): Promise<ReservationResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.GET_RESERVATION, reservationId),
			);
		} catch (error: any) {
			console.error('Get reservation error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error(
					'Reservation microservice is not running. Please start it with: npm run start:reservation:dev',
				);
			}
			throw new Error(`Get reservation failed: ${error?.message || 'Unknown error'}`);
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
		try {
			// Send reservation code to microservice - it will auto-detect if it's a code (6 chars) or ID (UUID)
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.GET_RESERVATION, reservationCode),
			);
		} catch (error: any) {
			console.error('Get reservation by code error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error(
					'Reservation microservice is not running. Please start it with: npm run start:reservation:dev',
				);
			}
			throw new Error(`Get reservation by code failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Post(':id/cancel')
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
		@Param('id') reservationId: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			return await firstValueFrom(
				this.client.send<{ success: boolean; message: string }>(
					RESERVATION_MS.PATTERN.CANCEL_RESERVATION,
					reservationId,
				),
			);
		} catch (error: any) {
			console.error('Cancel reservation error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error(
					'Reservation microservice is not running. Please start it with: npm run start:reservation:dev',
				);
			}
			throw new Error(`Cancel reservation failed: ${error?.message || 'Unknown error'}`);
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
			const userId = req.user.userId;
			return await firstValueFrom(
				this.client.send<ReservationResponseDto[]>(RESERVATION_MS.PATTERN.LIST_RESERVATIONS, userId),
			);
		} catch (error: any) {
			console.error('List reservations error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Reservation microservice is not running. Please start it with: npm run start:reservation:dev');
			}
			throw new Error(`List reservations failed: ${error?.message || 'Unknown error'}`);
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
		@Param('id') reservationId: string,
		@Body() body: { additionalSeconds: number },
	): Promise<ReservationResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<ReservationResponseDto>(RESERVATION_MS.PATTERN.EXTEND_RESERVATION, {
					reservationId,
					additionalSeconds: body.additionalSeconds,
				}),
			);
		} catch (error: any) {
			console.error('Extend reservation error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Reservation microservice is not running. Please start it with: npm run start:reservation:dev');
			}
			throw new Error(`Extend reservation failed: ${error?.message || 'Unknown error'}`);
		}
	}
}

