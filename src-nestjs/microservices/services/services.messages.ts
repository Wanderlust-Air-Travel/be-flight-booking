export const SERVICES_MS = {
	TCP_PORT: Number(process.env.SERVICES_MS_PORT) || 4002,
	TCP_HOST: process.env.SERVICES_MS_HOST,
	PATTERN: {
		GET_DEALS: 'services.get-deals',
	},
} as const;

