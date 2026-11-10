import { Elysia } from 'elysia'
import { db, env } from '@/api/env'
import { sharedModels } from '@/api/models'
import { notFound } from '@/api/problem'
import { idOrNameParams, listQuery, pokemonModels } from './model'
import * as service from './service'

export const pokemon = new Elysia({ name: 'module.pokemon', prefix: '/pokemon' })
    .use(sharedModels)
    .model(pokemonModels)
    .get(
        '',
        async ({ query }) => {
            const { IMAGE_BASE_URL } = env()
            // The validated query is the filter set: copying fields here would let a new filter be silently dropped.
            const { total, items } = await service.list(db(), query, IMAGE_BASE_URL)

            return { data: items, meta: { total, limit: query.limit, offset: query.offset } }
        },
        {
            query: listQuery,
            response: { 200: 'PokemonList', 422: 'Problem', 429: 'Problem' },
            detail: {
                summary: 'List Pokémon',
                description:
                    'Slim records for browsing. Filterable by generation, type, region, regional Pokédex, HOME depositability ' +
                    'and HOME game, ability, egg group, game availability and habitat, and sortable by name, stats and size.',
                tags: ['Pokémon']
            }
        }
    )
    .get(
        '/:idOrName',
        async ({ params }) => {
            const { IMAGE_BASE_URL } = env()
            const database = db()

            const species = await service.findSpecies(database, params.idOrName)
            if (!species) throw notFound(`No Pokemon matches "${params.idOrName}".`)

            return service.detail(database, species, IMAGE_BASE_URL)
        },
        {
            params: idOrNameParams,
            response: { 200: 'Pokemon', 404: 'Problem', 422: 'Problem', 429: 'Problem' },
            detail: {
                summary: 'Get a Pokémon',
                description: 'Every form, all nine names, etymology and encounter locations in a single document.',
                tags: ['Pokémon']
            }
        }
    )
