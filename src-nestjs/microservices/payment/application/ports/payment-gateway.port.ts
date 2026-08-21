/**
 * IPaymentGateway — Port to external payment provider (Stripe, VNPay, etc.)
 */
export interface IPaymentGateway {
    /** Charge the customer. Returns transaction reference on success. */
    charge(input: GatewayChargeInput): Promise<GatewayChargeResult>;
}

export interface GatewayChargeInput {
    amount: number;
    currency: string;
    method: 'credit_card' | 'debit_card' | 'bank_transfer' | 'e_wallet';
    cardToken?: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
}

export interface GatewayChargeResult {
    success: boolean;
    transactionRef: string | null;
    failureReason: string | null;
}

export const PAYMENT_GATEWAY = 'IPaymentGateway';
