import { z } from 'zod'
import { booleanString, namesSchema, paginationMeta } from '@/api/models'
import { encounterSchema, formSchema, listQuery } from '@/api/modules/pokemon/model'
import { FORM_CATEGORIES } from '@/db/schema'

const listItemSchema = formSchema
    .pick({ slug: true, name: true, isDefault: true, category: true, depositable: true, homeGames: true, types: true, sprites: true, shinySprites: true, variants: true })
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
    isDefault: booleanString.optional().describe("Filter on whether the form is its species' default"),
    category: z.enum(FORM_CATEGORIES).optional().describe('Forms of this category; see `category` on a form')
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
        species: z.object({ ndex: z.number(), slug: z.string(), name: namesSchema }),
        encounters: z.array(encounterSchema).describe('Where this form itself is found, per game')
    })
}
