export default () => ({
	app: {
		port: parseInt(process.env.PORT || '3000', 10),
		environment: process.env.NODE_ENV || 'development',
		name: 'flight-booking-api',
		version: '1.0.0',
	},
	database: {
		host: process.env.DB_HOST || 'localhost',
		port: parseInt(process.env.DB_PORT || '1434', 10), 
		username: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: process.env.DB_NAME,
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
	},
	redis: {
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		ttl: {
			reservation: parseInt(process.env.RESERVATION_TTL || '900', 10), // 15 minutes
			payment: parseInt(process.env.PAYMENT_TTL || '900', 10), // 15 minutes
		},
	},
	jwt: {
		accessSecret: process.env.JWT_ACCESS_SECRET,
		accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
		refreshSecret: process.env.JWT_REFRESH_SECRET,
		refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
	},
	payment: {
		expirationMinutes: parseInt(process.env.PAYMENT_EXPIRATION_MINUTES || '15', 10),
	},
	microservices: {
		timeout: parseInt(process.env.MS_TIMEOUT || '5000', 10), // 5 seconds
		retries: parseInt(process.env.MS_RETRIES || '3', 10),
		search: {
			host: process.env.SEARCH_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.SEARCH_MS_PORT || '4001', 10),
		},
		services: {
			host: process.env.SERVICES_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.SERVICES_MS_PORT || '4002', 10),
		},
		routes: {
			host: process.env.ROUTES_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.ROUTES_MS_PORT || '4003', 10),
		},
		booking: {
			host: process.env.BOOKING_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.BOOKING_MS_PORT || '4004', 10),
		},
		reservation: {
			host: process.env.RESERVATION_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.RESERVATION_MS_PORT || '4005', 10),
		},
		payment: {
			host: process.env.PAYMENT_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.PAYMENT_MS_PORT || '4006', 10),
		},
		email: {
			host: process.env.EMAIL_MS_HOST || '127.0.0.1',
			port: parseInt(process.env.EMAIL_MS_PORT || '4007', 10),
		},
	},
	rateLimit: {
		ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10), // 60 seconds
		limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per TTL
	},
	circuitBreaker: {
		timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '3000', 10), // 3 seconds
		errorThresholdPercentage: parseInt(
			process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50',
			10,
		),
		resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10), // 30 seconds
	},
});

