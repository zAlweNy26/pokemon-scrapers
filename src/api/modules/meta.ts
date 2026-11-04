import { count } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Db } from '../../db/client'
import { encounter, form, meta as metaTable, pokemon } from '../../db/schema'
import { db, env } from '../env'
import { sharedModels } from '../models'

const counts = async (database: Db) => {
    const [pokemonCount, formCount, encounterCount] = await database.batch([
        database.select({ n: count() }).from(pokemon),
        database.select({ n: count() }).from(form),
        database.select({ n: count() }).from(encounter)
    ])

    return {
        pokemon: pokemonCount[0]?.n ?? 0,
        forms: formCount[0]?.n ?? 0,
        encounters: encounterCount[0]?.n ?? 0
    }
}

/**
 * Lets a consumer detect a dataset change without diffing payloads, and answers
 * "is production actually serving the new data?" from a single URL. `dataVersion`
 * is the same value that seeds every ETag.
 */
export const meta = new Elysia({ name: 'module.meta' }).use(sharedModels).get(
    '/meta',
    async () => {
        const database = db()

        const rows = await database
            .select({ key: metaTable.key, value: metaTable.value })
            .from(metaTable)

        const { generated_at, ...sources } = Object.fromEntries(
            rows.map((row) => [row.key, row.value])
        )

        return {
            dataVersion: env().DATA_VERSION,
            generatedAt: generated_at ?? null,
            counts: await counts(database),
            sources
        }
    },
    {
        response: {
            200: z.object({
                dataVersion: z.string(),
                generatedAt: z.string().nullable(),
                counts: z.object({
                    pokemon: z.number(),
                    forms: z.number(),
                    encounters: z.number()
                }),
                sources: z.record(z.string(), z.string())
            }),
            429: 'problem'
        },
        detail: { summary: 'Dataset version, provenance and counts', tags: ['Meta'] }
    }
)
