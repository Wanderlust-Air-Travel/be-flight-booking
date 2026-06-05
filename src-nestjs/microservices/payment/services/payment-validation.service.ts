import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import type { RedisService } from 'src/shared/modules/redis/redis.service';
import type { DataSource, Repository } from 'typeorm';
import type { CreatePaymentDto } from '../dto/create-payment.dto';
import type { PaymentResponseDto } from '../dto/payment-response.dto';

/**
 * Payment Validation Service
 * Handles all payment-related validations
 * Implements Hybrid Approach: Redis (fast) + DB (guarantee) for idempotency
 */
@Injectable()
export class PaymentValidationService {
    private readonly logger = new Logger(PaymentValidationService.name);
    private readonly idempotencyTtl: number;
    private readonly idempotencyKeyPrefix = 'idempotency:';
    private readonly redisEnabled: boolean;

    constructor(
        @InjectRepository(Booking) private readonly _bookingRepo: Repository<Booking>,
        @InjectRepository(PaymentMethod)
        private readonly _paymentMethodRepo: Repository<PaymentMethod>,
        @InjectRepository(Payment) private readonly _paymentRepo: Repository<Payment>,
        private readonly dataSource: DataSource,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService
    ) {
        const redisConfig = this.configService.get('redis');
        // TTL: 2 hours (7200 seconds) - covers payment expiration (15 min) + retry scenarios
        this.idempotencyTtl = Number.parseInt(
            process.env.REDIS_IDEMPOTENCY_TTL || redisConfig?.ttl?.idempotency || '7200',
            10
        );
        // Feature flag to enable/disable Redis caching
        this.redisEnabled = process.env.REDIS_IDEMPOTENCY_ENABLED !== 'false';
        this.logger.log(
            `Idempotency caching: ${this.redisEnabled ? 'ENABLED' : 'DISABLED'} (TTL: ${this.idempotencyTtl}s)`
        );
    }

    /**
     * Get Redis key for idempotency key
     */
    private getIdempotencyKey(idempotencyKey: string): string {
        return `${this.idempotencyKeyPrefix}${idempotencyKey}`;
    }

    /**
     * Validate booking for payment creation
     */
    async validateBookingForPayment(
        userId: string | null,
        bookingId: string,
        manager?: any
    ): Promise<Booking> {
        const repo = manager || this.bookingRepo.manager;

        const booking = await repo.findOne(Booking, {
            where: { booking_id: bookingId },
            relations: ['currency', 'user'],
        });

        if (!booking) {
            throw new NotFoundException(`Booking ${bookingId} not found`);
        }

        // Check if booking belongs to user
        // Support both authenticated users and guest users
        if (userId) {
            // For authenticated users, booking must have a user and match userId
            if (!booking.user) {
                this.logger.warn(
                    `Booking ${bookingId} does not have a user assigned, but userId was provided. This should not happen.`
                );
                throw new BadRequestException(
                    'Booking does not belong to any user. Please check the booking ID and payment details.'
                );
            }

            // Normalize UUIDs for comparison (handle case sensitivity and formatting)
            const bookingUserId = String(booking.user.user_id).toLowerCase().trim();
            const currentUserId = String(userId).toLowerCase().trim();

            if (bookingUserId !== currentUserId) {
                this.logger.warn(
                    `Booking ownership mismatch: Booking ${bookingId} belongs to user ${bookingUserId}, but current user is ${currentUserId}`
                );
                throw new BadRequestException(
                    'Booking does not belong to the current user. Please check the booking ID and payment details.'
                );
            }
        } else {
            // For guest users, booking should not have a user (user_id should be null)
            if (booking.user) {
                this.logger.warn(
                    `Booking ${bookingId} belongs to user ${booking.user.user_id}, but payment request is from guest user.`
                );
                throw new BadRequestException(
                    'This booking belongs to a registered user. Please log in to process payment.'
                );
            }
        }

        // Check if booking is already paid
        if (booking.status === 'paid') {
            throw new BadRequestException('Booking is already paid');
        }

        // Check if booking is cancelled
        if (booking.status === 'canceled') {
            throw new BadRequestException('Cannot create payment for cancelled booking');
        }

        return booking;
    }

