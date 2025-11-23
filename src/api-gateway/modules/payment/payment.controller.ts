import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards, Headers, HttpCode, HttpStatus, BadRequestException, InternalServerErrorException, NotFoundException, ServiceUnavailableException, HttpException } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiBearerAuth,
	ApiHeader,
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
export class PaymentController {
	constructor(@Inject('PAYMENT_CLIENT') private readonly client: ClientProxy) {}

	@Post('bookings/:bookingId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException('Invalid booking ID format. Expected UUID v7.');
			}
			
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
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}

			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Payment microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Payment microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Payment microservice request timeout. The service may be unavailable or overloaded.');
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('booking') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`Booking not found: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('booking')) {
						throw new NotFoundException('Booking not found');
					}
				}
				throw new BadRequestException(`Create payment failed: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException('Booking not found');
			}
			
			throw new BadRequestException(`Create payment failed: ${errorMessage}. Please check the booking ID and payment details.`);
		}
	}

	@Post('bookings/:bookingId/process')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException('Invalid booking ID format. Expected UUID v7.');
			}
			
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
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}

			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Payment microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Payment microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Payment microservice request timeout. The service may be unavailable or overloaded.');
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('booking') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`Booking not found: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a microservice issue
				if (message.includes('internal server error')) {
					// Check error details if available
					if (error?.details) {
						const details = String(error.details).toLowerCase();
						if (details.includes('not found') || details.includes('booking')) {
							throw new NotFoundException('Booking not found');
						}
					}
					// Generic internal server error - likely microservice issue
					throw new ServiceUnavailableException('Payment microservice error. Please ensure the service is running and try again.');
				}
				throw new BadRequestException(`Process payment failed: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException('Booking not found');
			}
			
			throw new BadRequestException(`Process payment failed: ${errorMessage}. Please check the booking ID and payment details.`);
		}
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(paymentId)) {
				throw new BadRequestException('Invalid payment ID format. Expected UUID v7.');
			}
			
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.GET_PAYMENT, {
					userId,
					paymentId,
				}),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}

			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Payment microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Payment microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Payment microservice request timeout. The service may be unavailable or overloaded.');
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('payment') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`Payment not found: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('payment')) {
						throw new NotFoundException('Payment not found');
					}
				}
				throw new BadRequestException(`Get payment failed: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException('Payment not found');
			}
			
			throw new BadRequestException(`Get payment failed: ${errorMessage}. Please check the payment ID.`);
		}
	}

	@Get('bookings/:bookingId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException('Invalid booking ID format. Expected UUID v7.');
			}
			
			const userId = req.user.userId;

			return await firstValueFrom(
				this.client.send<PaymentResponseDto[]>(PAYMENT_MS.PATTERN.GET_PAYMENTS_BY_BOOKING, {
					userId,
					bookingId,
				}),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}

			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Payment microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Payment microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Payment microservice request timeout. The service may be unavailable or overloaded.');
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('booking') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`Booking not found: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('booking')) {
						throw new NotFoundException('Booking not found');
					}
				}
				throw new BadRequestException(`Get payments by booking failed: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException('Booking not found');
			}
			
			throw new BadRequestException(`Get payments by booking failed: ${errorMessage}. Please check the booking ID.`);
		}
	}

	@Patch(':id/status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
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
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(paymentId)) {
				throw new BadRequestException('Invalid payment ID format. Expected UUID v7.');
			}
			
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
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}
			
			// Also check for statusCode property for compatibility
			if (error?.statusCode && error?.message) {
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				throw error;
			}

			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Payment microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Payment microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Payment microservice request timeout. The service may be unavailable or overloaded.');
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('payment') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`Payment not found: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('payment')) {
						throw new NotFoundException('Payment not found');
					}
				}
				throw new BadRequestException(`Update payment status failed: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException('Payment not found');
			}
			
			throw new BadRequestException(`Update payment status failed: ${errorMessage}. Please check the payment ID and status.`);
		}
	}

	@Post('webhooks/:gateway')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Handle payment gateway webhook',
		description:
			'Webhook endpoint for payment gateways to notify payment status updates. This endpoint does not require JWT authentication as it is called by payment gateways. The gateway name should match the payment gateway (e.g., "vnpay", "momo", "stripe").',
	})
	@ApiParam({
		name: 'gateway',
		description: 'Payment gateway name (e.g., vnpay, momo, stripe, mock)',
		example: 'vnpay',
	})
	@ApiHeader({
		name: 'x-signature',
		description: 'Webhook signature for verification',
		required: false,
	})
	@ApiOkResponse({
		description: 'Webhook processed successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Webhook processed successfully' },
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Invalid webhook signature or payload',
	})
	async handleWebhook(
		@Param('gateway') gateway: string,
		@Headers('x-signature') signature: string,
		@Body() payload: any,
	): Promise<{ success: boolean; message: string }> {
		try {
			// Validate gateway name
			const validGateways = ['vnpay', 'momo', 'stripe', 'mock'];
			if (!validGateways.includes(gateway.toLowerCase())) {
				throw new BadRequestException(`Invalid gateway. Supported gateways: ${validGateways.join(', ')}`);
			}
			
			// Forward webhook to payment microservice
			await firstValueFrom(
				this.client.send(PAYMENT_MS.PATTERN.HANDLE_WEBHOOK, {
					gateway,
					signature: signature || '',
					payload,
				}),
			);

			return {
				success: true,
				message: 'Webhook processed successfully',
			};
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			// Check both statusCode property and instanceof HttpException
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
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException('Payment microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Payment microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Payment microservice request timeout. The service may be unavailable or overloaded.');
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || message.includes('does not exist')) {
					throw new NotFoundException(error.message);
				}
				// For other business logic errors, return 400 Bad Request
				throw new BadRequestException(`Webhook processing failed: ${error.message}`);
			}

			// For any other unexpected errors, return 500 Internal Server Error
			if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('not exist')) {
				throw new NotFoundException('Resource not found');
			}
			
			throw new InternalServerErrorException(`An unexpected error occurred while processing webhook. Please try again later.`);
		}
	}
}

