export const RESERVATION_MS = {
	TCP_PORT: Number(process.env.RESERVATION_MS_PORT ?? 4005),
	TCP_HOST: process.env.RESERVATION_MS_HOST ?? '127.0.0.1',
	PATTERN: {
		CREATE_RESERVATION: 'reservation.create',
		GET_RESERVATION: 'reservation.get',
		CANCEL_RESERVATION: 'reservation.cancel',
	},
} as const;

