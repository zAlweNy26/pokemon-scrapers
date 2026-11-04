import { Elysia } from 'elysia'
import { env } from '../env'

/**
 * Browsers recheck every 5 minutes; the edge holds for a week (604800s) and may
 * serve stale for a day while it revalidates, or if the origin is failing. That
 * is safe because a dataset change always ships as a deploy, and Workers Cache
 * keys on the Worker version - so a release invalidates the whole edge by itself.
 *
 * `s-maxage` is what Workers Cache actually reads (RFC 9111). `CDN-Cache-Control`
 * (RFC 9213) says the same thing to any CDN that prefers the targeted header, so
 * both are emitted rather than betting on one.
 */
const BROWSER_POLICY =
    'public, max-age=300, s-maxage=604800, stale-while-revalidate=86400, stale-if-error=86400'
const EDGE_POLICY = 'public, max-age=604800, stale-while-revalidate=86400, stale-if-error=86400'

/** FNV-1a. A cache validator, not a security primitive - a collision costs one revalidation. */
const fingerprint = (input: string) => {
    let hash = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(16)
}

/**
 * Responses are a pure function of (dataset version, path, query), so the request
 * identifies the body - no need to hash a payload to produce a strong ETag.
 */
const etagFor = (version: string, path: string, query: Record<string, unknown>) => {
    const normalised = Object.keys(query)
        .filter((key) => query[key] !== undefined)
        .sort()
        .map((key) => `${key}=${String(query[key])}`)
        .join('&')

    return `"${version}-${fingerprint(`${path}?${normalised}`)}"`
}

export const cacheable = new Elysia({ name: 'cacheable' })
    // The matching 304 is answered in src/api/handler.ts, from the ETag set here.
    .onAfterHandle(({ path, query, set }) => {
        const etag = etagFor(env().DATA_VERSION, path, query as Record<string, unknown>)

        set.headers['etag'] = etag
        set.headers['vary'] = 'accept-encoding'
        set.headers['cache-control'] = BROWSER_POLICY
        set.headers['cdn-cache-control'] = EDGE_POLICY
    })
    .as('scoped')
