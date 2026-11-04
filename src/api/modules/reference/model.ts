import { z } from 'zod'
import { namesSchema } from '@/api/models'

/** An identifier other endpoints return, with its display name per language. */
const namedSchema = z.object({
    slug: z.string().describe('The identifier other endpoints return'),
    name: namesSchema
})

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

    'reference.moves': z.array(namedSchema)
}
