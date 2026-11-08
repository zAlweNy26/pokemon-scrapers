import { z } from 'zod'
import { evolutionStepSchema, pokemonRefSchema } from '@/api/modules/pokemon/model'

/** Input schemas stay values, not named models: see `listQuery`. */
export const chainParams = z.object({
    ndex: z.coerce.number().int().min(1).describe('National dex number of any species in the chain').meta({ examples: [25] })
})

export const evolutionModels = {
    'evolution.chain': z.object({
        id: z.number().describe('PokéAPI evolution chain id'),
        members: z.array(pokemonRefSchema).describe('Every species in the chain, by dex number'),
        steps: z
            .array(evolutionStepSchema)
            .describe('Every evolution method in the family, one per game it was recorded for')
    })
}
