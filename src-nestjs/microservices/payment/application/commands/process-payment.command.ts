export interface ProcessPaymentCommand {
    paymentId: string;
    method: 'credit_card' | 'debit_card' | 'bank_transfer' | 'e_wallet';
    cardToken?: string;
}

export interface ProcessPaymentResponse {
    paymentId: string;
    status: string;
    transactionRef: string | null;
    completedAt: string;
}