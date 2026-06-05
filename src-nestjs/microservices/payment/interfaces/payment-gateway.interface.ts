import type { Booking } from 'src/shared/entities/booking/booking.entity';
import type { Payment } from 'src/shared/entities/payment/payment.entity';

export interface PaymentGatewayResponse {
    transactionId: string;
    paymentUrl?: string; // URL để redirect user đến payment gateway
    status: 'pending' | 'success' | 'failed';
    message?: string;
}

export interface PaymentWebhookResult {
    transactionId: string;
    status: 'success' | 'failed';
    amount: number;
    currency: string;
    message?: string;
    gatewayData?: any; // Additional data from gateway
}

export interface IPaymentGateway {
    /**
     * Create payment request with payment gateway
     * @param payment Payment entity
     * @param booking Booking entity
     * @returns Payment gateway response with transaction ID and payment URL
     */
    createPayment(payment: Payment, booking: Booking): Promise<PaymentGatewayResponse>;

    /**
     * Verify webhook signature from payment gateway
     * @param signature Webhook signature
     * @param payload Webhook payload
     * @returns true if signature is valid
     */
    verifyWebhook(signature: string, payload: any): boolean;

    /**
     * Process webhook payload from payment gateway
     * @param payload Webhook payload
     * @returns Payment webhook result
     */
    processWebhook(payload: any): Promise<PaymentWebhookResult>;

    /**
     * Process refund request
     * @param transactionId Original transaction ID
     * @param amount Refund amount
     * @returns Refund transaction ID
     */
    processRefund?(transactionId: string, amount: number): Promise<string>;
}
