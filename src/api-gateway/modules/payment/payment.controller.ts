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
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { Request } from 'express';
import { PAYMENT_MS } from 'src/microservices/payment/payment.messages';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PAYMENT_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

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
				throw new BadRequestException(PAYMENT_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
			}
			
			const userId = req.user.userId;

			// BEST PRACTICE: Payment operations can be slow due to database transactions
			// Set timeout to 60 seconds (payment operations are more complex than search)
			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.CREATE_PAYMENT, {
					userId,
					dto: {
						...dto,
						bookingId,
					},
				}).pipe(
					timeout(60000), // 60 seconds timeout for payment operations
					catchError((error) => {
						// Re-throw timeout errors with proper code
						if (error.name === 'TimeoutError') {
							const timeoutError: any = new Error(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
							timeoutError.code = 'ETIMEDOUT';
							return throwError(() => timeoutError);
						}
						return throwError(() => error);
					}),
				),
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
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED);
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('booking') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`${PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND}: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('booking')) {
						throw new NotFoundException(PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND);
					}
				}
				throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException(PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND);
			}
			
			// Try to extract meaningful message from error object
			let extractedMessage: string | null = null;
			
			// Try error.response.message (RpcException format)
			if (error?.response?.message && typeof error.response.message === 'string') {
				extractedMessage = error.response.message;
			}
			// Try error.message (direct)
			else if (error?.message && typeof error.message === 'string' && error.message !== 'Internal server error') {
				extractedMessage = error.message;
			}
			
			// Use extracted message or provide descriptive default
			const finalMessage = extractedMessage || errorMessage || 'Create payment failed: Internal server error';
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${finalMessage}`);
		}
	}

	@Post('bookings/:bookingId/process')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Process payment for a booking',
		description:
			'Create and process a payment for a booking immediately. This will create a payment record and update the booking status to paid if successful. In production, this would integrate with a payment gateway. Supports both authenticated users and guest users.',
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
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Param('bookingId') bookingId: string,
		@Body() dto: CreatePaymentDto,
	): Promise<PaymentResponseDto> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException(PAYMENT_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
			}
			
			// userId can be null for guest users
			const userId = req.user?.userId || null;

			// BEST PRACTICE: Payment processing can be slow due to payment gateway integration and database transactions
			// Set timeout to 60 seconds (payment processing is more complex)
			// userId can be null for guest users
			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.PROCESS_PAYMENT, {
					userId, // null for guest users
					dto: {
						...dto,
						bookingId,
					},
				}).pipe(
					timeout(60000), // 60 seconds timeout for payment processing
					catchError((error) => {
						// Re-throw timeout errors with proper code
						if (error.name === 'TimeoutError') {
							const timeoutError: any = new Error(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
							timeoutError.code = 'ETIMEDOUT';
							return throwError(() => timeoutError);
						}
						return throwError(() => error);
					}),
				),
			);
		} catch (error: any) {
			// Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
			if (error instanceof HttpException) {
				throw error;
			}

			// RpcException from microservice often comes in error.response
			const rpcResponse = error?.response;
			if (rpcResponse?.statusCode && rpcResponse?.message) {
				// Propagate business errors from Payment MS to client (400/404)
				if (rpcResponse.statusCode === 400) {
					throw new BadRequestException(rpcResponse.message);
				}
				if (rpcResponse.statusCode === 404) {
					throw new NotFoundException(rpcResponse.message);
				}
			}
			
			// Also check for statusCode directly for compatibility
			if (error?.statusCode && error?.message) {
				if (error?.statusCode === 404) {
					throw new NotFoundException(error.message);
				}
				if (error?.statusCode === 400) {
					throw new BadRequestException(error.message);
				}
				throw error;
			}
			
			// Handle microservice connection errors - these are infrastructure issues (503)
			const errorMessage = error?.message || error?.toString() || '';
			const errorCode = error?.code || '';
			
			// Connection refused - microservice is not running
			if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED);
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('booking') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`${PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND}: ${error.message}`);
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
					throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_ERROR);
				}
				throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException(PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND);
			}
			
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${errorMessage}`);
		}
	}

	@Get(':id')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Get payment by ID',
		description: 'Get payment details by payment ID. Supports both authenticated users and guest users.',
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
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Param('id') paymentId: string,
	): Promise<PaymentResponseDto> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(paymentId)) {
				throw new BadRequestException(PAYMENT_MESSAGES.VALIDATION.PAYMENT_ID_INVALID_FORMAT);
			}
			
			// userId can be null for guest users
			const userId = req.user?.userId || null;

			// BEST PRACTICE: Get payment can be slow if database is under load
			// Set timeout to 30 seconds (read operations should be faster)
			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.GET_PAYMENT, {
					userId,
					paymentId,
				}).pipe(
					timeout(30000), // 30 seconds timeout for read operations
					catchError((error) => {
						// Re-throw timeout errors with proper code
						if (error.name === 'TimeoutError') {
							const timeoutError: any = new Error(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
							timeoutError.code = 'ETIMEDOUT';
							return throwError(() => timeoutError);
						}
						return throwError(() => error);
					}),
				),
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
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED);
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('payment') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`${PAYMENT_MESSAGES.ERROR.NOT_FOUND}: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('payment')) {
						throw new NotFoundException(PAYMENT_MESSAGES.ERROR.NOT_FOUND);
					}
				}
				throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException(PAYMENT_MESSAGES.ERROR.NOT_FOUND);
			}
			
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${errorMessage}`);
		}
	}

	@Get('bookings/:bookingId')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Get all payments for a booking',
		description: 'Get all payment records for a specific booking. Supports both authenticated users and guest users.',
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
		@Req() req: Request & { user?: { userId: string; email: string } },
		@Param('bookingId') bookingId: string,
	): Promise<PaymentResponseDto[]> {
		try {
			// Validate UUID v7 format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(bookingId)) {
				throw new BadRequestException(PAYMENT_MESSAGES.VALIDATION.BOOKING_ID_INVALID_FORMAT);
			}
			
			// userId can be null for guest users
			const userId = req.user?.userId || null;

			// BEST PRACTICE: Get payments by booking can be slow if database is under load
			// Set timeout to 30 seconds (read operations should be faster)
			return await firstValueFrom(
				this.client.send<PaymentResponseDto[]>(PAYMENT_MS.PATTERN.GET_PAYMENTS_BY_BOOKING, {
					userId,
					bookingId,
				}).pipe(
					timeout(30000), // 30 seconds timeout for read operations
					catchError((error) => {
						// Re-throw timeout errors with proper code
						if (error.name === 'TimeoutError') {
							const timeoutError: any = new Error(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
							timeoutError.code = 'ETIMEDOUT';
							return throwError(() => timeoutError);
						}
						return throwError(() => error);
					}),
				),
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
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED);
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('booking') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`${PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND}: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('booking')) {
						throw new NotFoundException(PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND);
					}
				}
				throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException(PAYMENT_MESSAGES.ERROR.BOOKING_NOT_FOUND);
			}
			
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${errorMessage}`);
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
				throw new BadRequestException(PAYMENT_MESSAGES.VALIDATION.PAYMENT_ID_INVALID_FORMAT);
			}
			
			const userId = req.user.userId;

			// BEST PRACTICE: Update payment status can be slow due to database transactions and notifications
			// Set timeout to 60 seconds (write operations can be slower)
			return await firstValueFrom(
				this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.UPDATE_PAYMENT_STATUS, {
					userId,
					dto: {
						...dto,
						paymentId,
					},
				}).pipe(
					timeout(60000), // 60 seconds timeout for update operations
					catchError((error) => {
						// Re-throw timeout errors with proper code
						if (error.name === 'TimeoutError') {
							const timeoutError: any = new Error(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
							timeoutError.code = 'ETIMEDOUT';
							return throwError(() => timeoutError);
						}
						return throwError(() => error);
					}),
				),
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
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED);
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || 
				    (message.includes('payment') && message.includes('not found')) ||
				    message.includes('does not exist')) {
					throw new NotFoundException(`${PAYMENT_MESSAGES.ERROR.NOT_FOUND}: ${error.message}`);
				}
				// If it's a generic "Internal server error", it might be a not found case
				if (message.includes('internal server error') && error?.details) {
					const details = String(error.details).toLowerCase();
					if (details.includes('not found') || details.includes('payment')) {
						throw new NotFoundException(PAYMENT_MESSAGES.ERROR.NOT_FOUND);
					}
				}
				throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`);
			}

			// Generic error - check if it might be a not found case
			const lowerErrorMessage = errorMessage.toLowerCase();
			if (lowerErrorMessage.includes('not found') || lowerErrorMessage.includes('not exist')) {
				throw new NotFoundException(PAYMENT_MESSAGES.ERROR.NOT_FOUND);
			}
			
			throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${errorMessage}`);
		}
	}

	@Post('webhooks/:gateway')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Handle payment gateway webhook',
		description:
			'Webhook endpoint for payment gateways to notify payment status updates. This endpoint does not require JWT authentication as it is called by payment gateways. Currently only supports "dev" gateway for development/demo purposes.',
	})
	@ApiParam({
		name: 'gateway',
		description: 'Payment gateway name (currently only "dev" is supported)',
		example: 'dev',
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
			const validGateways = ['dev', 'mock'];
			if (!validGateways.includes(gateway.toLowerCase())) {
				throw new BadRequestException(`${PAYMENT_MESSAGES.VALIDATION.GATEWAY_INVALID}. Supported gateways: ${validGateways.join(', ')}`);
			}
			
			// Forward webhook to payment microservice
			// BEST PRACTICE: Webhook processing can be slow due to payment gateway verification and database operations
			// Set timeout to 60 seconds (webhook processing can involve external API calls)
			await firstValueFrom(
				this.client.send(PAYMENT_MS.PATTERN.HANDLE_WEBHOOK, {
					gateway,
					signature: signature || '',
					payload,
				}).pipe(
					timeout(60000), // 60 seconds timeout for webhook processing
					catchError((error) => {
						// Re-throw timeout errors with proper code
						if (error.name === 'TimeoutError') {
							const timeoutError: any = new Error(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
							timeoutError.code = 'ETIMEDOUT';
							return throwError(() => timeoutError);
						}
						return throwError(() => error);
					}),
				),
			);

			return {
				success: true,
				message: PAYMENT_MESSAGES.SUCCESS.WEBHOOK_PROCESSED,
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
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED);
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed') || errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED);
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException(COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT);
			}

			// Handle microservice error format: { status: 'error', message: '...' }
			if (error?.status === 'error' && error?.message) {
				const message = error.message.toLowerCase();
				// Check if message indicates "not found"
				if (message.includes('not found') || message.includes('notfound') || message.includes('does not exist')) {
					throw new NotFoundException(error.message);
				}
				// For other business logic errors, return 400 Bad Request
				throw new BadRequestException(`${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`);
			}

			// For any other unexpected errors, return 500 Internal Server Error
			if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('not exist')) {
				throw new NotFoundException('Resource not found');
			}
			
			throw new InternalServerErrorException(COMMON_MESSAGES.ERROR.INTERNAL_SERVER_ERROR);
		}
	}
}

