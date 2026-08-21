export interface CreatePaymentCommand {
    bookingId: string;
    amount: number;
    currency: string;
    method: 'credit_card' | 'debit_card' | 'bank_transfer' | 'e_wallet';
    idempotencyKey: string;
}

export interface CreatePaymentResponse {
    paymentId: string;
    bookingId: string;
    status: string;
    amount: number;
    currency: string;
    method: string;
    createdAt: string;
}
