import { z } from 'zod'
import {
    MAX_PAGE_SIZE, booleanString, categorySchema, namesSchema, paginationMeta, spritesSchema
} from '@/api/models'

const formSchema = z.object({
    slug: z.string(),
    name: namesSchema,
    isDefault: z.boolean(),
    depositable: z.boolean().describe('Can this form be stored in Pokémon HOME?'),
    homeGames: z
        .array(z.string())
        .describe('Games this form can be moved into from HOME, as version-group identifiers')
        .meta({ examples: [['sword-shield', 'scarlet-violet']] }),
    types: z.array(z.string()).describe('Type identifiers; /v1/types has their names'),
    abilities: z.array(z.object({ slug: z.string(), name: namesSchema, hidden: z.boolean() })),
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
    evYield: z
        .object({ hp: z.number(), atk: z.number(), def: z.number(), spAtk: z.number(), spDef: z.number(), spd: z.number() })
        .nullable()
        .describe('Effort values earned for defeating this form; null when the source does not have them yet'),
    baseExperience: z.number().nullable(),
    sprites: spritesSchema
})

const evolutionConditionsSchema = z
    .object({
        minLevel: z.number(),
        item: z.string(),
        heldItem: z.string(),
        knownMove: z.string(),
        knownMoveType: z.string(),
        usedMove: z.string(),
        minMoveCount: z.number(),
        gender: z.enum(['female', 'male']),
        timeOfDay: z.string(),
        location: z.string(),
        region: z.string(),
        minHappiness: z.number(),
        minBeauty: z.number(),
        minAffection: z.number(),
        relativePhysicalStats: z.number().describe('1: Attack > Defense, 0: equal, -1: Attack < Defense'),
        partySpecies: z.string(),
        partyType: z.string(),
        tradeSpecies: z.string(),
        minSteps: z.number(),
        minDamageTaken: z.number(),
        natures: z.array(z.string()),
        percentageChance: z.number(),
        expression: z.string().describe("PokéAPI's raw rule on hidden values, e.g. `EC 100 % 0 ==`"),
        overworldRain: z.literal(true),
        upsideDown: z.literal(true),
        multiplayer: z.literal(true),
        nearSpecialRock: z.literal(true)
    })
    .partial()
    .describe('What the method needs beyond its trigger; absent keys do not apply. Values are PokéAPI identifiers')
    .meta({ examples: [{ item: 'thunder-stone' }, { minLevel: 35, timeOfDay: 'night' }] })