    /**
     * Validate payment method exists and is active
     */
    async validatePaymentMethod(methodCode: string, manager?: any): Promise<PaymentMethod> {
        const repo = manager || this.paymentMethodRepo.manager;

        const paymentMethod = await repo.findOne(PaymentMethod, {
            where: { payment_method_code: methodCode },
        });

        if (!paymentMethod) {
            throw new NotFoundException(`Payment method ${methodCode} not found`);
        }

        // Check if payment method is active
        if (!paymentMethod.is_active) {
            throw new BadRequestException(`Payment method ${methodCode} is not available`);
        }

        return paymentMethod;
    }

    /**
     * Validate payment amount
     * For flight booking, payment amount must equal booking total amount
     */
    validatePaymentAmount(amount: number | undefined, bookingTotalAmount: number): number {
        const paymentAmount = amount || bookingTotalAmount;

        // Strict validation: payment amount must equal booking total amount
        // This is the standard for flight bookings (no partial payments)
        if (Math.abs(paymentAmount - bookingTotalAmount) > 0.01) {
            throw new BadRequestException(
                `Payment amount (${paymentAmount}) must equal booking total amount (${bookingTotalAmount})`
            );
        }

        return paymentAmount;
    }

    /**
     * Check for duplicate payment using idempotency key (Hybrid Approach)
     * Step 1: Check Redis (fast path, ~1ms)
     * Step 2: Check DB (fallback/guarantee, ~20-50ms)
     * Returns existing payment if found, null otherwise
     */
    async checkIdempotency(
        idempotencyKey: string | undefined,
        bookingId: string,
        manager?: any
    ): Promise<Payment | null> {
        if (!idempotencyKey) {
            return null;
        }

        // Step 1: Check Redis first (fast path)
        if (this.redisEnabled) {
            try {
                const redisKey = this.getIdempotencyKey(idempotencyKey);
                const cachedPaymentResponse =
                    await this.redisService.get<PaymentResponseDto>(redisKey);

                if (cachedPaymentResponse) {
                    // Normalize UUIDs for case-insensitive comparison (SQL Server may return uppercase/lowercase)
                    const cachedBookingId = String(cachedPaymentResponse.bookingId || '')
                        .toLowerCase()
                        .trim();
                    const requestBookingId = String(bookingId || '')
                        .toLowerCase()
                        .trim();

                    // Verify booking ID matches (case-insensitive)
                    if (cachedBookingId === requestBookingId) {
                        this.logger.log(
                            `[Redis Hit] Found existing payment with idempotency key: ${idempotencyKey} for booking ${bookingId}`
                        );

                        // Return Payment entity by fetching from DB (for consistency with return type)
                        // This is still faster than full DB query because we know the payment exists
                        const repo = manager || this.paymentRepo.manager;
                        const payment = await repo.findOne(Payment, {
                            where: { payment_id: cachedPaymentResponse.paymentId },
                            relations: ['payment_method', 'currency', 'booking'],
                        });

                        if (payment) {
                            return payment;
                        }
                        // If payment not found in DB (shouldn't happen), fall through to DB check
                        this.logger.warn(
                            `[Redis Hit] Payment ${cachedPaymentResponse.paymentId} not found in DB, falling back to DB check`
                        );
                    } else {
                        this.logger.warn(
                            `[Redis Hit] Idempotency key ${idempotencyKey} found but booking ID mismatch. Redis: ${cachedPaymentResponse.bookingId}, Request: ${bookingId}`
                        );
                        // Booking ID mismatch, invalidate cache and check DB
                        await this.redisService.del(this.getIdempotencyKey(idempotencyKey));
                    }
                }
            } catch (error) {
                // Redis failure should not block payment creation, fall back to DB
                this.logger.warn(
                    `[Redis Error] Failed to check idempotency key in Redis: ${error.message}, falling back to DB`
                );
            }
        }

        // Step 2: Check DB (fallback/guarantee)
        const repo = manager || this.paymentRepo.manager;

        const existingPayment = await repo.findOne(Payment, {
            where: { idempotency_key: idempotencyKey },
            relations: ['payment_method', 'currency', 'booking'],
        });

        if (existingPayment) {
            // Normalize UUIDs for case-insensitive comparison (SQL Server may return uppercase/lowercase)
            const dbBookingId = String(existingPayment.booking.booking_id || '')
                .toLowerCase()
                .trim();
            const requestBookingId = String(bookingId || '')
                .toLowerCase()
                .trim();

            if (dbBookingId === requestBookingId) {
                this.logger.log(
                    `[DB Hit] Found existing payment with idempotency key: ${idempotencyKey} for booking ${bookingId}`
                );

                // Cache in Redis for future requests (non-blocking)
                if (this.redisEnabled) {
                    this.cachePaymentResponse(existingPayment, idempotencyKey).catch((err) => {
                        this.logger.warn(
                            `Failed to cache idempotency key in Redis: ${err.message}`
                        );
                    });
                }

                return existingPayment;
            }
        }

        return null;
    }

