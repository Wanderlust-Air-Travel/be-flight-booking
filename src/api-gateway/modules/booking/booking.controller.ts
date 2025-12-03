import { Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
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
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { User } from 'src/shared/entities/user/user.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { Request } from 'express';
import { BOOKING_MS } from 'src/microservices/booking/booking.messages';
import { MyTicketsResponseDto } from 'src/microservices/booking/dto/my-tickets-response.dto';
import { MyJourneyResponseDto } from 'src/microservices/booking/dto/my-journey-response.dto';
import { GetMyTicketsDto } from 'src/microservices/booking/dto/get-my-tickets.dto';
import { GetBookingResponseDto } from 'src/microservices/booking/dto/get-booking-response.dto';
import { CheckInBookingDto } from 'src/microservices/booking/dto/check-in-booking.dto';
import { CheckInBookingResponseDto } from 'src/microservices/booking/dto/check-in-booking-response.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CancelTicketDto } from './dto/cancel-ticket.dto';
import { AuthService } from '../auth/auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { BOOKING_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
	private readonly logger = new Logger(BookingController.name);

	constructor(
		@Inject('BOOKING_CLIENT') private readonly client: ClientProxy,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(Passenger) private readonly passengerRepo: Repository<Passenger>,
		private readonly authService: AuthService,
	) {}

	@Post()
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Create a new booking from reservation (Guest or Authenticated)',
		description:
			'Create a new flight booking from an existing reservation. Supports both guest bookings (no authentication required) and authenticated bookings. Reservation ID is REQUIRED. Returns booking ID and PNR code. If JWT token is provided, user ID is extracted from token. If no token, booking is created as guest (user_id = null). Contact info is required for guest bookings, optional for authenticated users (will use user info from database if not provided).',
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
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Query('reservationId') reservationId: string,
		@Body() dto: CreateBookingFromReservationDto,
	): Promise<CreateBookingResponseDto> {
		try {
			// Extract userId from JWT token if available (OptionalJwtAuthGuard allows requests without token)
			// For guest bookings, userId will be undefined/null
			const userId = req.user?.userId || null;

			// Validate reservationId is provided
			if (!reservationId) {
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.RESERVATION_ID_REQUIRED);
			}

			// Validate request body
			if (!dto) {
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.REQUEST_BODY_REQUIRED);
			}

			// For guest bookings, ensure contact info is provided
			if (!userId && (!dto.contactFullname || !dto.contactEmail || !dto.contactPhone)) {
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.CONTACT_INFO_REQUIRED_FOR_GUEST);
			}

			// Send userId to microservice (null for guest bookings)
			// Gateway validates JWT if present, extracts userId, microservice trusts Gateway
			return await firstValueFrom(
				this.client.send<CreateBookingResponseDto>(BOOKING_MS.PATTERN.CREATE_BOOKING_FROM_RESERVATION, {
					reservationId,
					userId, // Send userId (extracted from JWT if available), or null for guest bookings
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
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Handle timeout errors
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			
			// Handle other errors
			const errorMessage = error?.message || error?.toString() || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR;
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${errorMessage}`);
		}
	}

	@Get(':id/fare-details')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get fare details for a booking',
		description: 'Get detailed fare information including descriptions and pricing for a specific booking. Public endpoint - no authentication required.',
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
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
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
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get booking fare details failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
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
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
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
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Update booking passengers failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}

	@Get(':id/payment-info')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get payment information for a booking',
		description: 'Get payment-related information including total amount, currency, and contact details for a booking. Public endpoint - no authentication required.',
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
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
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
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get booking payment info failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}

	// IMPORTANT: Specific routes (my-tickets, my-journey) must be placed BEFORE the generic :id route
	// to prevent routing conflicts. NestJS matches routes in order, so :id would catch "my-tickets" and "my-journey"
	@Get('my-tickets')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Get my tickets',
		description: 'Get all tickets booked by the authenticated user with pagination. Returns ticket details including flight information, cancellation eligibility, and booking status. Requires authentication.',
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
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get my tickets failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}

	// IMPORTANT: Specific routes (my-tickets, my-journey) must be placed BEFORE the generic :id route
	// to prevent routing conflicts. NestJS matches routes in order, so :id would catch "my-tickets" and "my-journey"
	@Get('my-journey')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Get my journey history',
		description: 'Get all flight journeys (bookings) made by the authenticated user. Returns journey details including origin, destination, flight information, and booking status. Requires authentication.',
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
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get my journey failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}

	// IMPORTANT: Generic :id route must be placed AFTER all specific routes (my-tickets, my-journey)
	// to prevent routing conflicts. NestJS matches routes in order.
	@Get(':id')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get booking details by ID',
		description: 'Get full booking details including segments, passengers, and flight information. Supports both guest and authenticated bookings. Optional authentication - guest bookings can access their bookings without login.',
	})
	@ApiParam({
		name: 'id',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Booking details retrieved successfully',
		type: GetBookingResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking ID or booking not found',
	})
	async getBooking(
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Param('id') bookingId: string,
	): Promise<GetBookingResponseDto> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
			}

			// Extract userId from JWT token if available (OptionalJwtAuthGuard allows requests without token)
			const userId = req.user?.userId || null;

			return await firstValueFrom(
				this.client.send<GetBookingResponseDto>(BOOKING_MS.PATTERN.GET_BOOKING, {
					bookingId,
					userId,
				}),
			);
		} catch (error: any) {
			console.error('Get booking error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get booking failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}

	@Patch(':id/cancel')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Cancel a booking',
		description: 'Cancel a booking (pending, confirmed, or paid). For paid bookings, OTP verification is required. Only authenticated users can cancel their own bookings. Checks cancellation eligibility based on fare class and time limits. Returns refund amount for paid bookings.',
	})
	@ApiParam({
		name: 'id',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Booking cancelled successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Booking cancelled successfully. Refund amount: 1,200,000 VND' },
				refundAmount: { type: 'number', example: 1200000, description: 'Refund amount (only for paid bookings)' },
				cancellationFee: { type: 'number', example: 300000, description: 'Cancellation fee (only for paid bookings)' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking ID, booking cannot be cancelled, cancellation deadline passed, or OTP required but not provided/invalid',
	})
	async cancelBooking(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('id') bookingId: string,
		@Body() dto: CancelBookingDto,
	): Promise<{ success: boolean; message: string; refundAmount?: number; cancellationFee?: number }> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
			}

			const userId = req.user.userId;

			// Check booking status first to determine if OTP is required
			const booking = await firstValueFrom(
				this.client.send<GetBookingResponseDto>(BOOKING_MS.PATTERN.GET_BOOKING, {
					bookingId,
					userId,
				}),
			);

			// If booking is paid, OTP verification is required
			if (booking.status === 'paid') {
				// Check if OTP has been verified (via verify endpoint)
				const isOtpVerified = await this.authService.isCancellationOtpVerified(userId, bookingId);
				if (!isOtpVerified) {
					throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.OTP_VERIFICATION_REQUIRED_PAID_BOOKING);
				}
			}

			// Proceed with cancellation
			const result = await firstValueFrom(
				this.client.send<{ success: boolean; message: string; refundAmount?: number; cancellationFee?: number }>(BOOKING_MS.PATTERN.CANCEL_BOOKING, {
					bookingId,
					userId,
				}),
			);

			// Delete verification token after successful cancellation
			if (booking.status === 'paid') {
				await this.authService.deleteCancellationVerificationToken(userId, bookingId);
			}

			return result;
		} catch (error: any) {
			console.error('Cancel booking error:', error);
			
			// Handle NestJS exceptions (they have statusCode and message)
			if (error?.statusCode && error?.message) {
				// Re-throw the original exception to preserve status code and message
				throw error;
			}
			
			// Handle connection errors
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			
			// Handle microservice error format (status: 'error')
			if (error?.status === 'error' && error?.message) {
				// Extract the actual error message from microservice response
				const errorMessage = error.message;
				// If it's a BadRequestException from microservice, preserve the message
				if (errorMessage.includes('Cannot cancel') || errorMessage.includes('already cancelled') || errorMessage.includes('does not belong')) {
					throw new BadRequestException(errorMessage);
				}
				throw new BadRequestException(`Cancel booking failed: ${errorMessage}`);
			}
			
			// Fallback: try to extract message from error object
			const errorMessage = error?.message || error?.error?.message || 'Unknown error';
			throw new BadRequestException(`Cancel booking failed: ${errorMessage}`);
		}
	}

	@Get('tickets/:ticketId/info')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Get ticket information',
		description: 'Get ticket information including bookingId and bookingStatus. Used for OTP verification flow.',
	})
	@ApiParam({
		name: 'ticketId',
		description: 'Ticket ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Ticket information retrieved successfully',
		schema: {
			type: 'object',
			properties: {
				ticketId: { type: 'string', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' },
				bookingId: { type: 'string', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' },
				bookingStatus: { type: 'string', example: 'paid', enum: ['pending', 'confirmed', 'paid', 'cancelled', 'completed'] },
			},
		},
	})
	async getTicketInfo(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('ticketId') ticketId: string,
	): Promise<{ ticketId: string; bookingId: string; bookingStatus: string }> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(ticketId)) {
				throw new BadRequestException('Invalid ticket ID format. Expected UUID v7.');
			}

			const userId = req.user.userId;

			// Get ticket info from microservice
			const result = await firstValueFrom(
				this.client.send<{ ticketId: string; bookingId: string; bookingStatus: string }>(BOOKING_MS.PATTERN.GET_TICKET_INFO, {
					ticketId,
					userId,
				}),
			);

			return result;
		} catch (error: any) {
			this.logger.error('Get ticket info error:', error);

			// Handle NestJS exceptions
			if (error?.statusCode && error?.message) {
				throw error;
			}

			// Handle connection errors
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Fallback
			const errorMessage = error?.message || error?.error?.message || 'Unknown error';
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${errorMessage}`);
		}
	}

	@Patch('tickets/:ticketId/cancel')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Cancel a single ticket (partial cancellation)',
		description: 'Cancel a single ticket from a booking. If all tickets in the booking are cancelled, the booking will be automatically cancelled. For paid bookings, OTP verification is required. Only authenticated users can cancel their own tickets. Returns refund amount for paid bookings.',
	})
	@ApiParam({
		name: 'ticketId',
		description: 'Ticket ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Ticket cancelled successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Ticket cancelled successfully.' },
				refundAmount: { type: 'number', example: 600000, description: 'Refund amount (only for paid bookings)' },
				cancellationFee: { type: 'number', example: 300000, description: 'Cancellation fee (only for paid bookings)' },
				bookingCancelled: { type: 'boolean', example: false, description: 'Whether the booking was auto-cancelled (all tickets cancelled)' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid ticket ID, ticket cannot be cancelled, cancellation deadline passed, or OTP required but not provided/invalid',
	})
	async cancelTicket(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('ticketId') ticketId: string,
		@Body() dto: CancelTicketDto,
	): Promise<{ success: boolean; message: string; refundAmount?: number; cancellationFee?: number; bookingCancelled?: boolean }> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(ticketId)) {
				throw new BadRequestException('Invalid ticket ID format. Expected UUID v7.');
			}

			const userId = req.user.userId;

			// Get ticket info to check booking status (for OTP verification)
			const ticketInfo = await firstValueFrom(
				this.client.send<{ ticketId: string; bookingId: string; bookingStatus: string }>(BOOKING_MS.PATTERN.GET_TICKET_INFO, {
					ticketId,
					userId,
				}),
			);

			// If booking is paid, OTP verification is required
			if (ticketInfo.bookingStatus === 'paid') {
				// Check if OTP has been verified (via verify endpoint)
				const isOtpVerified = await this.authService.isCancellationOtpVerified(userId, ticketInfo.bookingId);
				if (!isOtpVerified) {
					throw new BadRequestException(BOOKING_MESSAGES.VALIDATION.OTP_VERIFICATION_REQUIRED_PAID_TICKET);
				}
			}

			// Proceed with ticket cancellation
			const result = await firstValueFrom(
				this.client.send<{ success: boolean; message: string; refundAmount?: number; cancellationFee?: number; bookingCancelled?: boolean }>(
					BOOKING_MS.PATTERN.CANCEL_TICKET,
					{
						ticketId,
						userId,
					},
				),
			);

			// Delete verification token after successful cancellation (if booking was paid)
			if (ticketInfo.bookingStatus === 'paid') {
				await this.authService.deleteCancellationVerificationToken(userId, ticketInfo.bookingId);
			}

			return result;
		} catch (error: any) {
			this.logger.error('Cancel ticket error:', error);

			// Handle NestJS exceptions
			if (error?.statusCode && error?.message) {
				throw error;
			}

			// Handle connection errors
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format
			if (error?.status === 'error' && error?.message) {
				const errorMessage = error.message;
				if (errorMessage.includes('Cannot cancel') || errorMessage.includes('already cancelled') || errorMessage.includes('does not belong')) {
					throw new BadRequestException(errorMessage);
				}
				throw new BadRequestException(`Cancel ticket failed: ${errorMessage}`);
			}

			// Fallback
			const errorMessage = error?.message || error?.error?.message || 'Unknown error';
			throw new BadRequestException(`Cancel ticket failed: ${errorMessage}`);
		}
	}

	@Get('code/:code')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get booking by PNR code or booking ID',
		description: 'Get booking details by PNR code (6 alphanumeric) or booking ID (UUID v7). Used for check-in flow. Public endpoint - no authentication required.',
	})
	@ApiParam({
		name: 'code',
		description: 'PNR code (6 alphanumeric) or booking ID (UUID v7)',
		example: 'ABC123',
	})
	@ApiOkResponse({
		description: 'Booking details retrieved successfully',
		type: GetBookingResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking code format or booking not found',
	})
	async getBookingByCode(@Param('code') bookingCode: string): Promise<GetBookingResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<GetBookingResponseDto>(BOOKING_MS.PATTERN.GET_BOOKING_BY_CODE, bookingCode),
			);
		} catch (error: any) {
			this.logger.error('Get booking by code error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Get booking by code failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}

	@Post('check-in')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Check-in booking: Assign seats and create tickets',
		description: 'Check-in a booking by assigning seats and creating tickets. Booking must be paid or confirmed. Seats must match the cabin class selected during booking. Public endpoint - no authentication required.',
	})
	@ApiOkResponse({
		description: 'Check-in completed successfully',
		schema: {
			type: 'object',
			properties: {
				bookingId: { type: 'string', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' },
				pnrCode: { type: 'string', example: 'ABC123' },
				ticketCount: { type: 'number', example: 2 },
				message: { type: 'string', example: 'Check-in completed successfully. Tickets have been issued and sent to your email.' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid request, booking not found, booking already checked in, or seat validation failed',
	})
	async checkInBooking(@Body() dto: CheckInBookingDto): Promise<CheckInBookingResponseDto> {
		try {
			return await firstValueFrom(
				this.client.send<CheckInBookingResponseDto>(BOOKING_MS.PATTERN.CHECK_IN_BOOKING, dto),
			);
		} catch (error: any) {
			this.logger.error('Check-in booking error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}
			if (error?.status === 'error' && error?.message) {
				throw new BadRequestException(`Check-in failed: ${error.message}`);
			}
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`);
		}
	}
}

