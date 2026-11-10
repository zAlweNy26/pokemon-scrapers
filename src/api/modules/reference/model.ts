import { z } from 'zod'
import { categorySchema, namesSchema, paginationMeta } from '@/api/models'
import { listQuery, pokemonRefSchema } from '@/api/modules/pokemon/model'

/** An identifier other endpoints return, with its display name per language. */
const namedSchema = z.object({
    slug: z.string().describe('The identifier other endpoints return'),
    name: namesSchema
})

const typeId = z.number().nullable().describe("Gen IX index number, as Bulbapedia lists it; null for ??? and Shadow, which have none")

/** A value a /v1/pokemon filter accepts, with how many species it matches there. */
const counted = (count: string) => z.array(z.object({ slug: z.string(), count: z.number().describe(count) }))

/** Input schemas stay values, not named models: see `listQuery`. */
export const pokedexParams = z.object({
    slug: z.string().min(1).max(40).describe('PokéAPI pokedex identifier').meta({ examples: ['paldea'] })
})

export const typeParams = z.object({
    slug: z.string().min(1).max(20).describe('Type identifier').meta({ examples: ['water'] })
})

export const abilityParams = z.object({
    slug: z.string().min(1).max(40).describe('Ability identifier').meta({ examples: ['levitate'] })
})

export const moveParams = z.object({
    slug: z.string().min(1).max(40).describe('Move identifier').meta({ examples: ['thunderbolt'] })
})

export const gameParams = z.object({
    slug: z.string().min(1).max(40).describe('PokéAPI version identifier').meta({ examples: ['scarlet'] })
})

export const pageQuery = listQuery.pick({ limit: true, offset: true })

/** The games' description in every language, and PokéAPI's English effect. */
const describedTexts = (thing: string) => ({
    description: categorySchema.describe(
        'The in-game description in each language, from the latest game that has one; null in a language no game describes it in'
    ),
    effect: z.string().nullable().describe(`What the ${thing} does in detail, in English. Not game text: PokéAPI's own explanation; null where it has none`)
})

/** A type or ability, with a page of the species /v1/pokemon returns for it. */
const speciesPage = (description: string) =>
    namedSchema.extend({ data: z.array(pokemonRefSchema).describe(description), meta: paginationMeta })

const gameSchema = z.object({
    slug: z.string().describe('PokéAPI version identifier, as the `game` of Pokédex entries, availability and encounters'),
    name: namesSchema.describe(
        'Not game text: PokéAPI\'s version names, without "Pokémon"; a DLC is named after its game ("Scarlet: The Teal Mask")'
    ),
    generation: z.number(),
    versionGroup: z.string().describe('PokéAPI version group, as the `game` of evolutions and HOME games'),
    baseGame: z.string().nullable().describe('The game this DLC extends; null for a game sold on its own'),
    dlcs: z.array(z.string()).describe('The DLCs that extend this game, in release order'),
    color: z.string().describe("Bulbapedia's colour for the game, as hex (`#F34134`); each DLC has its own")
})

const pokedexSchema = z.object({
    slug: z.string().describe('PokéAPI pokedex identifier, as /v1/pokedexes/{slug} and the `pokedex` filter on /v1/pokemon take it'),
    name: namesSchema.describe(
        'The label a game gives this Pokédex ("Kitakami Pokédex"). Where no game names it on its own (Kanto, Johto, ' +
            "Hisui...), every language is null but `en`, which is PokéAPI's name for it and not game text"
    ),
    region: z.string().nullable().describe("PokéAPI region identifier, as a generation's `region`; null for a Pokédex of no region"),
    mainSeries: z.boolean().describe("False for a spin-off's Pokédex (`champions`)"),
    games: z
        .array(z.string())
        .describe('Versions that use this Pokédex, DLCs included, in release order, as /v1/games/{slug} takes them')
        .meta({ examples: [['scarlet', 'violet']] })
})

export const referenceModels = {
    'Generations': z.array(
        z.object({
            id: z.number(),
            region: z.string(),
            debut: z.number().describe('Year the generation first released'),
            count: z.number(),
            games: z
                .array(
                    z.object({
                        versionGroup: z.string(),
                        versions: z.array(z.string()).describe('Slugs /v1/games/{slug} takes')
                    })
                )
                .describe('Version groups in release order, DLCs as their own groups')
                .meta({ examples: [[{ versionGroup: 'scarlet-violet', versions: ['scarlet', 'violet'] }]] })
        })
    ),

    'Games': z.array(gameSchema),

    'Game': gameSchema,

    'Types': z.array(
        namedSchema.extend({
            id: typeId,
            count: z.number().describe('Species whose default form has this type')
        })
    ),

    'Type': speciesPage('Species whose default form has this type, by dex number').extend({ id: typeId }),

    'Abilities': z.array(namedSchema),

    'Ability': speciesPage('Species with a form that has this ability, hidden or not, by dex number').extend(
        describedTexts('ability')
    ),

    'Moves': z.array(namedSchema),

    'Move': namedSchema.extend(describedTexts('move')),

    'EggGroups': counted('Species in this egg group'),

    'HomeGames': counted('Species with a form that can move into this version group from HOME'),

    'Pokedexes': z.array(pokedexSchema.extend({ count: z.number().describe('Species in this regional Pokédex') })),

    'Pokedex': pokedexSchema.extend({
        data: z.array(pokemonRefSchema.extend({ number: z.number().describe('Number in this regional Pokédex') })),
        meta: paginationMeta
    })
}
