import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { cacheable } from './plugins/cache'
import { httpAccess } from './plugins/cors'
import { errors } from './plugins/errors'
import { documentation } from './plugins/openapi'
import { globalRateLimit } from './plugins/rate-limit'

import { health } from './modules/health'
import { meta } from './modules/meta'
import { pokemon } from './modules/pokemon'
import { reference } from './modules/reference'
import { search } from './modules/search'

/**
 * Composition root. Every module is a self-contained Elysia plugin, so this file
 * says what the API is made of and nothing about how any of it works.
 *
 * Ordering matters: /health and the docs sit outside the /v1 group so they are
 * neither rate-limited nor edge-cached, while everything inside inherits both.
 *
 * Access logging is not here - it runs in src/api/handler.ts, because a
 * post-response hook never executes on workerd.
 *
 * `aot: false`: AOT compiles routes with `new Function`, which workerd only
 * allows at startup, and Void loads this module lazily on the first request.
 */
export const app = new Elysia({ adapter: CloudflareAdapter, aot: false })
    .use(errors)
    .use(httpAccess)
    .use(documentation)
    .use(health)
    .group('/v1', (v1) =>
        v1
            .use(cacheable)
            .use(globalRateLimit)
            .use(pokemon)
            .use(search)
            .use(reference)
            .use(meta)
    )

export type App = typeof app
