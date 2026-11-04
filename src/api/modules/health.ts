import { count } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { pokemon } from '../../db/schema'
import { db, env } from '../env'

/**
 * Deliberately reads from D1 rather than returning a constant: the interesting
 * failure is not "the Worker is down" (Cloudflare runs it) but "the Worker is up
 * and the data is missing". Never cached - a cached health check is a lie.
 */
export const health = new Elysia({ name: 'module.health' }).get(
    '/health',
    async ({ set }) => {
        set.headers['cache-control'] = 'no-store'

        const [row] = await db().select({ n: count() }).from(pokemon)
        const found = row?.n ?? 0

        return { ok: found > 0, dataVersion: env().DATA_VERSION, pokemon: found }
    },
    {
        response: z.object({
            ok: z.boolean(),
            dataVersion: z.string(),
            pokemon: z.number()
        })
    }
)
