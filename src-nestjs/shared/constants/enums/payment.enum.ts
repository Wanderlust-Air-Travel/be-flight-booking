/**
 * Payment-related enums
 * Shared across API Gateway and Payment Microservice
 */

export enum PaymentMethodCode {
    CREDIT_CARD = 'CREDIT_CARD',
    DEBIT_CARD = 'DEBIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    EWALLET = 'EWALLET',
    CASH = 'CASH',
}

export enum PaymentStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
}
