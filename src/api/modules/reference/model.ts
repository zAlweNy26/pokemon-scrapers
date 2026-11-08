import { z } from 'zod'
import { namesSchema, paginationMeta } from '@/api/models'
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

export const pageQuery = listQuery.pick({ limit: true, offset: true })

/** English only for now: the one language PokéAPI has for (nearly) every ability and move. */
const englishTexts = (thing: string) => ({
    description: z.string().nullable().describe('The in-game description in English, from the latest game that has one'),
    effect: z.string().nullable().describe(`What the ${thing} does in detail, in English. Not game text: PokéAPI's own explanation; null where it has none`)
})

/** A type or ability, with a page of the species /v1/pokemon returns for it. */
const speciesPage = (description: string) =>
    namedSchema.extend({ data: z.array(pokemonRefSchema).describe(description), meta: paginationMeta })

export const referenceModels = {
    'reference.generations': z.array(
        z.object({
            id: z.number(),
            region: z.string(),
            debut: z.number().describe('Year the generation first released'),
            count: z.number()
        })
    ),

    'reference.types': z.array(
        namedSchema.extend({
            id: typeId,
            count: z.number().describe('Species whose default form has this type')
        })
    ),

    'reference.type': speciesPage('Species whose default form has this type, by dex number').extend({ id: typeId }),

    'reference.abilities': z.array(namedSchema),

    'reference.ability': speciesPage('Species with a form that has this ability, hidden or not, by dex number').extend(
        englishTexts('ability')
    ),

    'reference.moves': z.array(namedSchema),

    'reference.move': namedSchema.extend(englishTexts('move')),

    'reference.eggGroups': counted('Species in this egg group'),

    'reference.homeGames': counted('Species with a form that can move into this version group from HOME'),

    'reference.pokedexes': counted('Species in this regional Pokédex'),

    'reference.pokedex': z.object({
        data: z.array(pokemonRefSchema.extend({ number: z.number().describe('Number in this regional Pokédex') })),
        meta: paginationMeta
    })
}
