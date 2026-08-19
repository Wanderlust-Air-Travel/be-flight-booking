export const SEARCH_MS = {
    TCP_PORT: Number(process.env.SEARCH_MS_PORT) || 4001,
    TCP_HOST: process.env.SEARCH_MS_HOST,
    TCP_PEER_HOST: process.env.SEARCH_MS_PEER_HOST,
    PATTERN: {
        SEARCH_FLIGHTS: 'search.flights',
        GET_FARE_OPTIONS: 'search.fare-options',
        GET_SEAT_MAP: 'search.seat-map',
        GET_AIRPORTS: 'search.airports',
    },
} as const;
