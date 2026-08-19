export interface RefundPaymentCommand {
    paymentId: string;
    refundAmount: number;
    reason: string;
}

export interface RefundPaymentResponse {
    paymentId: string;
    status: string;
    refundAmount: number;
    currency: string;
}