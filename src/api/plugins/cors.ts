import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

/**
 * A wildcard origin rather than `origin: true`, deliberately.
 *
 * Reflecting the caller's Origin would make every response vary by origin,
 * fragmenting the edge cache and risking a cached Allow-Origin being served to
 * the wrong site. This API is public, read-only and credential-free, so one
 * response is correct for everybody.
 */
export const httpAccess = new Elysia({ name: 'cors' }).use(
    cors({
        origin: '*',
        credentials: false,
        methods: ['GET', 'HEAD', 'OPTIONS'],
        allowedHeaders: ['content-type', 'if-none-match'],
        exposeHeaders: ['etag', 'cache-control', 'retry-after'],
        maxAge: 86_400
    })
)
