import { z } from 'zod'
import { booleanString, namesSchema, paginationMeta } from '@/api/models'
import { formSchema, listQuery } from '@/api/modules/pokemon/model'

const listItemSchema = formSchema
    .pick({ slug: true, name: true, isDefault: true, depositable: true, homeGames: true, types: true, sprites: true, shinySprites: true })
    .extend({ species: z.object({ ndex: z.number(), slug: z.string() }) })

/** Input schemas stay values, not named models: see `listQuery`. */
export const formsQuery = listQuery.pick({ gen: true, type: true, limit: true, offset: true }).extend({
    depositable: booleanString.optional().describe("Filter on this form's own Pokemon HOME compatibility"),
    homeGame: z
        .string()
        .max(40)
        .optional()
        .describe('Forms that can move into this game from HOME, as a PokéAPI version-group identifier')
        .meta({ examples: ['scarlet-violet'] }),
    isDefault: booleanString.optional().describe("Filter on whether the form is its species' default")
})

export const formParams = z.object({
    slug: z.string().min(1).max(64).describe('Form slug').meta({ examples: ['pikachu-partner'] })
})

export const formsModels = {
    'forms.list': z.object({
        data: z.array(listItemSchema),
        meta: paginationMeta
    }),

    'forms.detail': formSchema.extend({
        species: z.object({ ndex: z.number(), slug: z.string(), name: namesSchema })
    })
}
