import { AsyncLocalStorage } from 'node:async_hooks'
import type { Db } from '../db/client'
import type { Env } from './platform'

/**
 * Elysia's Cloudflare adapter builds handler context from the Request alone, so
 * the `env` argument of `fetch(request, env, ctx)` never reaches a handler. The
 * request scope is carried in AsyncLocalStorage instead, which - unlike a module
 * global - stays correct when workerd runs several requests in one isolate.
 *
 * Requires the `nodejs_als` compatibility flag.
 */
export interface RequestScope {
    bindings: Env
    /** Built once per request in src/api/handler.ts. */
    db: Db
}

const storage = new AsyncLocalStorage<RequestScope>()

export const runWithScope = <T>(scope: RequestScope, fn: () => T): T => storage.run(scope, fn)

const current = (): RequestScope => {
    const scope = storage.getStore()
    if (!scope) throw new Error('Request scope unavailable: handler ran outside runWithScope()')

    return scope
}

export const env = (): Env => current().bindings

export const db = (): Db => current().db
