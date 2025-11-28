import { BadRequestException, Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentMethodCode, PaymentStatus } from 'src/shared/constants/enums';
import { PaymentWebhookDto } from './dto/webhook.dto';
import { BOOKING_MS } from '../booking/booking.messages';
import { PaymentValidationService } from './services/payment-validation.service';
import { PaymentNotificationService } from './services/payment-notification.service';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';

@Injectable()
export class PaymentService {
	private readonly logger = new Logger(PaymentService.name);
	private readonly PAYMENT_EXPIRATION_MINUTES = 15; // Payment expires after 15 minutes
	private readonly DB_TIMEOUT_MESSAGE = 'Timeout: Request failed to complete in 15000ms';

	constructor(
		@InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
		@InjectRepository(PaymentMethod) private readonly paymentMethodRepo: Repository<PaymentMethod>,
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
		@InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
		@Inject('BOOKING_CLIENT') private readonly bookingClient: ClientProxy,
		private readonly dataSource: DataSource,
		private readonly validationService: PaymentValidationService,
		private readonly notificationService: PaymentNotificationService,
		private readonly gatewayFactory: PaymentGatewayFactory,
	) {}

	/**
	 * Create a new payment for a booking
	 * Phase 1: Idempotency, Amount Validation, Concurrency Control
	 * Phase 2: Payment Expiration, Payment Method Availability
	 */
	async createPayment(userId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// PHASE 1: Concurrency Control - Lock booking row to prevent concurrent payments
			// DEV/DEMO MODE: không dùng lock + retry để tránh timeout khó chịu cho user
			let booking: Booking | null;
			if (process.env.NODE_ENV !== 'production') {
				booking = await queryRunner.manager
					.createQueryBuilder(Booking, 'booking')
					.where('booking.booking_id = :bookingId', { bookingId: dto.bookingId })
					.leftJoinAndSelect('booking.currency', 'currency')
					.leftJoinAndSelect('booking.user', 'user')
					.getOne();
			} else {
				// PRODUCTION: giữ nguyên cơ chế lock + retry để đảm bảo chống double-payment
				booking = await this.executeWithRetry(
					async () =>
						await queryRunner.manager
							.createQueryBuilder(Booking, 'booking')
							.setLock('pessimistic_write') // SQL Server: WITH (UPDLOCK, ROWLOCK)
							.where('booking.booking_id = :bookingId', { bookingId: dto.bookingId })
							.leftJoinAndSelect('booking.currency', 'currency')
							.leftJoinAndSelect('booking.user', 'user')
							.getOne(),
					{
						operationName: 'lock-booking-for-create-payment',
					},
				);
			}

			if (!booking) {
				throw new NotFoundException(`Booking ${dto.bookingId} not found`);
			}

			// PHASE 1: Check idempotency first (Hybrid: Redis → DB fallback)
			if (dto.idempotencyKey) {
				const existingPayment = await this.validationService.checkIdempotency(
					dto.idempotencyKey,
					dto.bookingId,
					queryRunner.manager,
				);
				if (existingPayment) {
					// Return existing payment (idempotent behavior)
					await queryRunner.commitTransaction();
					this.logger.log(
						`Returning existing payment ${existingPayment.payment_id} for idempotency key ${dto.idempotencyKey}`,
					);
					const response = this.mapToPaymentResponseDto(
						existingPayment,
						booking.pnr_code,
						existingPayment.payment_method.name,
					);
					
					// Cache full response DTO in Redis (if not already cached)
					this.validationService.cachePaymentResponseDto(response, dto.idempotencyKey).catch((err) => {
						this.logger.warn(`Failed to cache payment response: ${err.message}`);
					});

					return response;
				}
			}

			// PHASE 1: Comprehensive validation using validation service
			const validationResult = await this.validationService.validateCreatePayment(
				userId,
				dto,
				queryRunner.manager,
			);

			// Get validated data
			const { booking: validatedBooking, paymentMethod, amount } = validationResult;

			// Validate currency exists
			const currency = await queryRunner.manager.findOne(Currency, {
				where: { currency_code: validatedBooking.currency.currency_code },
			});

			if (!currency) {
				throw new NotFoundException(`Currency ${validatedBooking.currency.currency_code} not found`);
			}

			// PHASE 2: Set payment expiration (15 minutes from now)
			const expiresAt = new Date();
			expiresAt.setMinutes(expiresAt.getMinutes() + this.PAYMENT_EXPIRATION_MINUTES);

			// Create payment record
			const paymentId = uuidv7();
			const payment = queryRunner.manager.create(Payment, {
				payment_id: paymentId,
				booking: validatedBooking,
				amount: amount,
				currency: currency,
				payment_method: paymentMethod,
				status: 'pending',
				transaction_ref: dto.transactionRef || null,
				idempotency_key: dto.idempotencyKey || null,
				expires_at: expiresAt,
				paid_at: null,
			});

			await queryRunner.manager.save(Payment, payment);

			// Commit transaction
			await queryRunner.commitTransaction();

			this.logger.log(
				`Payment ${paymentId} created for booking ${dto.bookingId}, expires at ${expiresAt.toISOString()}`,
			);

			// Map to response DTO
			const paymentResponse = this.mapToPaymentResponseDto(
				payment,
				validatedBooking.pnr_code,
				paymentMethod.name,
			);

			// PHASE 1 (Hybrid): Cache payment response in Redis (non-blocking)
			if (dto.idempotencyKey) {
				this.validationService.cachePaymentResponseDto(paymentResponse, dto.idempotencyKey).catch((err) => {
					this.logger.warn(`Failed to cache idempotency key in Redis: ${err.message}`);
					// Non-blocking: Redis failure should not affect payment creation
				});
			}

			// PHASE 2: Send payment pending notification
			await this.notificationService.sendPaymentPendingNotification(payment, validatedBooking).catch((err) => {
				this.logger.error(`Failed to send payment pending notification: ${err.message}`);
			});

			// Return payment response
			return paymentResponse;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error(`Error creating payment: ${error.message}`, error.stack);
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Process payment (integrate with payment gateway)
	 * Phase 1: Payment Gateway Integration Structure
	 */
	async processPayment(userId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// PHASE 1: Concurrency Control - Lock booking row
			let booking: Booking | null;
			if (process.env.NODE_ENV !== 'production') {
				// DEV/DEMO: không lock để tránh timeout, chấp nhận rủi ro concurrency trong môi trường demo
				booking = await queryRunner.manager
					.createQueryBuilder(Booking, 'booking')
					.where('booking.booking_id = :bookingId', { bookingId: dto.bookingId })
					.leftJoinAndSelect('booking.currency', 'currency')
					.leftJoinAndSelect('booking.user', 'user')
					.getOne();
			} else {
				booking = await this.executeWithRetry(
					async () =>
						await queryRunner.manager
							.createQueryBuilder(Booking, 'booking')
							.setLock('pessimistic_write')
							.where('booking.booking_id = :bookingId', { bookingId: dto.bookingId })
							.leftJoinAndSelect('booking.currency', 'currency')
							.leftJoinAndSelect('booking.user', 'user')
							.getOne(),
					{
						operationName: 'lock-booking-for-process-payment',
					},
				);
			}

			if (!booking) {
				throw new NotFoundException(`Booking ${dto.bookingId} not found`);
			}

			// Check if booking belongs to user (before processing payment)
			// This is a security check to prevent unauthorized payment processing
			if (!booking.user) {
				this.logger.warn(
					`Booking ${dto.bookingId} does not have a user assigned. This should not happen for authenticated users.`,
				);
				throw new BadRequestException(
					'Booking does not belong to any user. Only bookings created by logged-in users can be paid.',
				);
			}

			// Normalize UUIDs for comparison (handle case sensitivity and formatting)
			const bookingUserId = String(booking.user.user_id).toLowerCase().trim();
			const currentUserId = String(userId).toLowerCase().trim();

			if (bookingUserId !== currentUserId) {
				this.logger.warn(
					`Booking ownership mismatch: Booking ${dto.bookingId} belongs to user ${bookingUserId}, but current user is ${currentUserId}`,
				);
				throw new BadRequestException('Booking does not belong to the current user. Please check the booking ID and payment details.');
			}

			// Check if already paid (after lock)
			if (booking.status === 'paid') {
				throw new BadRequestException('Booking is already paid');
			}

			// PHASE 1: Check idempotency first (Hybrid: Redis → DB fallback)
			let payment: Payment | null = null;
			let paymentResponse: PaymentResponseDto;

			if (dto.idempotencyKey) {
				const existingPayment = await this.validationService.checkIdempotency(
					dto.idempotencyKey,
					dto.bookingId,
					queryRunner.manager,
				);
				if (existingPayment) {
					// Return existing payment (idempotent behavior)
					payment = existingPayment;
					paymentResponse = this.mapToPaymentResponseDto(
						existingPayment,
						booking.pnr_code,
						existingPayment.payment_method.name,
					);

					// Cache full response DTO in Redis (if not already cached)
					this.validationService.cachePaymentResponseDto(paymentResponse, dto.idempotencyKey).catch((err) => {
						this.logger.warn(`Failed to cache payment response: ${err.message}`);
					});

					// If payment already processed successfully, return it
					if (payment.status === PaymentStatus.SUCCESS) {
						await queryRunner.commitTransaction();
						this.logger.log(
							`Returning existing successful payment ${payment.payment_id} for idempotency key ${dto.idempotencyKey}`,
						);
						return paymentResponse;
					}
				}
			}

			// If no existing payment, create new one
			if (!payment) {
				// Create payment first (will handle idempotency inside)
				paymentResponse = await this.createPayment(userId, dto);

				// Get the created payment
				payment = await queryRunner.manager.findOne(Payment, {
					where: { payment_id: paymentResponse.paymentId },
					relations: ['payment_method', 'currency', 'booking'],
				});

				if (!payment) {
					throw new NotFoundException(`Payment ${paymentResponse.paymentId} not found`);
				}
			}

			// PHASE 2: Validate payment expiration
			this.validationService.validatePaymentExpiration(payment);

			// PHASE 1: Call payment gateway
			const gateway = this.gatewayFactory.create(dto.paymentMethodCode);
			const gatewayResponse = await gateway.createPayment(payment, booking);

			// Update payment with gateway transaction ID
			payment.transaction_ref = gatewayResponse.transactionId;
			await queryRunner.manager.save(Payment, payment);

			// If gateway returns success immediately (synchronous payment), update status
			if (gatewayResponse.status === 'success') {
				await this.updatePaymentStatus(
					userId,
					{
						paymentId: payment.payment_id,
						status: PaymentStatus.SUCCESS,
						transactionRef: gatewayResponse.transactionId,
					},
					queryRunner,
				);

				// Update booking status
				await queryRunner.manager.update(
					Booking,
					{ booking_id: payment.booking.booking_id },
					{ status: 'paid', updated_at: new Date() },
				);

				// PHASE 2: Send success notification
				await this.notificationService.sendPaymentSuccessNotification(payment, booking).catch((err) => {
					this.logger.error(`Failed to send payment success notification: ${err.message}`);
				});

				// PHASE 3: Create tickets after successful payment
				// This is a critical business step: tickets are only issued after payment confirmation
				// Note: We call this after transaction commit to avoid blocking payment processing
				// If ticket creation fails, payment is still successful and tickets can be created later
				// In production, you might want to use a message queue (RabbitMQ, Kafka, etc.) for this
				const bookingIdForTickets = payment.booking.booking_id;
				
				// Commit transaction first, then create tickets asynchronously
				await queryRunner.commitTransaction();
				
				// Create tickets after commit (non-blocking, fire and forget)
				// Use setTimeout to ensure this runs after the function returns
				setTimeout(async () => {
					try {
						await firstValueFrom(
							this.bookingClient.send(BOOKING_MS.PATTERN.CREATE_TICKETS_FROM_BOOKING, {
								bookingId: bookingIdForTickets,
							}),
						);
						this.logger.log(`Tickets created successfully for booking ${bookingIdForTickets}`);
					} catch (ticketError: any) {
						// Log error but don't fail the payment - tickets can be created later via retry mechanism
						this.logger.error(
							`Failed to create tickets for booking ${bookingIdForTickets}: ${ticketError?.message || ticketError}`,
							ticketError?.stack,
						);
						// In production, you might want to:
						// 1. Queue this for retry
						// 2. Send alert to operations team
						// 3. Mark booking with a flag for manual ticket creation
					}
				}, 0);
			} else if (gatewayResponse.status === 'failed') {
				// PHASE 3: Handle payment failure
				// Booking status remains 'pending' - user can retry payment
				// In production, you might want to:
				// 1. Set booking expiration time (e.g., 24 hours)
				// 2. Send notification to user
				// 3. Release reserved seats after expiration
				await this.updatePaymentStatus(
					userId,
					{
						paymentId: payment.payment_id,
						status: PaymentStatus.FAILED,
						transactionRef: gatewayResponse.transactionId,
					},
					queryRunner,
				);

				// Booking status remains 'pending' - user can retry payment
				this.logger.warn(
					`Payment failed for booking ${payment.booking.booking_id}. Booking status remains 'pending'. User can retry payment.`,
				);
			}

			await queryRunner.commitTransaction();

			this.logger.log(
				`Payment ${payment.payment_id} processed for booking ${dto.bookingId}, gateway status: ${gatewayResponse.status}`,
			);

			// Return updated payment with payment URL
			const updatedPayment = await this.paymentRepo.findOne({
				where: { payment_id: payment.payment_id },
				relations: ['payment_method', 'currency', 'booking'],
			});

			if (!updatedPayment) {
				throw new NotFoundException(`Payment ${payment.payment_id} not found`);
			}

			const response = this.mapToPaymentResponseDto(
				updatedPayment,
				updatedPayment.booking.pnr_code,
				updatedPayment.payment_method.name,
			);

			// Add payment URL if gateway provides it
			if (gatewayResponse.paymentUrl) {
				response.paymentUrl = gatewayResponse.paymentUrl;
			}

			// PHASE 1 (Hybrid): Cache payment response in Redis (non-blocking)
			if (dto.idempotencyKey) {
				this.validationService.cachePaymentResponseDto(response, dto.idempotencyKey).catch((err) => {
					this.logger.warn(`Failed to cache idempotency key in Redis: ${err.message}`);
					// Non-blocking: Redis failure should not affect payment processing
				});
			}

			return response;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error(`Error processing payment: ${error.message}`, error.stack);
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Get payment by ID
	 */
	async getPayment(userId: string, paymentId: string): Promise<PaymentResponseDto> {
		const payment = await this.paymentRepo.findOne({
			where: { payment_id: paymentId },
			relations: ['payment_method', 'currency', 'booking', 'booking.user'],
		});

		if (!payment) {
			throw new NotFoundException(`Payment ${paymentId} not found`);
		}

		// Check if payment belongs to user's booking
		if (payment.booking.user?.user_id !== userId) {
			throw new BadRequestException('Payment does not belong to the current user');
		}

		return this.mapToPaymentResponseDto(payment, payment.booking.pnr_code, payment.payment_method.name);
	}

	/**
	 * Get all payments for a booking
	 */
	async getPaymentsByBooking(userId: string, bookingId: string): Promise<PaymentResponseDto[]> {
		// Validate booking exists and belongs to user
		const booking = await this.bookingRepo.findOne({
			where: { booking_id: bookingId },
			relations: ['user'],
		});

		if (!booking) {
			throw new NotFoundException(`Booking ${bookingId} not found`);
		}

		if (booking.user?.user_id !== userId) {
			throw new BadRequestException('Booking does not belong to the current user');
		}

		const payments = await this.paymentRepo.find({
			where: { booking: { booking_id: bookingId } },
			relations: ['payment_method', 'currency', 'booking'],
			order: { created_at: 'DESC' },
		});

		return payments.map((payment) =>
			this.mapToPaymentResponseDto(payment, booking.pnr_code, payment.payment_method.name),
		);
	}

	/**
	 * Update payment status
	 */
	async updatePaymentStatus(
		userId: string,
		dto: UpdatePaymentStatusDto,
		queryRunner?: any,
	): Promise<PaymentResponseDto> {
		const manager = queryRunner ? queryRunner.manager : this.paymentRepo.manager;

		const payment = await manager.findOne(Payment, {
			where: { payment_id: dto.paymentId },
			relations: ['booking', 'payment_method', 'currency', 'booking.user'],
		});

		if (!payment) {
			throw new NotFoundException(`Payment ${dto.paymentId} not found`);
		}

		// Check if payment belongs to user's booking (skip if called from webhook)
		if (userId !== 'system' && payment.booking.user?.user_id !== userId) {
			throw new BadRequestException('Payment does not belong to the current user');
		}

		const oldStatus = payment.status;

		// Update payment status
		payment.status = dto.status;
		if (dto.transactionRef) {
			payment.transaction_ref = dto.transactionRef;
		}

		// Set paid_at if status is success
		if (dto.status === PaymentStatus.SUCCESS && !payment.paid_at) {
			payment.paid_at = new Date();
		}

		await manager.save(Payment, payment);

		// If payment is successful, update booking status
		if (dto.status === PaymentStatus.SUCCESS && payment.booking.status !== 'paid') {
			await manager.update(
				Booking,
				{ booking_id: payment.booking.booking_id },
				{ status: 'paid', updated_at: new Date() },
			);

			// PHASE 3: Create tickets after successful payment
			// This is a critical business step: tickets are only issued after payment confirmation
			// Note: This is called from updatePaymentStatus which may be called from webhook or direct update
			// We use non-blocking approach - if ticket creation fails, payment is still successful
			// Tickets can be created later via retry mechanism or manual intervention
			// In production, you might want to use a message queue (RabbitMQ, Kafka, etc.) for this
			try {
				// Call after transaction commit to avoid blocking payment processing
				// Note: manager.connection might not have afterTransactionCommit in all contexts
				// For webhook/direct update, we'll call it directly but handle errors gracefully
				await firstValueFrom(
					this.bookingClient.send(BOOKING_MS.PATTERN.CREATE_TICKETS_FROM_BOOKING, {
						bookingId: payment.booking.booking_id,
					}),
				);
				this.logger.log(`Tickets created successfully for booking ${payment.booking.booking_id}`);
			} catch (ticketError: any) {
				// Log error but don't fail the payment - tickets can be created later via retry mechanism
				this.logger.error(
					`Failed to create tickets for booking ${payment.booking.booking_id}: ${ticketError?.message || ticketError}`,
					ticketError?.stack,
				);
				// In production, you might want to:
				// 1. Queue this for retry
				// 2. Send alert to operations team
				// 3. Mark booking with a flag for manual ticket creation
			}

			// PHASE 2: Send success notification
			await this.notificationService.sendPaymentSuccessNotification(payment, payment.booking).catch((err) => {
				this.logger.error(`Failed to send payment success notification: ${err.message}`);
			});
		} else if (dto.status === PaymentStatus.FAILED && oldStatus !== 'failed') {
			// PHASE 3: Handle payment failure
			// Booking status remains 'pending' - user can retry payment
			// In production, you might want to:
			// 1. Set booking expiration time (e.g., 24 hours)
			// 2. Send notification to user
			// 3. Release reserved seats after expiration
			this.logger.warn(
				`Payment failed for booking ${payment.booking.booking_id}. Booking status remains 'pending'. User can retry payment.`,
			);
			// PHASE 2: Send failed notification
			await this.notificationService
				.sendPaymentFailedNotification(payment, payment.booking, dto.transactionRef || 'Payment failed')
				.catch((err) => {
					this.logger.error(`Failed to send payment failed notification: ${err.message}`);
				});
		}

		this.logger.log(`Payment ${dto.paymentId} status updated from ${oldStatus} to ${dto.status}`);

		return this.mapToPaymentResponseDto(payment, payment.booking.pnr_code, payment.payment_method.name);
	}

	/**
	 * Handle webhook from payment gateway
	 * Phase 2: Webhook Handling
	 */
	async handleWebhook(gatewayName: string, signature: string, payload: any): Promise<void> {
		this.logger.log(`Received webhook from ${gatewayName}: ${JSON.stringify(payload)}`);

		try {
			// Get payment method code from gateway name
			// In production, you might have a mapping table
			const methodCode = this.getMethodCodeFromGatewayName(gatewayName);

			// Get gateway instance
			const gateway = this.gatewayFactory.create(methodCode);

			// Verify webhook signature
			if (!gateway.verifyWebhook(signature, payload)) {
				this.logger.error(`Invalid webhook signature from ${gatewayName}`);
				throw new BadRequestException('Invalid webhook signature');
			}

			// Process webhook
			const result = await gateway.processWebhook(payload);

			// Find payment by transaction reference
			const payment = await this.paymentRepo.findOne({
				where: { transaction_ref: result.transactionId },
				relations: ['booking', 'payment_method', 'currency', 'booking.user'],
			});

			if (!payment) {
				this.logger.warn(`Payment not found for transaction: ${result.transactionId}`);
				return;
			}

			// Update payment status (use 'system' as userId for webhook updates)
			await this.updatePaymentStatus(
				'system',
				{
					paymentId: payment.payment_id,
					status: result.status === 'success' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
					transactionRef: result.transactionId,
				},
			);

			this.logger.log(
				`Webhook processed successfully for payment ${payment.payment_id}, status: ${result.status}`,
			);
		} catch (error) {
			this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Map Payment entity to PaymentResponseDto
	 */
	private mapToPaymentResponseDto(
		payment: Payment,
		pnrCode: string,
		paymentMethodName: string,
	): PaymentResponseDto {
		return {
			paymentId: payment.payment_id,
			bookingId: payment.booking.booking_id,
			pnrCode,
			amount: Number(payment.amount),
			currencyCode: payment.currency.currency_code,
			paymentMethodCode: payment.payment_method.payment_method_code,
			paymentMethodName,
			status: payment.status as 'pending' | 'success' | 'failed',
			transactionRef: payment.transaction_ref,
			createdAt: payment.created_at,
			paidAt: payment.paid_at,
			expiresAt: payment.expires_at,
		};
	}

	/**
	 * Execute DB operation with retry & backoff for transient SQL timeouts
	 */
	private async executeWithRetry<T>(
		fn: () => Promise<T>,
		options: { operationName: string; maxRetries?: number; baseDelayMs?: number },
	): Promise<T> {
		const { operationName, maxRetries = 3, baseDelayMs = 200 } = options;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await fn();
			} catch (error: any) {
				const isQueryError = error instanceof QueryFailedError;
				const message: string = error?.message || '';
				const driverMessage: string = error?.driverError?.message || '';
				const isTimeout =
					message.includes(this.DB_TIMEOUT_MESSAGE) ||
					driverMessage.includes(this.DB_TIMEOUT_MESSAGE);

				if (!isQueryError || !isTimeout) {
					// Not a transient DB timeout → rethrow immediately
					throw error;
				}

				if (attempt >= maxRetries) {
					this.logger.error(
						`[${operationName}] Database timeout after ${attempt} attempts: ${message || driverMessage}`,
					);
					// Business-friendly error message for callers (Gateway will surface this to FE)
					throw new BadRequestException(
						'Payment system is busy at the moment. Please try again in a few seconds.',
					);
				}

				const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
				this.logger.warn(
					`[${operationName}] Database timeout (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs}ms...`,
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		// Should never reach here
		throw new BadRequestException(
			'Payment system is busy at the moment. Please try again in a few seconds.',
		);
	}

	/**
	 * Get payment method code from gateway name
	 * Helper method for webhook routing
	 */
	private getMethodCodeFromGatewayName(gatewayName: string): string {
		// Always route webhooks to DevPaymentGateway
		// In the future, if other gateways are added, this can be extended
		const mapping: Record<string, string> = {
			dev: 'DEV', // Dev gateway
			mock: 'CREDIT_CARD', // Default for mock gateway
		};

		return mapping[gatewayName.toLowerCase()] || 'DEV';
	}
}
