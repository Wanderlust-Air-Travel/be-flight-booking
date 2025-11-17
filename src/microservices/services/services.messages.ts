export const SERVICES_MS = {
	TCP_PORT: Number(process.env.SERVICES_MS_PORT ?? 4002),
	TCP_HOST: process.env.SERVICES_MS_HOST ?? '127.0.0.1',
	PATTERN: {
		GET_DEALS: 'services.get-deals',
	},
} as const;