const evolutionStepSchema = z.object({
    from: z.string().describe('Species slug'),
    into: z.string().describe('Species slug'),
    fromForm: z.string().nullable().describe('Set when only this form evolves'),
    intoForm: z.string().nullable().describe('Set when the result is this form'),
    trigger: z.string().meta({ examples: ['level-up', 'use-item', 'trade'] }),
    game: z.string().describe('Version group the method was recorded for'),
    isDefault: z.boolean(),
    conditions: evolutionConditionsSchema
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
        gen: z.coerce.number().int().min(1).optional(),
        type: z.string().max(20).optional().meta({ examples: ['Water'] }),
        region: z.string().max(30).optional().meta({ examples: ['Kanto'] }),
        depositable: booleanString.optional().describe('Filter on Pokemon HOME compatibility'),
        homeGame: z
            .string()
            .max(40)
            .optional()
            .describe('Species with a form that can move into this game from HOME, as a PokéAPI version-group identifier')
            .meta({ examples: ['scarlet-violet'] }),
        ability: z
            .string()
            .max(40)
            .optional()
            .describe('Species with a form that has this ability, hidden or not, as an ability identifier')
            .meta({ examples: ['levitate'] }),
        hiddenAbility: z
            .string()
            .max(40)
            .optional()
            .describe('Species with a form that has this as its hidden ability, as an ability identifier')
            .meta({ examples: ['lightning-rod'] }),
        eggGroup: z
            .string()
            .max(40)
            .optional()
            .describe('PokéAPI egg-group identifier')
            .meta({ examples: ['dragon'] }),
        obtainableIn: z
            .string()
            .max(40)
            .optional()
            .describe('Species the game can get on its own, any DLC included, as a PokéAPI version identifier (not a version group)')
            .meta({ examples: ['scarlet'] }),
        legendary: booleanString.optional().describe('Filter on the legendary species flag'),
        mythical: booleanString.optional().describe('Filter on the mythical species flag'),
        baby: booleanString.optional().describe('Filter on the baby species flag'),
        color: z.string().max(40).optional().describe('PokéAPI color identifier').meta({ examples: ['yellow'] }),
        shape: z.string().max(40).optional().describe('PokéAPI shape identifier').meta({ examples: ['quadruped'] }),
        habitat: z.string().max(40).optional().describe('PokéAPI habitat identifier').meta({ examples: ['forest'] }),
        growthRate: z
            .string()
            .max(40)
            .optional()
            .describe('PokéAPI growth-rate identifier')
            .meta({ examples: ['medium-slow'] }),
        ids: z
            .string()
            .regex(/^\d+(,\d+)*$/, 'Expected comma-separated National Dex numbers')
            .transform((value) => [...new Set(value.split(',').map(Number))])
            .pipe(z.array(z.number().int().min(1)).max(MAX_PAGE_SIZE))
            .optional()
            .describe(`Comma-separated National Dex numbers, at most ${MAX_PAGE_SIZE}`)
            .meta({ examples: ['1,4,7'] }),
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
        category: categorySchema,
        name: namesSchema,
        catchRate: z.number().nullable(),
        baseFriendship: z.number().nullable(),
        genderRate: z
            .number()
            .nullable()
            .describe('-1 when genderless, otherwise eighths female'),
        eggCycles: z.number().nullable(),
        isLegendary: z.boolean(),
        isMythical: z.boolean(),
        isBaby: z.boolean(),
        hasGenderDifferences: z.boolean(),
        formsSwitchable: z.boolean(),
        growthRate: z.string().meta({ examples: ['medium-slow'] }),
        color: z.string(),
        shape: z.string(),
        habitat: z.string().nullable().describe('Only Generations 1-3 had habitats'),
        dexNumbers: z
            .record(z.string(), z.number())
            .describe('Regional Pokédex numbers, keyed by PokéAPI pokedex identifier; National is `ndex`')
            .meta({ examples: [{ kanto: 25, paldea: 74 }] }),
        evolutionChain: z.object({
            id: z.number(),
            steps: z.array(evolutionStepSchema).describe('Every evolution method in the family, one per game it was recorded for')
        }),
        eggGroups: z.array(z.string()),
        origins: z.record(z.string(), z.string()).describe('Name etymology, keyed by language'),
        depositable: z.boolean().describe('True when any form can enter Pokemon HOME'),
        forms: z.array(formSchema),
        pokedexEntries: z
            .array(
                z.object({
                    game: z.string().describe('PokéAPI version identifier'),
                    form: z.string().nullable().describe("Bulbapedia's form label ('Alolan Form'); null for the species"),
                    text: z.string()
                })
            )
            .describe('Pokédex entries in English, from Bulbapedia, oldest game first'),
        availability: z
            .array(
                z.object({
                    game: z.string().describe('PokéAPI version identifier'),
                    dlc: z.string().nullable().meta({ examples: ['expansion-pass', 'mega-dimension'] }),
                    area: z.string().nullable().describe('Where and how, as Bulbapedia words it, form notes included'),
                    obtainable: z.boolean().describe('False when the game cannot get it on its own; `area` then says how it gets in')
                })
            )
            .describe('Game locations for every main-series game and DLC, from Bulbapedia, oldest first'),
        encounters: z.array(
            z.object({
                game: z.string(),
                location: z.string(),
                method: z.string().nullable()
            })
        )
    })
}
