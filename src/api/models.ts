import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Names } from './names'
import type { Sprites } from './sprites'

/**
 * Shared schemas. Zod here rather than TypeBox: Elysia accepts any Standard
 * Schema validator, `.model()` still yields named `$ref`s in the OpenAPI
 * document, and zod reports the offending property on a failure - which
 * TypeBox does not do for coerced query parameters.
 */

/** RFC 9457 problem details, as rendered by the errors plugin. */
export const problemSchema = z.object({
    type: z.string().meta({ examples: ['/errors/not-found'] }),
    title: z.string().meta({ examples: ['Not Found'] }),
    status: z.number().meta({ examples: [404] }),
    detail: z.string().optional(),
    instance: z.string().optional(),
    /** RFC 9457 extension member: per-field detail on validation failures. */
    errors: z
        .array(z.object({ property: z.string().optional(), message: z.string() }))
        .optional()
})

export const paginationMeta = z.object({
    total: z.number().describe('Matching records before pagination'),
    limit: z.number(),
    offset: z.number()
})

/**
 * `satisfies` is load-bearing, not decoration: it pins this published schema to
 * the language table in src/api/names.ts, so adding a language there and
 * forgetting it here is a compile error instead of a field that quietly never
 * appears in the response.
 */
export const namesSchema = z
    .object({
        en: z.string(),
        ja: z.string().nullable(),
        ja_romaji: z.string().nullable(),
        de: z.string().nullable(),
        fr: z.string().nullable(),
        it: z.string().nullable(),
        es: z.string().nullable(),
        ko: z.string().nullable(),
        zh_hans: z.string().nullable(),
        zh_hant: z.string().nullable()
    })
    .describe('The name in each of the nine languages the core games ship in') satisfies z.ZodType<Names>

export const spritesSchema = z
    .record(z.string(), z.string())
    .nullable()
    .describe(
        'Absolute image URLs keyed by pixel width; null when no artwork is published'
    ) satisfies z.ZodType<Sprites | null>

/**
 * Query booleans, spelled out as an enum rather than coerced.
 * `z.coerce.boolean()` would read the string "false" as true.
 */
export const booleanString = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')

/** Hard caps, not defaults a caller can talk us out of. */
export const MAX_PAGE_SIZE = 100
export const MAX_QUERY_LENGTH = 64

/**
 * Registered by every module rather than once on the root instance: an Elysia
 * plugin is type-checked in isolation, so a module referencing `'problem'` by
 * name has to have the model in scope itself. Instances are deduplicated by
 * name, so using this everywhere costs nothing.
 */
export const sharedModels = new Elysia({ name: 'models.shared' }).model({
    problem: problemSchema
})
