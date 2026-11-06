import { z } from 'zod'
import { MAX_QUERY_LENGTH, namesSchema, spritesSchema } from '@/api/models'

const resultSchema = z.object({
    ndex: z.number(),
    slug: z.string(),
    generation: z.number(),
    name: namesSchema,
    matchedIn: z
        .string()
        .nullable()
        .describe('Which language matched, when it can be determined'),
    depositable: z.boolean(),
    sprites: spritesSchema
})

/** Exported as a value: a named model would vanish from the spec's `parameters`. */
export const searchQuery = z.object({
        q: z
            .string()
            // Trimmed before the length checks, not after. Validating the raw
            // string and trimming in the handler let "   " through as a
            // two-character query, which then fell below the trigram floor and
            // prefix-scanned `LIKE '%'` - returning a page of arbitrary species.
            .trim()
            .min(2)
            .max(MAX_QUERY_LENGTH)
            .describe(
                'Name fragment in any of the nine supported languages. Three or more characters use the full-text index; two-character queries (common in Japanese, Korean and Chinese) match by prefix.'
            )
            .meta({ examples: ['pika', 'Quaj', 'ゲンガ'] }),
        limit: z.coerce.number().int().min(1).max(50).default(20)
})

export const searchModels = {
    'search.result': resultSchema,

    'search.results': z.object({
        data: z.array(resultSchema),
        meta: z.object({
            // `count`, not `total`: search is not paginated (there is no offset),
            // so there is no unpaginated total to report and calling the page
            // size `total` claimed a match count it never had.
            count: z.number().describe('Results returned, at most `limit`'),
            limit: z.number(),
            query: z.string().describe('The query as searched, after trimming')
        })
    })
}
