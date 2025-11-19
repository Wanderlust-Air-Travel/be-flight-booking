import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { Request } from 'express';
import { PAYMENT_MS } from 'src/microservices/payment/payment.messages';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PaymentController {
	constructor(@Inject('PAYMENT_CLIENT') private readonly client: ClientProxy) {}

	@Post('bookings/:bookingId')
	@ApiOperation({
		summary: 'Create a new payment for a booking',
		description:
			'Create a new payment record for a booking. This creates a pending payment. To process the payment immediately, use the process endpoint. Requires JWT authentication. User ID is extracted from JWT token.',
	})
	@ApiParam({
		name: 'bookingId',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Payment created successfully',
		type: PaymentResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters, booking not found, or validation failed',
	})
	async createPayment(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('bookingId') bookingId: string,
		@Body() dto: CreatePaymentDto,
	): Promise<PaymentResponseDto> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.CREATE_PAYMENT, {
					userId,
					dto: {
						...dto,
						bookingId,
					},
				}),
			);
		} catch (error: any) {
			console.error('Create payment error:', error);

			if (error?.statusCode && error?.message) {
				throw error;
			}

			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Payment microservice is not running. Please start it with: npm run start:payment:dev');
			}

			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Payment microservice request timeout. Please check if the service is running.');
			}

			const errorMessage = error?.message || error?.toString() || 'Unknown error';
			throw new Error(`Create payment failed: ${errorMessage}`);
		}
	}

	@Post('bookings/:bookingId/process')
	@ApiOperation({
		summary: 'Process payment for a booking',
		description:
			'Create and process a payment for a booking immediately. This will create a payment record and update the booking status to paid if successful. In production, this would integrate with a payment gateway. Requires JWT authentication.',
	})
	@ApiParam({
		name: 'bookingId',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Payment processed successfully',
		type: PaymentResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters, booking not found, or validation failed',
	})
	async processPayment(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('bookingId') bookingId: string,
		@Body() dto: CreatePaymentDto,
	): Promise<PaymentResponseDto> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.PROCESS_PAYMENT, {
					userId,
					dto: {
						...dto,
						bookingId,
					},
				}),
			);
		} catch (error: any) {
			console.error('Process payment error:', error);

			if (error?.statusCode && error?.message) {
				throw error;
			}

			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Payment microservice is not running. Please start it with: npm run start:payment:dev');
			}

			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Payment microservice request timeout. Please check if the service is running.');
			}

			const errorMessage = error?.message || error?.toString() || 'Unknown error';
			throw new Error(`Process payment failed: ${errorMessage}`);
		}
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Get payment by ID',
		description: 'Get payment details by payment ID. Requires JWT authentication.',
	})
	@ApiParam({
		name: 'id',
		description: 'Payment ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Payment retrieved successfully',
		type: PaymentResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid payment ID or payment not found',
	})
	async getPayment(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('id') paymentId: string,
	): Promise<PaymentResponseDto> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.GET_PAYMENT, {
					userId,
					paymentId,
				}),
			);
		} catch (error: any) {
			console.error('Get payment error:', error);

			if (error?.statusCode && error?.message) {
				throw error;
			}

			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Payment microservice is not running. Please start it with: npm run start:payment:dev');
			}

			throw new Error(`Get payment failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Get('bookings/:bookingId')
	@ApiOperation({
		summary: 'Get all payments for a booking',
		description: 'Get all payment records for a specific booking. Requires JWT authentication.',
	})
	@ApiParam({
		name: 'bookingId',
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'List of payments retrieved successfully',
		type: [PaymentResponseDto],
	})
	@ApiBadRequestResponse({
		description: 'Invalid booking ID or booking not found',
	})
	async getPaymentsByBooking(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('bookingId') bookingId: string,
	): Promise<PaymentResponseDto[]> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto[]>(PAYMENT_MS.PATTERN.GET_PAYMENTS_BY_BOOKING, {
					userId,
					bookingId,
				}),
			);
		} catch (error: any) {
			console.error('Get payments by booking error:', error);

			if (error?.statusCode && error?.message) {
				throw error;
			}

			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Payment microservice is not running. Please start it with: npm run start:payment:dev');
			}

			throw new Error(`Get payments by booking failed: ${error?.message || 'Unknown error'}`);
		}
	}

	@Patch(':id/status')
	@ApiOperation({
		summary: 'Update payment status',
		description:
			'Update the status of a payment. Typically used by payment gateway webhooks or admin operations. Requires JWT authentication.',
	})
	@ApiParam({
		name: 'id',
		description: 'Payment ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Payment status updated successfully',
		type: PaymentResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid payment ID or request parameters',
	})
	async updatePaymentStatus(
		@Req() req: Request & { user: { userId: string; email: string } },
		@Param('id') paymentId: string,
		@Body() dto: UpdatePaymentStatusDto,
	): Promise<PaymentResponseDto> {
		try {
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.UPDATE_PAYMENT_STATUS, {
					userId,
					dto: {
						...dto,
						paymentId,
					},
				}),
			);
		} catch (error: any) {
			console.error('Update payment status error:', error);

			if (error?.statusCode && error?.message) {
				throw error;
			}

			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Payment microservice is not running. Please start it with: npm run start:payment:dev');
			}

			throw new Error(`Update payment status failed: ${error?.message || 'Unknown error'}`);
		}
	}
}

