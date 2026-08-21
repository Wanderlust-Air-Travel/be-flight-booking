export const RESERVATION_MS = {
    TCP_PORT: Number(process.env.RESERVATION_MS_PORT) || 4005,
    TCP_HOST: process.env.RESERVATION_MS_HOST,
    TCP_PEER_HOST: process.env.RESERVATION_MS_PEER_HOST,
    PATTERN: {
        CREATE_RESERVATION: 'reservation.create',
        GET_RESERVATION: 'reservation.get',
        CANCEL_RESERVATION: 'reservation.cancel',
        LIST_RESERVATIONS: 'reservation.list',
        EXTEND_RESERVATION: 'reservation.extend',
        MARK_RESERVATION_AS_CONVERTED: 'reservation.mark-as-converted',
    },
} as const;
