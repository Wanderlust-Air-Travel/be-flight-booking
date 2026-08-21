export const SERVICES_MS = {
    TCP_PORT: Number(process.env.SERVICES_MS_PORT) || 4002,
    TCP_HOST: process.env.SERVICES_MS_HOST,
    TCP_PEER_HOST: process.env.SERVICES_MS_PEER_HOST,
    PATTERN: {
        GET_DEALS: 'services.get-deals',
        APPLY_PROMOTION: 'services.apply-promotion',
    },
} as const;
