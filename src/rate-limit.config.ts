// General navigation makes several reads; authentication keeps its stricter route overrides.
export const API_RATE_LIMIT = { ttl: 60_000, limit: 120 };
