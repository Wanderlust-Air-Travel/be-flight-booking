import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379', 10),
	password: process.env.REDIS_PASSWORD || undefined,
	db: parseInt(process.env.REDIS_DB || '0', 10),
	keyPrefix: process.env.REDIS_KEY_PREFIX || 'flight-booking:',
	ttl: {
		reservation: parseInt(process.env.REDIS_RESERVATION_TTL || '900', 10), // 15 minutes default
		idempotency: parseInt(process.env.REDIS_IDEMPOTENCY_TTL || '7200', 10), // 2 hours default
		bookingState: parseInt(process.env.REDIS_BOOKING_STATE_TTL || '1800', 10), // 30 minutes default (longer than reservation TTL)
	},
}));

