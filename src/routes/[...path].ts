import { defineHandler } from 'void'
import { handleRequest } from '@/api/handler'
import type { Env } from '@/api/platform'

declare global {
    // Types `c.env` with the bindings from void.config.ts; Void only generates the ones it infers.
    interface VoidGeneratedEnvBindings extends Env {}
}

/**
 * Void hosts and deploys the Worker; Elysia (src/api/app.ts) owns all routing.
 * Every path lands here and is handed over untouched, so the request path is
 * exactly what tests drive through `handleRequest`.
 */
const elysia = defineHandler((c) => handleRequest(c.req.raw, c.env))

export const GET = elysia
export const OPTIONS = elysia
