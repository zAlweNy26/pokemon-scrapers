/**
 * Cloudflare's native rate-limiting binding, narrowed to the one call we make.
 *
 * Note that the underlying limiter counts per Cloudflare location rather than
 * globally, so this is abuse control - not a quota anyone could bill against.
 */
export interface RateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Requests per IP per window, for the RL_* bindings in void.config.ts and the API docs.
 * Cloudflare permits only a 10s or 60s window. Keep this file import-free: void.config.ts loads it.
 */
export const RATE_LIMITS = { windowSeconds: 60, global: 120, search: 20 } as const

/** Bindings declared in void.config.ts. */
export interface Env {
    /** Raw D1 binding. Wrapped in Drizzle once per request by src/api/handler.ts. */
    DB: D1Database
    RL_GLOBAL: RateLimiter
    RL_SEARCH: RateLimiter
    /** The dataset build id, set per deploy in void.config.ts. Seeds every ETag. */
    DATA_VERSION: string
    /** Public base URL of the R2 image bucket; forms sprite URLs. */
    IMAGE_BASE_URL: string
}