    /**
     * Cache payment response in Redis (non-blocking)
     */
    async cachePaymentResponse(payment: Payment, idempotencyKey: string): Promise<void> {
        if (!this.redisEnabled) {
            return;
        }

        try {
            // We need to map Payment to PaymentResponseDto
            // For now, we'll store minimal data and reconstruct in PaymentService
            // Or we can pass the response DTO from PaymentService
            const redisKey = this.getIdempotencyKey(idempotencyKey);
            // Normalize bookingId to lowercase for consistent comparison (SQL Server may return uppercase/lowercase)
            const normalizedBookingId = String(payment.booking.booking_id || '')
                .toLowerCase()
                .trim();
            const cacheData = {
                paymentId: payment.payment_id,
                bookingId: normalizedBookingId,
                status: payment.status,
                createdAt: payment.created_at,
            };

            await this.redisService.set(redisKey, cacheData, this.idempotencyTtl);
            this.logger.debug(
                `Cached idempotency key: ${idempotencyKey} in Redis (TTL: ${this.idempotencyTtl}s)`
            );
        } catch (error) {
            this.logger.warn(`Failed to cache idempotency key in Redis: ${error.message}`);
            // Non-blocking: Redis failures should not affect payment creation
        }
    }

    /**
     * Cache full payment response DTO in Redis (called from PaymentService after mapping)
     */
    async cachePaymentResponseDto(
        paymentResponse: PaymentResponseDto,
        idempotencyKey: string
    ): Promise<void> {
        if (!this.redisEnabled || !idempotencyKey) {
            return;
        }

        try {
            const redisKey = this.getIdempotencyKey(idempotencyKey);
            // Normalize bookingId to lowercase for consistent comparison (SQL Server may return uppercase/lowercase)
            const normalizedResponse = {
                ...paymentResponse,
                bookingId: String(paymentResponse.bookingId || '')
                    .toLowerCase()
                    .trim(),
            };
            await this.redisService.set(redisKey, normalizedResponse, this.idempotencyTtl);
            this.logger.debug(
                `Cached full payment response for idempotency key: ${idempotencyKey} (TTL: ${this.idempotencyTtl}s)`
            );
        } catch (error) {
            this.logger.warn(`Failed to cache payment response in Redis: ${error.message}`);
            // Non-blocking: Redis failures should not affect payment creation
        }
    }

    /**
     * Check if booking already has a successful payment
     */
    async checkExistingSuccessfulPayment(
        bookingId: string,
        manager?: any
    ): Promise<Payment | null> {
        const repo = manager || this.paymentRepo.manager;

        const existingPayment = await repo.findOne(Payment, {
            where: {
                booking: { booking_id: bookingId },
                status: 'success',
            },
            relations: ['payment_method', 'currency', 'booking'],
        });

        if (existingPayment) {
            this.logger.warn(
                `Booking ${bookingId} already has a successful payment: ${existingPayment.payment_id}`
            );
        }

        return existingPayment;
    }

    /**
     * Validate payment expiration
     */
    validatePaymentExpiration(payment: Payment): void {
        if (payment.expires_at && payment.expires_at < new Date()) {
            throw new BadRequestException('Payment has expired');
        }
    }

    /**
     * Comprehensive validation for payment creation
     */
    async validateCreatePayment(
        userId: string | null,
        dto: CreatePaymentDto,
        manager?: any
    ): Promise<{ booking: Booking; paymentMethod: PaymentMethod; amount: number }> {
        // Validate booking
        const booking = await this.validateBookingForPayment(userId, dto.bookingId, manager);

        // Validate payment method
        const paymentMethod = await this.validatePaymentMethod(dto.paymentMethodCode, manager);

        // Validate amount
        const amount = this.validatePaymentAmount(dto.amount, Number(booking.total_amount));

        // Check idempotency - if found, return early (caller should handle returning existing payment)
        // Note: This is checked in PaymentService.createPayment before calling validateCreatePayment

        // Check existing successful payment
        const successfulPayment = await this.checkExistingSuccessfulPayment(dto.bookingId, manager);
        if (successfulPayment) {
            throw new BadRequestException('Booking already has a successful payment');
        }

        return { booking, paymentMethod, amount };
    }
}
