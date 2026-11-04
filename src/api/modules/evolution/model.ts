import { z } from 'zod'
import { evolutionStepSchema, listItemSchema } from '@/api/modules/pokemon/model'

/** Input schemas stay values, not named models: see `listQuery`. */
export const chainParams = z.object({
    id: z.coerce.number().int().min(1).describe('PokéAPI evolution chain id').meta({ examples: [10] })
})

export const evolutionModels = {
    'evolution.chain': z.object({
        id: z.number(),
        members: z.array(listItemSchema).describe('Every species in the chain, by dex number'),
        steps: z
            .array(evolutionStepSchema)
            .describe('Every evolution method in the family, one per game it was recorded for')
    })
}
