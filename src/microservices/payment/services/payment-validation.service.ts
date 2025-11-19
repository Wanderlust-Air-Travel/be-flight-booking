import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';

/**
 * Payment Validation Service
 * Handles all payment-related validations
 */
@Injectable()
export class PaymentValidationService {
	private readonly logger = new Logger(PaymentValidationService.name);

	constructor(
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
		@InjectRepository(PaymentMethod) private readonly paymentMethodRepo: Repository<PaymentMethod>,
		@InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
		private readonly dataSource: DataSource,
	) {}

	/**
	 * Validate booking for payment creation
	 */
	async validateBookingForPayment(
		userId: string,
		bookingId: string,
		manager?: any,
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
		if (booking.user?.user_id !== userId) {
			throw new BadRequestException('Booking does not belong to the current user');
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
				`Payment amount (${paymentAmount}) must equal booking total amount (${bookingTotalAmount})`,
			);
		}

		return paymentAmount;
	}

	/**
	 * Check for duplicate payment using idempotency key
	 * Returns existing payment if found, null otherwise
	 */
	async checkIdempotency(
		idempotencyKey: string | undefined,
		bookingId: string,
		manager?: any,
	): Promise<Payment | null> {
		if (!idempotencyKey) {
			return null;
		}

		const repo = manager || this.paymentRepo.manager;

		const existingPayment = await repo.findOne(Payment, {
			where: { idempotency_key: idempotencyKey },
			relations: ['payment_method', 'currency', 'booking'],
		});

		if (existingPayment && existingPayment.booking.booking_id === bookingId) {
			this.logger.log(
				`Found existing payment with idempotency key: ${idempotencyKey} for booking ${bookingId}`,
			);
			return existingPayment;
		}

		return null;
	}

	/**
	 * Check if booking already has a successful payment
	 */
	async checkExistingSuccessfulPayment(bookingId: string, manager?: any): Promise<Payment | null> {
		const repo = manager || this.paymentRepo.manager;

		const existingPayment = await repo.findOne(Payment, {
			where: {
				booking: { booking_id: bookingId },
				status: 'success',
			},
			relations: ['payment_method', 'currency', 'booking'],
		});

		if (existingPayment) {
			this.logger.warn(`Booking ${bookingId} already has a successful payment: ${existingPayment.payment_id}`);
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
		userId: string,
		dto: CreatePaymentDto,
		manager?: any,
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

