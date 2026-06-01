import { Controller, Logger, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PAYMENT_MS } from './payment.messages';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentRpcExceptionFilter } from './filters/payment-rpc-exception.filter';

@Controller()
@UseFilters(new PaymentRpcExceptionFilter())
export class PaymentMsController {
	private readonly logger = new Logger(PaymentMsController.name);

	constructor(private readonly paymentService: PaymentService) {}

	@MessagePattern(PAYMENT_MS.PATTERN.CREATE_PAYMENT)
	async handleCreatePayment(@Payload() payload: { userId: string; dto: CreatePaymentDto }) {
		try {
			this.logger.log(`Create payment for booking ${payload.dto.bookingId}`);
			const result = await this.paymentService.createPayment(payload.userId, payload.dto);
			this.logger.log(`Payment ${result.paymentId} created successfully`);
			return result;
		} catch (error: any) {
			this.logger.error('Create payment error:', error);
			throw error;
		}
	}

	@MessagePattern(PAYMENT_MS.PATTERN.PROCESS_PAYMENT)
	async handleProcessPayment(@Payload() payload: { userId: string | null; dto: CreatePaymentDto }) {
		try {
			this.logger.log(`Process payment for booking ${payload.dto.bookingId} (${payload.userId ? 'user' : 'guest'})`);
			const result = await this.paymentService.processPayment(payload.userId, payload.dto);
			this.logger.log(`Payment ${result.paymentId} processed successfully`);
			return result;
		} catch (error: any) {
			this.logger.error('Process payment error:', error);
			throw error;
		}
	}

	@MessagePattern(PAYMENT_MS.PATTERN.GET_PAYMENT)
	async handleGetPayment(@Payload() payload: { userId: string | null; paymentId: string }) {
		try {
			this.logger.log(`Get payment ${payload.paymentId} (${payload.userId ? 'user' : 'guest'})`);
			const result = await this.paymentService.getPayment(payload.userId, payload.paymentId);
			return result;
		} catch (error: any) {
			this.logger.error('Get payment error:', error);
			throw error;
		}
	}

	@MessagePattern(PAYMENT_MS.PATTERN.GET_PAYMENTS_BY_BOOKING)
	async handleGetPaymentsByBooking(@Payload() payload: { userId: string | null; bookingId: string }) {
		try {
			this.logger.log(`Get payments for booking ${payload.bookingId} (${payload.userId ? 'user' : 'guest'})`);
			const result = await this.paymentService.getPaymentsByBooking(payload.userId, payload.bookingId);
			this.logger.log(`Found ${result.length} payments`);
			return result;
		} catch (error: any) {
			this.logger.error('Get payments by booking error:', error);
			throw error;
		}
	}

	@MessagePattern(PAYMENT_MS.PATTERN.UPDATE_PAYMENT_STATUS)
	async handleUpdatePaymentStatus(@Payload() payload: { userId: string; dto: UpdatePaymentStatusDto }) {
		try {
			this.logger.log(`Update payment ${payload.dto.paymentId} status to ${payload.dto.status} (${payload.userId === 'system' ? 'webhook' : 'user'})`);
			const result = await this.paymentService.updatePaymentStatus(payload.userId, payload.dto);
			return result;
		} catch (error: any) {
			this.logger.error('Update payment status error:', error);
			throw error;
		}
	}

	@MessagePattern(PAYMENT_MS.PATTERN.HANDLE_WEBHOOK)
	async handleWebhook(@Payload() payload: { gateway: string; signature: string; payload: any }) {
		try {
			this.logger.log(`Processing webhook from ${payload.gateway}`);
			const payment = await this.paymentService.handleWebhook(payload.gateway, payload.signature, payload.payload);
			return { success: true, payment };
		} catch (error: any) {
			this.logger.error('Webhook processing error:', error);
			throw error;
		}
	}
}

