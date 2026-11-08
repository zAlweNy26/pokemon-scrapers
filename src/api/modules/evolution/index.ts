import { Elysia } from 'elysia'
import { db } from '@/api/env'
import { sharedModels } from '@/api/models'
import { notFound } from '@/api/problem'
import { chainParams, evolutionModels } from './model'
import * as service from './service'

export const evolution = new Elysia({ name: 'module.evolution', prefix: '/evolution-chains' })
    .use(sharedModels)
    .model(evolutionModels)
    .get(
        '/:ndex',
        async ({ params }) => {
            const found = await service.chain(db(), params.ndex)
            if (!found) throw notFound(`No species has national dex number ${params.ndex}.`)

            return found
        },
        {
            params: chainParams,
            response: { 200: 'evolution.chain', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: "Get a species' evolution chain",
                description: 'The chain the species with this national dex number is in. References to its species, and its steps as /v1/pokemon/:idOrName has them.',
                tags: ['Pokemon']
            }
        }
    )
