export default () => ({
	app: {
		port: parseInt(process.env.PORT!, 10),
		environment: process.env.NODE_ENV!,
		name: 'flight-booking-api',
		version: '1.0.0',
		env: process.env.APP_ENV || 'development',
	},
	providers: {
		ourairports: {
			baseUrl: process.env.OURAIRPORTS_BASE_URL || 'https://davidmegginson.github.io/ourairports-data',
		},
	},
	dataBootstrap: {
		enabled: process.env.DATA_BOOTSTRAP_ENABLED !== 'false',
		syncOnStartup: process.env.DATA_BOOTSTRAP_SYNC_ON_STARTUP === 'true',
	},
	database: {
		host: process.env.DB_HOST!,
		port: parseInt(process.env.DB_PORT!, 10), 
		username: process.env.DB_USER!,
		password: process.env.DB_PASS!,
		database: process.env.DB_NAME!,
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
	},
	redis: {
		host: process.env.REDIS_HOST!,
		port: parseInt(process.env.REDIS_PORT!, 10),
		ttl: {
			reservation: parseInt(process.env.RESERVATION_TTL!, 10),
			payment: parseInt(process.env.PAYMENT_TTL!, 10),
		},
	},
	jwt: {
		accessSecret: process.env.JWT_ACCESS_SECRET!,
		accessExpires: process.env.JWT_ACCESS_EXPIRES!,
		refreshSecret: process.env.JWT_REFRESH_SECRET!,
		refreshExpires: process.env.JWT_REFRESH_EXPIRES!,
	},
	payment: {
		expirationMinutes: parseInt(process.env.PAYMENT_EXPIRATION_MINUTES!, 10),
	},
	microservices: {
		timeout: parseInt(process.env.MS_TIMEOUT!, 10),
		retries: parseInt(process.env.MS_RETRIES!, 10),
		search: {
			host: process.env.SEARCH_MS_HOST!,
			port: parseInt(process.env.SEARCH_MS_PORT!, 10),
		},
		services: {
			host: process.env.SERVICES_MS_HOST!,
			port: parseInt(process.env.SERVICES_MS_PORT!, 10),
		},
		routes: {
			host: process.env.ROUTES_MS_HOST!,
			port: parseInt(process.env.ROUTES_MS_PORT!, 10),
		},
		booking: {
			host: process.env.BOOKING_MS_HOST!,
			port: parseInt(process.env.BOOKING_MS_PORT!, 10),
		},
		reservation: {
			host: process.env.RESERVATION_MS_HOST!,
			port: parseInt(process.env.RESERVATION_MS_PORT!, 10),
		},
		payment: {
			host: process.env.PAYMENT_MS_HOST!,
			port: parseInt(process.env.PAYMENT_MS_PORT!, 10),
		},
		email: {
			host: process.env.EMAIL_MS_HOST!,
			port: parseInt(process.env.EMAIL_MS_PORT!, 10),
		},
	},
	rateLimit: {
		ttl: parseInt(process.env.RATE_LIMIT_TTL!, 10),
		limit: parseInt(process.env.RATE_LIMIT_MAX!, 10),
	},
	circuitBreaker: {
		timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT!, 10),
		errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD!, 10),
		resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT!, 10),
	},
});

