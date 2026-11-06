import { Elysia } from 'elysia'
import { env } from '@/api/env'
import { rateLimited } from '@/api/problem'
import type { Env, RateLimiter } from '@/api/platform'

/** Cloudflare's binding only permits a 10s or 60s window; the limits live in void.config.ts. */
const WINDOW_SECONDS = 60

/**
 * Behind Cloudflare every request originates from a Cloudflare address, so the
 * connecting IP must come from this header. Keying on the socket address would
 * put the entire internet in one bucket and rate-limit the API against itself.
 */
const clientKey = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown'

/**
 * Asks Cloudflare's rate-limiting binding, which counts across isolates (per
 * location) - an in-process counter would admit roughly `max x isolates`.
 * The binding answers allow/deny only, so no `RateLimit-*` headers are sent:
 * a remaining-requests figure would be fabricated.
 *
 * Thrown rather than returned, so it lands in the errors plugin as problem+json.
 * 'scoped' propagates exactly one level: to the instance that `.use()`s it.
 */
const limiter = (name: string, pick: (bindings: Env) => RateLimiter) =>
    new Elysia({ name }).onBeforeHandle({ as: 'scoped' }, async ({ request }) => {
        const { success } = await pick(env()).limit({ key: clientKey(request) })
        if (!success) throw rateLimited(WINDOW_SECONDS)
    })

/** Applies to everything under /v1. Generous enough that normal use never notices. */
export const globalRateLimit = limiter('rate-limit.global', (bindings) => bindings.RL_GLOBAL)

/** Search is the only endpoint that can be made to do real work, so it is priced separately. */
export const searchRateLimit = limiter('rate-limit.search', (bindings) => bindings.RL_SEARCH)
