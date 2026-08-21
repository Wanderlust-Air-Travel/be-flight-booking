export interface GetPaymentsByBookingQuery {
    bookingId: string;
    page: number;
    limit: number;
}

export interface PaymentSummary {
    paymentId: string;
    status: string;
    amount: number;
    currency: string;
    transactionRef: string | null;
    createdAt: string;
}

export interface GetPaymentsByBookingResponse {
    items: PaymentSummary[];
    total: number;
    page: number;
    limit: number;
}
