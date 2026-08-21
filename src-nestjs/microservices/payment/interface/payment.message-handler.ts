import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { CreatePaymentHandler } from '../application/handlers/create-payment.handler';
import type { GetPaymentHandler } from '../application/handlers/get-payment.handler';
import type { GetPaymentsByBookingHandler } from '../application/handlers/get-payments-by-booking.handler';
import type { HandleWebhookHandler } from '../application/handlers/handle-webhook.handler';
import type { ProcessPaymentHandler } from '../application/handlers/process-payment.handler';
import type { RefundPaymentHandler } from '../application/handlers/refund-payment.handler';

/**
 * PaymentMessageHandler — Thin interface layer for the payment context.
 *
 * Each @MessagePattern maps directly to a single use-case handler.
 * Replaces the old 913-line payment.service.ts.
 */
@Controller()
export class PaymentMessageHandler {
    constructor(
        private readonly createPaymentHandler: CreatePaymentHandler,
        private readonly processPaymentHandler: ProcessPaymentHandler,
        private readonly getPaymentHandler: GetPaymentHandler,
        private readonly getPaymentsByBookingHandler: GetPaymentsByBookingHandler,
        private readonly refundPaymentHandler: RefundPaymentHandler,
        private readonly handleWebhookHandler: HandleWebhookHandler
    ) {}

    @MessagePattern('create_payment')
    async createPayment(payload: any): Promise<any> {
        return this.createPaymentHandler.execute(payload);
    }

    @MessagePattern('process_payment')
    async processPayment(payload: any): Promise<any> {
        return this.processPaymentHandler.execute(payload);
    }

    @MessagePattern('get_payment')
    async getPayment(payload: { paymentId: string }): Promise<any> {
        return this.getPaymentHandler.execute(payload);
    }

    @MessagePattern('get_payments_by_booking')
    async getPaymentsByBooking(payload: any): Promise<any> {
        return this.getPaymentsByBookingHandler.execute({
            bookingId: payload.bookingId,
            page: payload.page ?? 1,
            limit: payload.limit ?? 10,
        });
    }

    @MessagePattern('refund_payment')
    async refundPayment(payload: any): Promise<any> {
        return this.refundPaymentHandler.execute({
            paymentId: payload.paymentId,
            refundAmount: payload.refundAmount,
            reason: payload.reason ?? 'unspecified',
        });
    }

    @MessagePattern('payment_webhook')
    async handleWebhook(payload: any): Promise<any> {
        return this.handleWebhookHandler.execute(payload);
    }
}
