export const ROUTES_MS = {
	TCP_PORT: Number(process.env.ROUTES_MS_PORT ?? 4003),
	TCP_HOST: process.env.ROUTES_MS_HOST ?? '127.0.0.1',
	PATTERN: {
		UPLOAD_IMAGE: 'routes.upload-image',
	},
} as const;

