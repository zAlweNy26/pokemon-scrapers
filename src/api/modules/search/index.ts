import { Elysia } from 'elysia'
import { db, env } from '@/api/env'
import { sharedModels } from '@/api/models'
import { searchRateLimit } from '@/api/plugins/rate-limit'
import { searchModels, searchQuery } from './model'
import * as service from './service'

/**
 * The one endpoint that can be made to do real work, so it carries its own
 * tighter limiter on top of the global one.
 */
export const search = new Elysia({ name: 'module.search', prefix: '/search' })
    .use(sharedModels)
    .use(searchRateLimit)
    .model(searchModels)
    .get(
        '',
        async ({ query }) => {
            const { IMAGE_BASE_URL } = env()

            // `query.q` is already trimmed by the schema, so what is searched and
            // what is echoed back cannot disagree.
            const data = await service.search(db(), query.q, query.limit, IMAGE_BASE_URL)

            return { data, meta: { count: data.length, limit: query.limit, query: query.q } }
        },
        {
            query: searchQuery,
            response: { 200: 'SearchResults', 304: 'NotModified', 422: 'Problem', 429: 'Problem' },
            detail: {
                operationId: 'searchNames',
                summary: 'Search names',
                description:
                    'Finds a species by any of its names in all nine languages. `matchedIn` reports which language matched, so a German query for "Quaj" explains why it returned Greninja.',
                tags: ['Pokémon']
            }
        }
    )
