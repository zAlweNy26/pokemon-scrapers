import { z } from 'zod'
import { namesSchema, paginationMeta } from '@/api/models'
import { listItemSchema, listQuery } from '@/api/modules/pokemon/model'

/** An identifier other endpoints return, with its display name per language. */
const namedSchema = z.object({
    slug: z.string().describe('The identifier other endpoints return'),
    name: namesSchema
})

/** A value a /v1/pokemon filter accepts, with how many species it matches there. */
const counted = (count: string) => z.array(z.object({ slug: z.string(), count: z.number().describe(count) }))

/** Input schemas stay values, not named models: see `listQuery`. */
export const pokedexParams = z.object({
    slug: z.string().min(1).max(40).describe('PokéAPI pokedex identifier').meta({ examples: ['paldea'] })
})

export const pageQuery = listQuery.pick({ limit: true, offset: true })

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
            count: z.number().describe('Species whose default form has this type')
        })
    ),

    'reference.abilities': z.array(namedSchema),

    'reference.moves': z.array(namedSchema),

    'reference.eggGroups': counted('Species in this egg group'),

    'reference.homeGames': counted('Species with a form that can move into this version group from HOME'),

    'reference.pokedexes': counted('Species in this regional Pokédex'),

    'reference.pokedex': z.object({
        data: z.array(listItemSchema.extend({ number: z.number().describe('Number in this regional Pokédex') })),
        meta: paginationMeta
    })
}
