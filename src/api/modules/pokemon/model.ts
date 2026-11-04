import { z } from 'zod'
import {
    MAX_PAGE_SIZE, booleanString, namesSchema, paginationMeta, spritesSchema
} from '../../models'

const formSchema = z.object({
    slug: z.string(),
    name: z.string(),
    isDefault: z.boolean(),
    depositable: z.boolean().describe('Can this form be moved into Pokemon HOME?'),
    types: z.array(z.string()),
    abilities: z.array(z.object({ name: z.string(), hidden: z.boolean() })),
    height: z.number().nullable().describe('Metres'),
    weight: z.number().nullable().describe('Kilograms'),
    stats: z.object({
        hp: z.number().nullable(),
        atk: z.number().nullable(),
        def: z.number().nullable(),
        spAtk: z.number().nullable(),
        spDef: z.number().nullable(),
        spd: z.number().nullable()
    }),
    sprites: spritesSchema
})

const listItemSchema = z.object({
    ndex: z.number(),
    slug: z.string(),
    generation: z.number(),
    name: namesSchema,
    types: z.array(z.string()),
    depositable: z.boolean(),
    sprites: spritesSchema
})

/**
 * Input schemas are exported as values, not registered as named models.
 * A `query`/`params` schema referenced by model name is emitted as a component
 * and never expanded into OpenAPI `parameters`, so the documented endpoint
 * would silently lose every filter. Responses keep names, which do produce $refs.
 */
export const listQuery = z.object({
        gen: z.coerce.number().int().min(1).max(9).optional(),
        type: z.string().max(20).optional().meta({ examples: ['Water'] }),
        region: z.string().max(30).optional().meta({ examples: ['Kanto'] }),
        depositable: booleanString.optional().describe('Filter on Pokemon HOME compatibility'),
        limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
        offset: z.coerce.number().int().min(0).default(0)
})

export const idOrNameParams = z.object({
        idOrName: z
            .string()
            .min(1)
            .max(64)
            .describe('National Dex number, slug, or English name')
            .meta({ examples: ['25', 'pikachu', 'Pikachu'] })
})

export const pokemonModels = {
    'pokemon.listItem': listItemSchema,

    'pokemon.list': z.object({
        data: z.array(listItemSchema),
        meta: paginationMeta
    }),

    'pokemon.detail': z.object({
        ndex: z.number(),
        slug: z.string(),
        generation: z.number(),
        category: z.string().nullable(),
        name: namesSchema,
        catchRate: z.number().nullable(),
        baseFriendship: z.number().nullable(),
        genderRate: z
            .number()
            .nullable()
            .describe('-1 when genderless, otherwise eighths female'),
        eggCycles: z.number().nullable(),
        eggGroups: z.array(z.string()),
        origins: z.record(z.string(), z.string()).describe('Name etymology, keyed by language'),
        depositable: z.boolean().describe('True when any form can enter Pokemon HOME'),
        forms: z.array(formSchema),
        encounters: z.array(
            z.object({
                game: z.string(),
                location: z.string(),
                method: z.string().nullable()
            })
        )
    })
}
