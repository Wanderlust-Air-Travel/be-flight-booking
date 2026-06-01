export const EMAIL_MS = {
	TCP_PORT: Number(process.env.EMAIL_MS_PORT),
	TCP_HOST: process.env.EMAIL_MS_HOST,
	PATTERN: {
		SEND_EMAIL: 'email.send',
		SEND_BATCH_EMAILS: 'email.send-batch',
		GET_EMAIL_STATUS: 'email.get-status',
		HEALTH_CHECK: 'email.health',
	},
} as const;

