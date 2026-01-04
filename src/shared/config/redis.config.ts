import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
	host: process.env.REDIS_HOST!,
	port: parseInt(process.env.REDIS_PORT!, 10),
	password: process.env.REDIS_PASSWORD || undefined,
	db: parseInt(process.env.REDIS_DB!, 10),
	keyPrefix: process.env.REDIS_KEY_PREFIX!,
	ttl: {
		reservation: parseInt(process.env.REDIS_RESERVATION_TTL!, 10),
		idempotency: parseInt(process.env.REDIS_IDEMPOTENCY_TTL!, 10),
		bookingState: parseInt(process.env.REDIS_BOOKING_STATE_TTL!, 10),
	},
}));

