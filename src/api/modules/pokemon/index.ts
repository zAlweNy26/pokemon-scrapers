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
            const { total, items } = await service.list(
                db(),
                {
                    gen: query.gen,
                    type: query.type,
                    region: query.region,
                    depositable: query.depositable,
                    homeGame: query.homeGame,
                    ability: query.ability,
                    hiddenAbility: query.hiddenAbility,
                    eggGroup: query.eggGroup,
                    obtainableIn: query.obtainableIn,
                    legendary: query.legendary,
                    mythical: query.mythical,
                    baby: query.baby,
                    color: query.color,
                    shape: query.shape,
                    habitat: query.habitat,
                    growthRate: query.growthRate,
                    ids: query.ids,
                    limit: query.limit,
                    offset: query.offset
                },
                IMAGE_BASE_URL
            )

            return { data: items, meta: { total, limit: query.limit, offset: query.offset } }
        },
        {
            query: listQuery,
            response: { 200: 'pokemon.list', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'List species',
                description:
                    'Slim records for browsing. Filterable by generation, type, region, HOME depositability and HOME game, ' +
                    'ability, egg group, game availability, species flags, color, shape, habitat, growth rate and dex numbers.',
                tags: ['Pokemon']
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
            response: { 200: 'pokemon.detail', 404: 'problem', 422: 'problem', 429: 'problem' },
            detail: {
                summary: 'Get one species in full',
                description: 'Every form, all nine names, etymology and encounter locations in a single document.',
                tags: ['Pokemon']
            }
        }
    )
