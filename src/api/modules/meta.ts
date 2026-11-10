import { Elysia } from 'elysia'
import { z } from 'zod'
import { meta as metaTable } from '@/db/schema'
import { db, env } from '@/api/env'
import { sharedModels } from '@/api/models'

/**
 * Lets a consumer detect a dataset change without diffing payloads, and answers
 * "is production actually serving the new data?" from a single URL. `dataVersion`
 * is the same value that seeds every ETag.
 */
export const meta = new Elysia({ name: 'module.meta' }).use(sharedModels).get(
    '/meta',
    async () => {
        const rows = await db()
            .select({ key: metaTable.key, value: metaTable.value })
            .from(metaTable)

        // Counts are written by the data load, not computed here: any extra query
        // string misses the edge cache, and counting per request would scan
        // three tables on every miss.
        // data_version and loaded_at are the deploy guard's (.github/workflows/deploy.yml), not sources.
        const { generated_at, count_pokemon, count_forms, count_encounters, data_version, loaded_at, ...sources } =
            Object.fromEntries(rows.map((row) => [row.key, row.value]))

        return {
            dataVersion: env().DATA_VERSION,
            generatedAt: generated_at ?? null,
            counts: {
                pokemon: Number(count_pokemon ?? 0),
                forms: Number(count_forms ?? 0),
                encounters: Number(count_encounters ?? 0)
            },
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
        detail: {
            summary: 'Get dataset info',
            description: 'Dataset version, provenance and counts.',
            tags: ['Meta']
        }
    }
)
