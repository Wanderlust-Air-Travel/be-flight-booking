import { Injectable, Logger } from '@nestjs/common';
import type { Booking } from 'src/shared/entities/booking/booking.entity';
import type { Payment } from 'src/shared/entities/payment/payment.entity';
import type {
    IPaymentGateway,
    PaymentGatewayResponse,
    PaymentWebhookResult,
} from '../interfaces/payment-gateway.interface';

/**
 * Mock Payment Gateway for development/testing
 * In production, replace with actual payment gateway implementations (VNPay, MoMo, Stripe, etc.)
 */
@Injectable()
export class MockPaymentGateway implements IPaymentGateway {
    private readonly logger = new Logger(MockPaymentGateway.name);

    async createPayment(payment: Payment, booking: Booking): Promise<PaymentGatewayResponse> {
        this.logger.log(
            `[MOCK] Creating payment ${payment.payment_id} for booking ${booking.booking_id}`
        );

        // Simulate payment gateway processing
        // In production, this would make actual API call to payment gateway
        const transactionId = `TXN${Date.now()}-${payment.payment_id.substring(0, 8)}`;
        const paymentUrl = `https://mock-payment-gateway.com/pay/${transactionId}`;

        return {
            transactionId,
            paymentUrl,
            status: 'pending',
            message:
                'Payment created successfully. Redirect user to paymentUrl to complete payment.',
        };
    }

    verifyWebhook(signature: string, _payload: any): boolean {
        this.logger.log(`[MOCK] Verifying webhook signature: ${signature}`);
        // In production, verify signature using gateway's secret key
        // For mock, always return true
        return true;
    }

    async processWebhook(payload: any): Promise<PaymentWebhookResult> {
        this.logger.log(`[MOCK] Processing webhook: ${JSON.stringify(payload)}`);

        // In production, parse actual webhook payload from payment gateway
        // For mock, simulate success response
        return {
            transactionId: payload.transactionId || payload.transaction_id,
            status: payload.status || 'success',
            amount: payload.amount || 0,
            currency: payload.currency || 'VND',
            message: payload.message || 'Payment processed successfully',
            gatewayData: payload,
        };
    }

    async processRefund(transactionId: string, amount: number): Promise<string> {
        this.logger.log(
            `[MOCK] Processing refund for transaction ${transactionId}, amount: ${amount}`
        );
        // In production, call actual refund API
        return `REFUND-${Date.now()}-${transactionId.substring(0, 8)}`;
    }
}
