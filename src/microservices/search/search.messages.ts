export const SEARCH_MS = {
	TCP_PORT: Number(process.env.SEARCH_MS_PORT ?? 4001),
	TCP_HOST: process.env.SEARCH_MS_HOST ?? '127.0.0.1',
	PATTERN: {
		SEARCH_FLIGHTS: 'search.flights',
	},
} as const;


