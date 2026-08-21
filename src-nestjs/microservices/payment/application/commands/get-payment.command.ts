export interface GetPaymentQuery {
    paymentId: string;
}

export interface GetPaymentResponse {
    paymentId: string;
    bookingId: string;
    status: string;
    amount: number;
    currency: string;
    method: string;
    transactionRef: string | null;
    createdAt: string;
    completedAt: string | null;
}
