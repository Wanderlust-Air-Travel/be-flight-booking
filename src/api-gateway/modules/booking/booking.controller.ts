import { Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UpdateBookingPassengersDto } from './dto/update-booking-passengers.dto';
import { BookingFareDetailsResponseDto } from './dto/booking-fare-details-response.dto';
import { BookingPaymentInfoResponseDto } from './dto/booking-payment-info-response.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { User } from 'src/shared/entities/user/user.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { Request } from 'express';
import { BOOKING_MS } from 'src/microservices/booking/booking.messages';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class BookingController {
	constructor(
		@Inject('BOOKING_CLIENT') private readonly client: ClientProxy,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(Passenger) private readonly passengerRepo: Repository<Passenger>,
	) {}

	@Post()
	@ApiOperation({
		summary: 'Create a new booking',
		description: 'Create a new flight booking with passengers and segments. Returns booking ID and PNR code. Requires JWT authentication. User ID is extracted from JWT token. Contact info is optional - if not provided, will use user info from database.',
	})
	@ApiOkResponse({
		description: 'Booking created successfully',
		type: CreateBookingResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters or validation failed',
	})
	async createBooking(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Body() dto: CreateBookingDto,
	): Promise<CreateBookingResponseDto> {
		try {
			// Extract userId from JWT token
			const userId = req.user.userId;

			// Get user info from database
			const user = await this.userRepo.findOne({ where: { user_id: userId } });
			if (!user) {
				throw new Error('User not found');
			}

			// Determine contact info:
			// 1. If provided in body → use it (allow override)
			// 2. If not provided and only 1 passenger → try to use passenger's contact info (if passenger belongs to user)
			// 3. Otherwise → use user's contact info (booking contact person)
			let contactFullname = dto.contactFullname;
			let contactEmail = dto.contactEmail;
			let contactPhone = dto.contactPhone;

			if (!contactFullname || !contactEmail || !contactPhone) {
				// If only 1 passenger and passenger belongs to this user, use passenger info
				if (dto.passengers && dto.passengers.length === 1 && dto.passengers[0].passengerId) {
					const passenger = await this.passengerRepo.findOne({
						where: { passenger_id: dto.passengers[0].passengerId },
					});

					// If passenger exists and belongs to this user, use passenger's name
					// Note: Passenger doesn't have email/phone, so we'll use user's email/phone
					if (passenger && passenger.user_id === userId) {
						contactFullname = contactFullname || passenger.fullname;
						contactEmail = contactEmail || user.email;
						contactPhone = contactPhone || user.phone || '';
					} else {
						// Passenger doesn't belong to user or not found, use user info
						contactFullname = contactFullname || user.fullname;
						contactEmail = contactEmail || user.email;
						contactPhone = contactPhone || user.phone || '';
					}
				} else {
					// Multiple passengers or no passengerId, use user info (booking contact person)
					contactFullname = contactFullname || user.fullname;
					contactEmail = contactEmail || user.email;
					contactPhone = contactPhone || user.phone || '';
				}
			}

			const finalDto = {
				...dto,
				userId: userId, // Always use userId from JWT
				contactFullname,
				contactEmail,
				contactPhone,
			};

			return await firstValueFrom(
				this.client.send<CreateBookingResponseDto>(BOOKING_MS.PATTERN.CREATE_BOOKING, finalDto),
			);
		} catch (error: any) {
			console.error('Create booking error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Booking microservice request timeout. Please check if the service is running.');
			}
			throw new Error(`Create booking failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get(':id/fare-details')
	@ApiOperation({
		summary: 'Get fare details for a booking',
		description: 'Get detailed fare information including descriptions and pricing for a specific booking.',
	})
	@ApiParam({
		name: 'id',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Fare details retrieved successfully',
		type: BookingFareDetailsResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking ID or booking has no segments',
	})
	async getBookingFareDetails(@Param('id') bookingId: string): Promise<BookingFareDetailsResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<BookingFareDetailsResponseDto>(BOOKING_MS.PATTERN.GET_FARE_DETAILS, bookingId),
			);
		} catch (error: any) {
			console.error('Get booking fare details error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Booking microservice request timeout. Please check if the service is running.');
			}
			throw new Error(`Get booking fare details failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Patch(':id/passengers')
	@ApiOperation({
		summary: 'Update booking passengers count',
		description: 'Update the number of adult and minor passengers for a booking.',
	})
	@ApiParam({
		name: 'id',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Passengers updated successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Passenger count updated from 1 to 2' },
				totalPassengers: { type: 'number', example: 2 },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking ID or request parameters',
	})
	async updateBookingPassengers(
		@Param('id') bookingId: string,
		@Body() dto: UpdateBookingPassengersDto,
	): Promise<{ success: boolean; message: string; totalPassengers: number }> {
		try {
			return await firstValueFrom(
				this.client.send<{ success: boolean; message: string; totalPassengers: number }>(
					BOOKING_MS.PATTERN.UPDATE_PASSENGERS,
					{ bookingId, dto },
				),
			);
		} catch (error: any) {
			console.error('Update booking passengers error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Booking microservice request timeout. Please check if the service is running.');
			}
			throw new Error(`Update booking passengers failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get(':id/payment-info')
	@ApiOperation({
		summary: 'Get payment information for a booking',
		description: 'Get payment-related information including total amount, currency, and contact details for a booking.',
	})
	@ApiParam({
		name: 'id',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Payment information retrieved successfully',
		type: BookingPaymentInfoResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking ID',
	})
	async getBookingPaymentInfo(@Param('id') bookingId: string): Promise<BookingPaymentInfoResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<BookingPaymentInfoResponseDto>(BOOKING_MS.PATTERN.GET_PAYMENT_INFO, bookingId),
			);
		} catch (error: any) {
			console.error('Get booking payment info error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Booking microservice request timeout. Please check if the service is running.');
			}
			throw new Error(`Get booking payment info failed: ${error?.message || 'Unknown error'}`);
		}
	}
}

