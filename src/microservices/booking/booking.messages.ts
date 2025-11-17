export const BOOKING_MS = {
	TCP_PORT: Number(process.env.BOOKING_MS_PORT ?? 4004),
	TCP_HOST: process.env.BOOKING_MS_HOST ?? '127.0.0.1',
	PATTERN: {
		CREATE_BOOKING: 'booking.create',
		GET_BOOKING_FARE_DETAILS: 'booking.get-fare-details',
		UPDATE_BOOKING_PASSENGERS: 'booking.update-passengers',
		GET_BOOKING_PAYMENT_INFO: 'booking.get-payment-info',
	},
} as const;

