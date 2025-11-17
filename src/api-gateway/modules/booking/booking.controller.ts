import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UpdateBookingPassengersDto } from './dto/update-booking-passengers.dto';
import { BookingFareDetailsResponseDto } from './dto/booking-fare-details-response.dto';
import { BookingPaymentInfoResponseDto } from './dto/booking-payment-info-response.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
	constructor(@Inject('BOOKING_CLIENT') private readonly client: ClientProxy) {}

	@Post()
	@ApiOperation({
		summary: 'Create a new booking',
		description: 'Create a new flight booking with passengers and segments. Returns booking ID and PNR code.',
	})
	@ApiOkResponse({
		description: 'Booking created successfully',
		type: CreateBookingResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters or validation failed',
	})
	async createBooking(@Body() dto: CreateBookingDto): Promise<CreateBookingResponseDto> {
		try {
			return await firstValueFrom(this.client.send<CreateBookingResponseDto>('booking.create', dto));
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
				this.client.send<BookingFareDetailsResponseDto>('booking.get-fare-details', bookingId),
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
					'booking.update-passengers',
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
				this.client.send<BookingPaymentInfoResponseDto>('booking.get-payment-info', bookingId),
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

