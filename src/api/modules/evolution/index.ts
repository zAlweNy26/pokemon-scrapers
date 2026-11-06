import { Elysia } from 'elysia'
import { db, env } from '@/api/env'
import { sharedModels } from '@/api/models'
import { notFound } from '@/api/problem'
import { chainParams, evolutionModels } from './model'
import * as service from './service'

export const evolution = new Elysia({ name: 'module.evolution', prefix: '/evolution-chains' })
    .use(sharedModels)
    .model(evolutionModels)
    .get(
        '/:id',
        async ({ params }) => {
            const found = await service.chain(db(), params.id, env().IMAGE_BASE_URL)
            if (!found) throw notFound(`No evolution chain has id ${params.id}.`)

            return found
        },
        {
            params: chainParams,
            response: { 200: 'evolution.chain', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get one evolution chain',
                description: 'Its species as /v1/pokemon list items, and its steps as /v1/pokemon/:idOrName has them.',
                tags: ['Pokemon']
            }
        }
    )
