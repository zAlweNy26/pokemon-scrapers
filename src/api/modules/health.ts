import { Elysia } from 'elysia'
import { z } from 'zod'
import { pokemon } from '../../db/schema'
import { db, env } from '../env'

/**
 * Deliberately reads from D1 rather than returning a constant: the interesting
 * failure is not "the Worker is down" (Cloudflare runs it) but "the Worker is up
 * and the data is missing". Never cached - a cached health check is a lie.
 *
 * Reads one row, not a count: this route is unthrottled and uncached, and D1
 * bills `count(*)` as reading the whole table.
 */
export const health = new Elysia({ name: 'module.health' }).get(
    '/health',
    async ({ set }) => {
        set.headers['cache-control'] = 'no-store'

        const [row] = await db().select({ ndex: pokemon.ndex }).from(pokemon).limit(1)

        return { ok: row !== undefined, dataVersion: env().DATA_VERSION }
    },
    {
        response: z.object({
            ok: z.boolean(),
            dataVersion: z.string()
        })
    }
)
