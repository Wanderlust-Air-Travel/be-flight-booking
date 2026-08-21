export const PAYMENT_MS = {
    TCP_PORT: Number(process.env.PAYMENT_MS_PORT) || 4006,
    TCP_HOST: process.env.PAYMENT_MS_HOST,
    TCP_PEER_HOST: process.env.PAYMENT_MS_PEER_HOST,
    PATTERN: {
        CREATE_PAYMENT: 'payment.create',
        GET_PAYMENT: 'payment.get',
        GET_PAYMENTS_BY_BOOKING: 'payment.get-by-booking',
        UPDATE_PAYMENT_STATUS: 'payment.update-status',
        PROCESS_PAYMENT: 'payment.process',
        HANDLE_WEBHOOK: 'payment.webhook',
    },
} as const;
