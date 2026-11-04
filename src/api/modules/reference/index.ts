import { Elysia } from 'elysia'
import { db } from '@/api/env'
import { sharedModels } from '@/api/models'
import { referenceModels } from './model'
import * as service from './service'

/**
 * No route takes input, so 429 is the only failure a client can provoke -
 * every /v1 route inherits the global limiter.
 */
export const reference = new Elysia({ name: 'module.reference' })
    .use(sharedModels)
    .model(referenceModels)
    .get('/generations', () => service.generations(db()), {
        response: { 200: 'reference.generations', 429: 'problem' },
        detail: { summary: 'List generations', tags: ['Reference'] }
    })
    .get('/types', () => service.types(db()), {
        response: { 200: 'reference.types', 429: 'problem' },
        detail: { summary: 'List types with their names and species counts', tags: ['Reference'] }
    })
    .get('/abilities', () => service.abilities(db()), {
        response: { 200: 'reference.abilities', 429: 'problem' },
        detail: { summary: 'List abilities with their names', tags: ['Reference'] }
    })
    .get('/moves', () => service.moves(db()), {
        response: { 200: 'reference.moves', 429: 'problem' },
        detail: { summary: 'List moves with their names', tags: ['Reference'] }
    })
