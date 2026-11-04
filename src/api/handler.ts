import { createDb } from '../db/client'
import { app } from './app'
import { runWithScope } from './env'
import { logRequest } from './log'
import type { Env } from './platform'

/**
 * The whole request path in one function: bindings and a Drizzle client into
 * AsyncLocalStorage, the Elysia app, then the access log.
 *
 * It lives apart from the Void route (src/routes/[...path].ts) so tests can drive exactly what
 * production runs - ALS included - without a Worker runtime.
 */
export const handleRequest = async (request: Request, env: Env): Promise<Response> => {
    const startedAt = Date.now()

    // The errors plugin turns every failure into a response, so a rejection here
    // means something upstream of it broke - which is exactly the request you
    // want in the log. `finally` guarantees the line, and the pre-set 500 keeps
    // it truthful about what the caller received.
    let status = 500

    try {
        const response = notModified(
            request,
            await runWithScope({ bindings: env, db: createDb(env.DB) }, () => app.fetch(request))
        )

        status = response.status

        return harden(response)
    } finally {
        logRequest(request, status, Date.now() - startedAt)
    }
}

/**
 * Answers a matching If-None-Match with a bodyless 304. Built here, not in the
 * cache plugin: Elysia's `status(304)` attaches a body, which workerd rejects
 * (Bun does not, so only a real Worker shows it).
 *
 * Weak comparison, as RFC 9110 requires for If-None-Match: the header may be a
 * list, `*`, or carry `W/` - which Cloudflare adds when it compresses a response.
 */
const notModified = (request: Request, response: Response): Response => {
    const etag = response.headers.get('etag')
    const tags = request.headers
        .get('if-none-match')
        ?.split(',')
        .map((tag) => tag.trim().replace(/^W\//, ''))

    return response.status === 200 && etag && (tags?.includes(etag) || tags?.includes('*'))
        ? new Response(null, { status: 304, headers: response.headers })
        : response
}

/**
 * Applied here rather than in an Elysia hook because this is the only point every
 * response passes through: `onAfterHandle` never runs for the ones that most need
 * a content-type guarantee - problem documents from the error plugin - and it
 * would also miss the HTML that Scalar serves at /docs.
 */
const harden = (response: Response): Response => {
    response.headers.set('x-content-type-options', 'nosniff')

    return response
}
