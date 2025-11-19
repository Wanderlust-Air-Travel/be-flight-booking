import { BadRequestException, Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { CreatePaymentDto, PaymentMethodCode } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentStatusDto, PaymentStatus } from './dto/update-payment-status.dto';
import { BOOKING_MS } from '../booking/booking.messages';

@Injectable()
export class PaymentService {
	private readonly logger = new Logger(PaymentService.name);

	constructor(
		@InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
		@InjectRepository(PaymentMethod) private readonly paymentMethodRepo: Repository<PaymentMethod>,
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
		@InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
		@Inject('BOOKING_CLIENT') private readonly bookingClient: ClientProxy,
		private readonly dataSource: DataSource,
	) {}

	/**
	 * Create a new payment for a booking
	 */
	async createPayment(userId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Validate booking exists and belongs to user
			const booking = await queryRunner.manager.findOne(Booking, {
				where: { booking_id: dto.bookingId },
				relations: ['currency', 'user'],
			});

			if (!booking) {
				throw new NotFoundException(`Booking ${dto.bookingId} not found`);
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

			// Validate payment method exists
			const paymentMethod = await queryRunner.manager.findOne(PaymentMethod, {
				where: { payment_method_code: dto.paymentMethodCode },
			});

			if (!paymentMethod) {
				throw new NotFoundException(`Payment method ${dto.paymentMethodCode} not found`);
			}

			// Validate currency exists
			const currency = await queryRunner.manager.findOne(Currency, {
				where: { currency_code: booking.currency.currency_code },
			});

			if (!currency) {
				throw new NotFoundException(`Currency ${booking.currency.currency_code} not found`);
			}

			// Create payment record
			const paymentId = uuidv7();
			const payment = queryRunner.manager.create(Payment, {
				payment_id: paymentId,
				booking: booking,
				amount: booking.total_amount,
				currency: currency,
				payment_method: paymentMethod,
				status: 'pending',
				transaction_ref: dto.transactionRef || null,
				paid_at: null,
			});

			await queryRunner.manager.save(Payment, payment);

			// Commit transaction
			await queryRunner.commitTransaction();

			this.logger.log(`Payment ${paymentId} created for booking ${dto.bookingId}`);

			// Return payment response
			return this.mapToPaymentResponseDto(payment, booking.pnr_code, paymentMethod.name);
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error(`Error creating payment: ${error.message}`, error.stack);
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Process payment (simulate payment gateway processing)
	 * In production, this would integrate with actual payment gateway
	 */
	async processPayment(userId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Create payment first
			const payment = await this.createPayment(userId, dto);

			// Simulate payment processing (in production, call payment gateway)
			// For now, we'll auto-approve the payment
			// In real scenario, this would be async and handled via webhook
			const transactionRef = dto.transactionRef || `TXN${Date.now()}`;

			// Update payment status to success
			await this.updatePaymentStatus(
				userId,
				{
					paymentId: payment.paymentId,
					status: PaymentStatus.SUCCESS,
					transactionRef,
				},
				queryRunner,
			);

			// Update booking status to paid
			await queryRunner.manager.update(
				Booking,
				{ booking_id: payment.bookingId },
				{ status: 'paid', updated_at: new Date() },
			);

			await queryRunner.commitTransaction();

			this.logger.log(`Payment ${payment.paymentId} processed successfully for booking ${payment.bookingId}`);

			// Return updated payment
			const updatedPayment = await this.paymentRepo.findOne({
				where: { payment_id: payment.paymentId },
				relations: ['payment_method', 'currency', 'booking'],
			});

			if (!updatedPayment) {
				throw new NotFoundException(`Payment ${payment.paymentId} not found`);
			}

			return this.mapToPaymentResponseDto(
				updatedPayment,
				updatedPayment.booking.pnr_code,
				updatedPayment.payment_method.name,
			);
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
			relations: ['payment_method', 'currency', 'booking'],
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
			relations: ['booking', 'payment_method', 'currency'],
		});

		if (!payment) {
			throw new NotFoundException(`Payment ${dto.paymentId} not found`);
		}

		// Check if payment belongs to user's booking
		if (payment.booking.user?.user_id !== userId) {
			throw new BadRequestException('Payment does not belong to the current user');
		}

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
			await manager.update(Booking, { booking_id: payment.booking.booking_id }, { status: 'paid', updated_at: new Date() });
		}

		this.logger.log(`Payment ${dto.paymentId} status updated to ${dto.status}`);

		return this.mapToPaymentResponseDto(payment, payment.booking.pnr_code, payment.payment_method.name);
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
		};
	}
}

