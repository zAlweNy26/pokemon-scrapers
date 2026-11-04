import { z } from 'zod'

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
        z.object({
            name: z.string(),
            count: z.number().describe('Species whose default form has this type')
        })
    )
}
