import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { CreatePaymentHandler } from '../application/handlers/create-payment.handler';
import { GetPaymentHandler } from '../application/handlers/get-payment.handler';
import { GetPaymentsByBookingHandler } from '../application/handlers/get-payments-by-booking.handler';
import { HandleWebhookHandler } from '../application/handlers/handle-webhook.handler';
import { ProcessPaymentHandler } from '../application/handlers/process-payment.handler';
import { RefundPaymentHandler } from '../application/handlers/refund-payment.handler';

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

    @MessagePattern('payment.create')
    async createPayment(payload: any): Promise<any> {
        return this.createPaymentHandler.execute(payload);
    }

    @MessagePattern('payment.process')
    async processPayment(payload: any): Promise<any> {
        return this.processPaymentHandler.execute(payload);
    }

    @MessagePattern('payment.get')
    async getPayment(payload: { paymentId: string }): Promise<any> {
        return this.getPaymentHandler.execute(payload);
    }

    @MessagePattern('payment.get-by-booking')
    async getPaymentsByBooking(payload: any): Promise<any> {
        return this.getPaymentsByBookingHandler.execute({
            bookingId: payload.bookingId,
            page: payload.page ?? 1,
            limit: payload.limit ?? 10,
        });
    }

    @MessagePattern('payment.refund')
    async refundPayment(payload: any): Promise<any> {
        return this.refundPaymentHandler.execute({
            paymentId: payload.paymentId,
            refundAmount: payload.refundAmount,
            reason: payload.reason ?? 'unspecified',
        });
    }

    @MessagePattern('payment.webhook')
    async handleWebhook(payload: any): Promise<any> {
        return this.handleWebhookHandler.execute(payload);
    }
}
