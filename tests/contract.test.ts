import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { handleRequest } from '@/api/handler'
import { setLogSink } from '@/api/log'
import { createTestEnv } from './support/database'

/**
 * The OpenAPI document is the published contract, and it is generated - so it can
 * regress silently. These assertions pin the things that broke unnoticed while
 * building this: query parameters vanishing from the spec when an input schema is
 * registered as a named model, and paths acquiring a trailing slash.
 */
let env: Awaited<ReturnType<typeof createTestEnv>>
let spec: any

beforeAll(async () => {
    env = await createTestEnv()
    setLogSink(() => {})

    const response = await handleRequest(
        new Request('http://homedex.test/openapi.json'),
        env
    )
    spec = await response.json()
})

afterAll(() => env.close())

describe('openapi document', () => {
    test('publishes exactly the documented endpoints, without trailing slashes', () => {
        expect(Object.keys(spec.paths).sort()).toEqual([
            '/v1/abilities',
            '/v1/abilities/{slug}',
            '/v1/egg-groups',
            '/v1/evolution-chains/{ndex}',
            '/v1/forms',
            '/v1/forms/{slug}',
            '/v1/games',
            '/v1/games/{slug}',
            '/v1/generations',
            '/v1/home-games',
            '/v1/meta',
            '/v1/moves',
            '/v1/moves/{slug}',
            '/v1/pokedexes',
            '/v1/pokedexes/{slug}',
            '/v1/pokemon',
            '/v1/pokemon/{idOrName}',
            '/v1/search',
            '/v1/types',
            '/v1/types/{slug}'
        ])
    })

    test('documents the evolution chain, type and ability pages', () => {
        const cases = [
            ['/v1/evolution-chains/{ndex}', ['path:ndex'], 'EvolutionChain'],
            ['/v1/types/{slug}', ['path:slug', 'query:limit', 'query:offset'], 'Type'],
            ['/v1/abilities/{slug}', ['path:slug', 'query:limit', 'query:offset'], 'Ability']
        ] as const

        for (const [path, parameters, model] of cases) {
            const operation = spec.paths[path].get

            expect(operation.parameters.map((p: any) => `${p.in}:${p.name}`).sort()).toEqual([...parameters])
            expect(Object.keys(operation.responses).sort()).toEqual(['200', '404', '422', '429'])
            expect(operation.responses['200'].content['application/json'].schema.$ref).toBe(
                `#/components/schemas/${model}`
            )
        }
    })

    test('documents the Pokédex page parameters', () => {
        const operation = spec.paths['/v1/pokedexes/{slug}'].get

        expect(operation.parameters.map((p: any) => `${p.in}:${p.name}`).sort()).toEqual([
            'path:slug', 'query:limit', 'query:offset'
        ])
        expect(Object.keys(operation.responses).sort()).toEqual(['200', '404', '422', '429'])
        expect(operation.responses['200'].content['application/json'].schema.$ref).toBe(
            '#/components/schemas/Pokedex'
        )
    })

    test('documents the form filters and the form detail', () => {
        const list = spec.paths['/v1/forms'].get
        const detail = spec.paths['/v1/forms/{slug}'].get

        expect(list.parameters.map((p: any) => p.name).sort()).toEqual([
            'category', 'depositable', 'gen', 'homeGame', 'isDefault', 'limit', 'offset', 'type'
        ])
        expect(list.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/FormList')
        expect(Object.keys(detail.responses).sort()).toEqual(['200', '404', '422', '429'])
        expect(detail.responses['200'].content['application/json'].schema.$ref).toBe(
            '#/components/schemas/Form'
        )
    })

    test('keeps /health out of the public contract', () => {
        expect(spec.paths['/health']).toBeUndefined()
    })

    test('documents every list filter as a query parameter', () => {
        const names = spec.paths['/v1/pokemon'].get.parameters.map((p: any) => p.name)

        expect(names.sort()).toEqual([
            'ability', 'depositable', 'eggGroup', 'exclusiveTo', 'gen', 'habitat', 'homeGame', 'limit', 'obtainableIn', 'offset',
            'pokedex', 'region', 'sort', 'type'
        ])
    })

    test('enumerates every sort, each with its descending form', () => {
        const sort = spec.paths['/v1/pokemon'].get.parameters.find((p: any) => p.name === 'sort')

        expect(sort.schema).toMatchObject({ type: 'string', default: 'ndex' })
        expect(sort.schema.enum).toHaveLength(22)
        expect(sort.schema.enum).toContain('-bst')
    })

    test('describes the boolean filter as the strings a client actually sends', () => {
        const depositable = spec.paths['/v1/pokemon'].get.parameters.find(
            (p: any) => p.name === 'depositable'
        )

        expect(depositable.schema).toMatchObject({ type: 'string', enum: ['true', 'false'] })
    })

    test('advertises page-size and query-length caps', () => {
        const limit = spec.paths['/v1/pokemon'].get.parameters.find((p: any) => p.name === 'limit')
        const q = spec.paths['/v1/search'].get.parameters.find((p: any) => p.name === 'q')

        expect(limit.schema).toMatchObject({ maximum: 100, default: 20 })
        expect(q.schema).toMatchObject({ minLength: 2, maxLength: 64 })
    })

    test('reuses named component schemas rather than inlining them', () => {
        const ref = (path: string, status: string) =>
            spec.paths[path].get.responses[status].content['application/json'].schema.$ref

        expect(ref('/v1/pokemon', '200')).toBe('#/components/schemas/PokemonList')
        expect(ref('/v1/pokemon/{idOrName}', '200')).toBe('#/components/schemas/Pokemon')
        expect(ref('/v1/pokemon/{idOrName}', '404')).toBe('#/components/schemas/Problem')
    })

    test('documents the failures a client has to handle, on every route', () => {
        const operations = Object.entries(spec.paths).map(
            ([path, item]: [string, any]) => [path, Object.keys(item.get.responses)] as const
        )

        // Every /v1 route inherits the global limiter, so every one of them can
        // answer 429 - and a contract that only mentions the happy path invites
        // clients to treat a rate-limited response as a parse error.
        for (const [path, statuses] of operations)
            expect(statuses, `${path} should document 429`).toContain('429')

        expect(Object.keys(spec.paths['/v1/search'].get.responses).sort()).toEqual([
            '200',
            '422',
            '429'
        ])
        expect(Object.keys(spec.paths['/v1/pokemon/{idOrName}'].get.responses).sort()).toEqual([
            '200',
            '404',
            '422',
            '429'
        ])
        // No input to reject, so 422 would be a promise the route cannot keep.
        expect(Object.keys(spec.paths['/v1/types'].get.responses)).not.toContain('422')
    })

    test('renders every failure as the one shared problem schema', () => {
        // The media type is read rather than asserted: @elysiajs/openapi always
        // emits `application/json`, while the errors plugin sends
        // `application/problem+json` on the wire. The plugin exposes no document
        // transform, so that gap cannot be closed here - and pinning
        // `application/json` as correct would quietly bless it.
        const failures = Object.values(spec.paths).flatMap((item: any) =>
            Object.entries(item.get.responses)
                .filter(([status]) => status !== '200')
                .map(([, response]: [string, any]) => Object.values(response.content)[0] as any)
                .map((media) => media.schema.$ref)
        )

        expect(failures.length).toBeGreaterThan(0)
        expect([...new Set(failures)]).toEqual(['#/components/schemas/Problem'])
    })

    test('states the licence, since the data carries obligations', () => {
        expect(spec.info.license.name).toBe('CC BY-NC-SA 2.5')
        expect(spec.info.description).toContain('Non-commercial')
    })
})
