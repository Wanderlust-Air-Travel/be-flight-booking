import { Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingFromReservationDto } from './dto/create-booking-from-reservation.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UpdateBookingPassengersDto } from './dto/update-booking-passengers.dto';
import { BookingFareDetailsResponseDto } from './dto/booking-fare-details-response.dto';
import { BookingPaymentInfoResponseDto } from './dto/booking-payment-info-response.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { User } from 'src/shared/entities/user/user.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { Request } from 'express';
import { BOOKING_MS } from 'src/microservices/booking/booking.messages';
import { MyTicketsResponseDto } from 'src/microservices/booking/dto/my-tickets-response.dto';
import { MyJourneyResponseDto } from 'src/microservices/booking/dto/my-journey-response.dto';
import { GetMyTicketsDto } from 'src/microservices/booking/dto/get-my-tickets.dto';

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
		summary: 'Create a new booking from reservation',
		description:
			'Create a new flight booking from an existing reservation. This is the recommended and only supported flow. Reservation ID is REQUIRED. Returns booking ID and PNR code. Requires JWT authentication. User ID is extracted from JWT token. Contact info is optional - if not provided, will use user info from database. Direct booking without reservation is deprecated and will be removed in a future version.',
		deprecated: false,
	})
	@ApiQuery({
		name: 'reservationId',
		required: true,
		description: 'Reservation ID (UUID v7) or reservation code (6 alphanumeric). REQUIRED. Booking must be created from a reservation.',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Booking created successfully',
		type: CreateBookingResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters, reservation not found, or validation failed',
	})
	async createBooking(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Query('reservationId') reservationId: string,
		@Body() dto: CreateBookingFromReservationDto,
	): Promise<CreateBookingResponseDto> {
		try {
			// Extract userId from JWT token (validated by JwtAuthGuard)
			// JWT token is validated at Gateway level, userId is extracted and sent to microservice
			// Microservice trusts Gateway - no need to forward JWT token
			const userId = req.user.userId;

			// Validate reservationId is provided
			if (!reservationId) {
				throw new BadRequestException('reservationId query parameter is required. Booking must be created from a reservation.');
			}

			// Validate request body
			if (!dto) {
				throw new BadRequestException('Request body is required when creating booking from reservation');
			}

			// Send userId to microservice (NOT JWT token) - Best Practice: Option 2
			// Gateway validates JWT once, extracts userId, microservice trusts Gateway
			return await firstValueFrom(
				this.client.send<CreateBookingResponseDto>(BOOKING_MS.PATTERN.CREATE_BOOKING_FROM_RESERVATION, {
					reservationId,
					userId, // ✅ Send userId (extracted from JWT), NOT token
					dto,
				}),
			);
		} catch (error: any) {
			console.error('Create booking error:', error);
			
			// Handle NestJS HTTP exceptions
			if (error?.statusCode && error?.message) {
				throw error;
			}
			
			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Create booking failed: ${error.message}`);
			}
			
			// Handle connection errors
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			
			// Handle timeout errors
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException('Booking microservice request timeout. Please check if the service is running.');
			}
			
			// Handle other errors
			const errorMessage = error?.message || error?.toString() || 'Unknown error';
			throw new BadRequestException(`Create booking failed: ${errorMessage}`);
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException('Invalid booking ID format. Expected UUID v7.');
			}
			
			return await firstValueFrom(
				this.client.send<BookingFareDetailsResponseDto>(BOOKING_MS.PATTERN.GET_FARE_DETAILS, bookingId),
			);
		} catch (error: any) {
			console.error('Get booking fare details error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException('Booking microservice request timeout. Please check if the service is running.');
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get booking fare details failed: ${error.message}`);
			}
			throw new BadRequestException(`Get booking fare details failed: ${error?.message || 'Unknown error'}`);
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException('Invalid booking ID format. Expected UUID v7.');
			}
			
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
				throw new InternalServerErrorException('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException('Booking microservice request timeout. Please check if the service is running.');
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Update booking passengers failed: ${error.message}`);
			}
			throw new BadRequestException(`Update booking passengers failed: ${error?.message || 'Unknown error'}`);
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException('Invalid booking ID format. Expected UUID v7.');
			}
			
			return await firstValueFrom(
				this.client.send<BookingPaymentInfoResponseDto>(BOOKING_MS.PATTERN.GET_PAYMENT_INFO, bookingId),
			);
		} catch (error: any) {
			console.error('Get booking payment info error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException('Booking microservice request timeout. Please check if the service is running.');
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get booking payment info failed: ${error.message}`);
			}
			throw new BadRequestException(`Get booking payment info failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get('my-tickets')
	@ApiOperation({
		summary: 'Get my tickets',
		description: 'Get all tickets booked by the authenticated user with pagination. Returns ticket details including flight information, cancellation eligibility, and booking status.',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		description: 'Page number (1-based)',
		example: 1,
		type: Number,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Number of items per page (1-100)',
		example: 10,
		type: Number,
	})
	@ApiOkResponse({
		description: 'Tickets retrieved successfully',
		type: MyTicketsResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid query parameters',
	})
	async getMyTickets(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Query() query: GetMyTicketsDto,
	): Promise<MyTicketsResponseDto> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<MyTicketsResponseDto>(BOOKING_MS.PATTERN.GET_MY_TICKETS, {
					userId,
					dto: query,
				}),
			);
		} catch (error: any) {
			console.error('Get my tickets error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException('Booking microservice request timeout. Please check if the service is running.');
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get my tickets failed: ${error.message}`);
			}
			throw new BadRequestException(`Get my tickets failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get('my-journey')
	@ApiOperation({
		summary: 'Get my journey history',
		description: 'Get all flight journeys (bookings) made by the authenticated user. Returns journey details including origin, destination, flight information, and booking status.',
	})
	@ApiOkResponse({
		description: 'Journey history retrieved successfully',
		type: MyJourneyResponseDto,
	})
	async getMyJourney(@Req() req: Request & { user: { userId: string; email: string } }): Promise<MyJourneyResponseDto> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<MyJourneyResponseDto>(BOOKING_MS.PATTERN.GET_MY_JOURNEY, userId),
			);
		} catch (error: any) {
			console.error('Get my journey error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException('Booking microservice is not running. Please start it with: npm run start:booking:dev');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException('Booking microservice request timeout. Please check if the service is running.');
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get my journey failed: ${error.message}`);
			}
			throw new BadRequestException(`Get my journey failed: ${error?.message || 'Unknown error'}`);
		}
	}
}

