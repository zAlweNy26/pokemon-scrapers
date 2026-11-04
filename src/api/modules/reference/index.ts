import { Elysia } from 'elysia'
import { db } from '@/api/env'
import { sharedModels } from '@/api/models'
import { referenceModels } from './model'
import * as service from './service'

/**
 * Neither route takes input, so 429 is the only failure a client can provoke -
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
        detail: { summary: 'List types with species counts', tags: ['Reference'] }
    })
