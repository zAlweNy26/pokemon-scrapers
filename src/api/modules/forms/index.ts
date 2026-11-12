import { Elysia } from 'elysia'
import { db, env } from '@/api/env'
import { sharedModels } from '@/api/models'
import { notFound } from '@/api/problem'
import { formParams, formsModels, formsQuery } from './model'
import * as service from './service'

export const forms = new Elysia({ name: 'module.forms', prefix: '/forms' })
    .use(sharedModels)
    .model(formsModels)
    .get(
        '',
        async ({ query }) => {
            const { total, items } = await service.list(
                db(),
                {
                    gen: query.gen,
                    type: query.type,
                    depositable: query.depositable,
                    homeGame: query.homeGame,
                    isDefault: query.isDefault,
                    category: query.category,
                    limit: query.limit,
                    offset: query.offset
                },
                env().IMAGE_BASE_URL
            )

            return { data: items, meta: { total, limit: query.limit, offset: query.offset } }
        },
        {
            query: formsQuery,
            response: { 200: 'FormList', 304: 'NotModified', 422: 'Problem', 429: 'Problem' },
            detail: {
                operationId: 'listForms',
                summary: 'List forms',
                description:
                    'Every form of every species, where HOME depositability actually lives: `depositable` here is the ' +
                    "form's own, so it tells Pikachu apart from forms that cannot enter HOME.",
                tags: ['Pokémon']
            }
        }
    )
    .get(
        '/:slug',
        async ({ params }) => {
            const found = await service.detail(db(), params.slug, env().IMAGE_BASE_URL)
            if (!found) throw notFound(`No form matches "${params.slug}".`)

            return found
        },
        {
            params: formParams,
            response: { 200: 'Form', 304: 'NotModified', 404: 'Problem', 422: 'Problem', 429: 'Problem' },
            detail: {
                operationId: 'getForm',
                summary: 'Get a form',
                description: 'The form as /v1/pokemon/:idOrName lists it in `forms`, plus its species.',
                tags: ['Pokémon']
            }
        }
    )
