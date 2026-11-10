import { Elysia } from 'elysia'
import { db, env } from '@/api/env'
import type { Db } from '@/db/client'
import { sharedModels } from '@/api/models'
import { notFound } from '@/api/problem'
import { list, pokedex, pokemonRef } from '@/api/modules/pokemon/service'
import { abilityParams, gameParams, moveParams, pageQuery, pokedexParams, referenceModels, typeParams } from './model'
import * as service from './service'

/** One type or ability and a page of references to the species `/v1/pokemon?<filter>=` returns for it. */
const speciesPage =
    <Found extends { slug: string }>(find: (db: Db, slug: string) => Promise<Found | undefined>, filter: 'type' | 'ability') =>
    async ({ params, query }: { params: { slug: string }; query: { limit: number; offset: number } }) => {
        const database = db()
        const [found, { total, items }] = await Promise.all([
            find(database, params.slug),
            list(database, { [filter]: params.slug, ...query }, env().IMAGE_BASE_URL)
        ])
        if (!found) throw notFound(`No ${filter} matches "${params.slug}".`)

        return { ...found, data: items.map(pokemonRef), meta: { total, limit: query.limit, offset: query.offset } }
    }

/**
 * Only the /:slug routes take input, so elsewhere 429 is the only failure a
 * client can provoke - every /v1 route inherits the global limiter.
 */
export const reference = new Elysia({ name: 'module.reference' })
    .use(sharedModels)
    .model(referenceModels)
    .get('/generations', () => service.generations(db()), {
        response: { 200: 'reference.generations', 429: 'problem' },
        detail: {
            summary: 'List generations',
            description: 'Every generation with its games.',
            tags: ['Games']
        }
    })
    .get('/games', () => service.games(db()), {
        response: { 200: 'reference.games', 429: 'problem' },
        detail: {
            summary: 'List games',
            description: 'Every game other endpoints return, DLCs included, with their names, in release order.',
            tags: ['Games']
        }
    })
    .get(
        '/games/:slug',
        async ({ params }) => {
            const found = await service.findGame(db(), params.slug)
            if (!found) throw notFound(`No game matches "${params.slug}".`)

            return found
        },
        {
            params: gameParams,
            response: { 200: 'reference.game', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get a game',
                description: 'The game with its names, generation and DLCs.',
                tags: ['Games']
            }
        }
    )
    .get('/types', () => service.types(db()), {
        response: { 200: 'reference.types', 429: 'problem' },
        detail: {
            summary: 'List types',
            description: 'Every type with its names and species count.',
            tags: ['Traits']
        }
    })
    .get(
        '/types/:slug',
        speciesPage(service.findType, 'type'),
        {
            params: typeParams,
            query: pageQuery,
            response: { 200: 'reference.type', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get a type',
                description: 'The type with references to the species /v1/pokemon?type= returns, so `meta.total` is the count /v1/types reports.',
                tags: ['Traits']
            }
        }
    )
    .get('/abilities', () => service.abilities(db()), {
        response: { 200: 'reference.abilities', 429: 'problem' },
        detail: {
            summary: 'List abilities',
            description: 'Every ability with its names.',
            tags: ['Traits']
        }
    })
    .get(
        '/abilities/:slug',
        speciesPage(service.findAbility, 'ability'),
        {
            params: abilityParams,
            query: pageQuery,
            response: { 200: 'reference.ability', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get an ability',
                description: 'The ability with references to the species /v1/pokemon?ability= returns: any form, hidden or not.',
                tags: ['Traits']
            }
        }
    )
    .get('/moves', () => service.moves(db()), {
        response: { 200: 'reference.moves', 429: 'problem' },
        detail: {
            summary: 'List moves',
            description: 'Every move with its names.',
            tags: ['Traits']
        }
    })
    .get(
        '/moves/:slug',
        async ({ params }) => {
            const found = await service.findMove(db(), params.slug)
            if (!found) throw notFound(`No move matches "${params.slug}".`)

            return found
        },
        {
            params: moveParams,
            response: { 200: 'reference.move', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get a move',
                description: 'The move with its names, description and effect.',
                tags: ['Traits']
            }
        }
    )
    .get('/egg-groups', () => service.eggGroups(db()), {
        response: { 200: 'reference.eggGroups', 429: 'problem' },
        detail: {
            summary: 'List egg groups',
            description: 'Every egg group with its species count.',
            tags: ['Traits']
        }
    })
    .get('/home-games', () => service.homeGames(db()), {
        response: { 200: 'reference.homeGames', 429: 'problem' },
        detail: {
            summary: 'List HOME games',
            description: 'The games HOME moves species into, with species counts. PokéAPI version-group identifiers, as the `homeGame` filter on /v1/pokemon takes them.',
            tags: ['Games']
        }
    })
    .get('/pokedexes', () => service.pokedexes(db()), {
        response: { 200: 'reference.pokedexes', 429: 'problem' },
        detail: {
            summary: 'List Pokédexes',
            description: 'Every regional Pokédex with its species count.',
            tags: ['Games']
        }
    })
    .get(
        '/pokedexes/:slug',
        async ({ params, query }) => {
            const { total, items } = await pokedex(db(), params.slug, query, env().IMAGE_BASE_URL)
            if (!total) throw notFound(`No Pokédex matches "${params.slug}".`)

            return {
                data: items.map((item) => ({ ...pokemonRef(item), number: item.number })),
                meta: { total, limit: query.limit, offset: query.offset }
            }
        },
        {
            params: pokedexParams,
            query: pageQuery,
            response: { 200: 'reference.pokedex', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get a Pokédex',
                description: 'References to the species in this regional Pokédex in regional order, each with its regional number.',
                tags: ['Games']
            }
        }
    )
