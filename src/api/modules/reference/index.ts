import { Elysia } from 'elysia'
import { db, env } from '@/api/env'
import { sharedModels } from '@/api/models'
import { notFound } from '@/api/problem'
import { pokedex } from '@/api/modules/pokemon/service'
import { pageQuery, pokedexParams, referenceModels } from './model'
import * as service from './service'

/**
 * Only /pokedexes/:slug takes input, so elsewhere 429 is the only failure a
 * client can provoke - every /v1 route inherits the global limiter.
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
    .get('/egg-groups', () => service.eggGroups(db()), {
        response: { 200: 'reference.eggGroups', 429: 'problem' },
        detail: { summary: 'List egg groups with species counts', tags: ['Reference'] }
    })
    .get('/home-games', () => service.homeGames(db()), {
        response: { 200: 'reference.homeGames', 429: 'problem' },
        detail: {
            summary: 'List the games HOME moves species into, with species counts',
            description: 'PokéAPI version-group identifiers, as the `homeGame` filter on /v1/pokemon takes them.',
            tags: ['Reference']
        }
    })
    .get('/pokedexes', () => service.pokedexes(db()), {
        response: { 200: 'reference.pokedexes', 429: 'problem' },
        detail: { summary: 'List regional Pokédexes with species counts', tags: ['Reference'] }
    })
    .get(
        '/pokedexes/:slug',
        async ({ params, query }) => {
            const { total, items } = await pokedex(db(), params.slug, query, env().IMAGE_BASE_URL)
            if (!total) throw notFound(`No Pokédex matches "${params.slug}".`)

            return { data: items, meta: { total, limit: query.limit, offset: query.offset } }
        },
        {
            params: pokedexParams,
            query: pageQuery,
            response: { 200: 'reference.pokedex', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'List the species in a regional Pokédex',
                description: 'In regional order, each with its regional number.',
                tags: ['Reference']
            }
        }
    )
