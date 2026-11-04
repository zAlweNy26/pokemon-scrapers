import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { handleRequest } from '@/api/handler'
import { setLogSink } from '@/api/log'
import { allowing, createTestEnv } from './support/database'
import type { Env } from '@/api/platform'

/**
 * Exercises the real request path - `handleRequest`, exactly what the Worker
 * entry point calls - against the in-memory database. No port is bound and no
 * workerd is involved, but routing, validation, serialisation, cache headers,
 * error rendering, AsyncLocalStorage and access logging are all the real thing.
 */
let env: Awaited<ReturnType<typeof createTestEnv>>

const call = (path: string, init?: RequestInit, overrides?: Partial<Env>) =>
    handleRequest(new Request(`http://homedex.test${path}`, init), {
        ...env,
        ...overrides
    } as Env)

const json = async (path: string, init?: RequestInit, overrides?: Partial<Env>) => {
    const response = await call(path, init, overrides)
    return { response, body: await response.json() as any }
}

/** Request logs are captured rather than printed, so the report stays readable. */
const logged: string[] = []
const capture = (line: string) => logged.push(line)

beforeAll(async () => {
    env = await createTestEnv()
    setLogSink(capture)
})

afterAll(() => env.close())

describe('GET /health', () => {
    test('reports dataset state and is never cached', async () => {
        const { response, body } = await json('/health')

        expect(response.status).toBe(200)
        expect(body).toEqual({ ok: true, dataVersion: 'test-0001' })
        expect(response.headers.get('cache-control')).toBe('no-store')
    })
})

describe('GET /v1/pokemon', () => {
    test('applies zod defaults for limit and offset', async () => {
        const { body } = await json('/v1/pokemon')

        expect(body.meta).toEqual({ total: 8, limit: 20, offset: 0 })
    })

    test('filters through the query string', async () => {
        const { body } = await json('/v1/pokemon?gen=1&type=Electric')

        expect(body.data.map((p: any) => p.slug)).toEqual(['pikachu', 'raichu'])
    })

    test('parses depositable as a real boolean, not a truthy string', async () => {
        // z.coerce.boolean() would read "false" as true; the enum transform does not.
        expect((await json('/v1/pokemon?depositable=false')).body.meta.total).toBe(0)
        expect((await json('/v1/pokemon?depositable=true')).body.meta.total).toBe(8)
    })

    test('passes the new filters through the query string', async () => {
        const slugs = async (query: string) => (await json(`/v1/pokemon?${query}`)).body.data.map((p: any) => p.slug)

        expect(await slugs('homeGame=legends-arceus')).toEqual(['rotom'])
        expect(await slugs('ability=levitate')).toEqual(['rotom'])
        expect(await slugs('hiddenAbility=protean')).toEqual(['greninja'])
        expect(await slugs('eggGroup=indeterminate')).toEqual(['gengar', 'rotom'])
        expect(await slugs('obtainableIn=scarlet')).toEqual(['pikachu'])
        expect(await slugs('legendary=true&color=green')).toEqual(['ogerpon'])
        expect(await slugs('mythical=false&baby=false&shape=ball')).toEqual(['rotom'])
        expect(await slugs('habitat=sea&growthRate=slow')).toEqual(['lapras'])
        expect(await slugs('ids=658,25,658')).toEqual(['pikachu', 'greninja'])
    })

    test('sorts through the query string, ascending or with - descending', async () => {
        const slugs = async (query: string) => (await json(`/v1/pokemon?${query}`)).body.data.map((p: any) => p.slug)

        expect(await slugs('sort=name&limit=3')).toEqual(['gengar', 'greninja', 'lapras'])
        expect(await slugs('sort=-bst&limit=3')).toEqual(['urshifu', 'ogerpon', 'lapras'])
        expect(await slugs('sort=spAtk&type=water')).toEqual(['lapras', 'greninja'])
    })

    test('rejects a sort it does not know', async () => {
        for (const sort of ['bogus', 'BST', '--bst', '-']) {
            const { response, body } = await json(`/v1/pokemon?sort=${sort}`)

            expect(response.status).toBe(422)
            expect(body.errors[0].property).toBe('sort')
        }
    })

    test('rejects malformed or oversized dex number lists', async () => {
        const tooMany = Array.from({ length: 101 }, (_, i) => i + 1).join(',')

        for (const ids of ['', 'abc', '0', '1,,2', '1.5', '-1', tooMany]) {
            const { response, body } = await json(`/v1/pokemon?ids=${ids}`)

            expect(response.status).toBe(422)
            expect(body.errors[0].property).toStartWith('ids')
        }
    })

    test('accepts a generation the code has never heard of', async () => {
        // A new generation is a data change; it must not need a code deploy to be filterable.
        const { response, body } = await json('/v1/pokemon?gen=10')

        expect(response.status).toBe(200)
        expect(body.data).toEqual([])
    })

    test('labels each validation issue with its own field', async () => {
        const { response, body } = await json('/v1/pokemon?limit=0&offset=-1')

        expect(response.status).toBe(422)
        expect(body.errors.map((issue: { property: string }) => issue.property)).toEqual([
            'limit',
            'offset'
        ])
    })

    test('rejects a page size above the cap', async () => {
        const { response, body } = await json('/v1/pokemon?limit=500')

        expect(response.status).toBe(422)
        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(body.errors[0]).toEqual({
            property: 'limit',
            message: expect.stringContaining('100')
        })
    })
})

describe('GET /v1/pokemon/:idOrName', () => {
    test('resolves by name and returns the full document', async () => {
        const { response, body } = await json('/v1/pokemon/Pikachu')

        expect(response.status).toBe(200)
        expect(body.ndex).toBe(25)
        expect(body.forms).toHaveLength(2)
        expect(body.name.ko).toBe('피카츄')
    })

    test('returns RFC 9457 problem details for an unknown species', async () => {
        const { response, body } = await json('/v1/pokemon/mewthree')

        expect(response.status).toBe(404)
        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(body).toMatchObject({
            type: '/errors/not-found',
            title: 'Not Found',
            status: 404,
            instance: '/v1/pokemon/mewthree'
        })
        expect(response.headers.get('cache-control')).toBe('no-store')
    })

    test('an unmatched route is also problem+json', async () => {
        const { response, body } = await json('/v1/nope')

        expect(response.status).toBe(404)
        expect(body.type).toBe('/errors/not-found')
    })
})

describe('caching', () => {
    test('sets browser and CDN cache policies plus a strong ETag', async () => {
        const { response } = await json('/v1/pokemon/25')

        expect(response.headers.get('cache-control')).toContain('s-maxage=604800')
        expect(response.headers.get('cache-control')).toContain('stale-if-error=86400')
        expect(response.headers.get('cdn-cache-control')).toContain('max-age=604800')
        expect(response.headers.get('vary')).toBe('accept-encoding')
        expect(response.headers.get('etag')).toMatch(/^"test-0001-[0-9a-f]+"$/)
    })

    test('answers a matching If-None-Match with 304', async () => {
        const first = await call('/v1/pokemon/25')
        const etag = first.headers.get('etag')!

        const second = await call('/v1/pokemon/25', { headers: { 'if-none-match': etag } })

        expect(second.status).toBe(304)
        // workerd throws on a 304 that carries a body; Bun does not, so assert it here.
        expect(second.body).toBeNull()
        expect(second.headers.get('etag')).toBe(etag)
    })

    test('compares weakly, as RFC 9110 requires for If-None-Match', async () => {
        // Cloudflare turns a strong ETag weak when it compresses, so browsers send W/ back.
        const etag = (await call('/v1/pokemon/25')).headers.get('etag')!

        for (const header of [`W/${etag}`, `"stale", ${etag}`, '*']) {
            const response = await call('/v1/pokemon/25', { headers: { 'if-none-match': header } })
            expect(response.status).toBe(304)
        }

        const miss = await call('/v1/pokemon/25', { headers: { 'if-none-match': '"stale"' } })
        expect(miss.status).toBe(200)
    })

    test('the ETag varies with the query, so pages cache independently', async () => {
        const a = await call('/v1/pokemon?limit=5')
        const b = await call('/v1/pokemon?limit=6')

        expect(a.headers.get('etag')).not.toBe(b.headers.get('etag'))
    })

    test('the ETag changes when the dataset version changes', async () => {
        const before = await call('/v1/pokemon/25')
        const after = await call('/v1/pokemon/25', undefined, { DATA_VERSION: 'test-0002' })

        expect(after.headers.get('etag')).not.toBe(before.headers.get('etag'))
    })
})

describe('rate limiting', () => {
    test('renders a refusal as problem+json with Retry-After', async () => {
        const { response, body } = await json('/v1/search?q=pika', undefined, {
            RL_SEARCH: allowing(0)
        })

        expect(response.status).toBe(429)
        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(response.headers.get('retry-after')).toBe('60')
        expect(body.type).toBe('/errors/rate-limited')
    })

    test('the search limiter does not apply to other endpoints', async () => {
        const response = await call('/v1/pokemon/25', undefined, { RL_SEARCH: allowing(0) })

        expect(response.status).toBe(200)
    })

    test('the global limiter covers every /v1 route', async () => {
        const response = await call('/v1/generations', undefined, { RL_GLOBAL: allowing(0) })

        expect(response.status).toBe(429)
    })

    test('health is exempt so monitoring never trips the limiter', async () => {
        const response = await call('/health', undefined, {
            RL_GLOBAL: allowing(0),
            RL_SEARCH: allowing(0)
        })

        expect(response.status).toBe(200)
    })
})

describe('GET /v1/search', () => {
    test('reports which language matched', async () => {
        const { body } = await json('/v1/search?q=Quaj')

        expect(body.data[0].slug).toBe('greninja')
        expect(body.data[0].matchedIn).toBe('de')
    })

    test('accepts two-character CJK queries', async () => {
        const { response, body } = await json(`/v1/search?q=${encodeURIComponent('耿鬼')}`)

        expect(response.status).toBe(200)
        expect(body.data[0].slug).toBe('gengar')
    })

    test('rejects a single character and names the property', async () => {
        const { response, body } = await json('/v1/search?q=x')

        expect(response.status).toBe(422)
        expect(body.errors[0].property).toBe('q')
    })

    test('measures the length after trimming, so blank input cannot slip through', async () => {
        // Trimming in the handler instead let '    ' past min(2), drop below the
        // trigram floor, and prefix-scan LIKE '%' - a page of arbitrary species.
        for (const q of ['    ', '  a', '\t\n']) {
            const { response, body } = await json(`/v1/search?q=${encodeURIComponent(q)}`)

            expect(response.status).toBe(422)
            expect(body.errors[0].property).toBe('q')
        }
    })

    test('treats LIKE wildcards in a short query as literal text', async () => {
        // Stripping them instead turned '%%' into the pattern '%', matching every species.
        for (const q of ['%%', '__', '%a']) {
            const { response, body } = await json(`/v1/search?q=${encodeURIComponent(q)}`)

            expect(response.status).toBe(200)
            expect(body.data).toEqual([])
        }
    })

    test('searches the trimmed query and echoes back what it searched', async () => {
        const { body } = await json(`/v1/search?q=${encodeURIComponent(' pika ')}`)

        expect(body.data[0].slug).toBe('pikachu')
        expect(body.meta.query).toBe('pika')
    })

    test('meta.count is rows returned, capped by limit', async () => {
        // 'chu' matches Pikachu and Raichu, so a capped page proves count is not
        // being passed off as a match total.
        expect((await json('/v1/search?q=chu')).body.meta.count).toBe(2)
        expect((await json('/v1/search?q=chu&limit=1')).body.meta.count).toBe(1)
    })
})

describe('HEAD', () => {
    test('answers like the GET it mirrors, without a body', async () => {
        // Elysia has no HEAD routes; before this, every HEAD was a 404.
        const get = await call('/v1/pokemon/25')
        const head = await call('/v1/pokemon/25', { method: 'HEAD' })

        expect(head.status).toBe(200)
        expect(head.body).toBeNull()
        expect(head.headers.get('etag')).toBe(get.headers.get('etag'))
        expect(head.headers.get('content-type')).toBe(get.headers.get('content-type'))
    })

    test('keeps the status of a failure and of a conditional match', async () => {
        const missing = await call('/v1/pokemon/no-such-thing', { method: 'HEAD' })
        expect(missing.status).toBe(404)
        expect(missing.body).toBeNull()

        const etag = (await call('/v1/pokemon/25')).headers.get('etag')!
        const conditional = await call('/v1/pokemon/25', { method: 'HEAD', headers: { 'if-none-match': etag } })
        expect(conditional.status).toBe(304)
    })
})

describe('read replicas', () => {
    test('queries go through a D1 session, so a nearby replica can answer', async () => {
        // A bare binding always reads from the primary.
        const constraints: unknown[] = []
        const binding = env.DB as D1Database & { withSession: (c: unknown) => D1Database }
        const DB = Object.assign(Object.create(binding), {
            withSession: (constraint: unknown) => {
                constraints.push(constraint)
                return binding.withSession(constraint)
            }
        })

        expect((await call('/v1/pokemon/25', undefined, { DB })).status).toBe(200)
        expect(constraints).toEqual(['first-unconstrained'])
    })
})

describe('response hardening', () => {
    test('every response forbids content-type sniffing', async () => {
        // Set at the entry point rather than in an onAfterHandle hook, which
        // never runs for a problem document or for the HTML served at /docs.
        for (const path of ['/v1/pokemon/25', '/v1/nope', '/health', '/docs'])
            expect((await call(path)).headers.get('x-content-type-options')).toBe('nosniff')
    })
})

describe('cross-origin access', () => {
    test('is wildcard, so responses stay cacheable for every origin', async () => {
        const response = await call('/v1/pokemon/25', { headers: { origin: 'https://example.com' } })

        expect(response.headers.get('access-control-allow-origin')).toBe('*')
        expect(response.headers.get('vary')).not.toContain('origin')
    })
})

describe('access logging', () => {
    test('logs a request that fails before the error plugin can see it', async () => {
        logged.length = 0

        // A throwing getter stands in for a binding missing at runtime: it fails
        // inside handleRequest, upstream of Elysia, so nothing turns it into a
        // response. Logging after the await instead of in a `finally` lost the
        // one request most worth having a line for.
        const hostile = Object.defineProperty({ ...env }, 'DB', {
            get: () => {
                throw new Error('binding unavailable')
            }
        }) as Env

        const request = new Request('http://homedex.test/v1/pokemon/25')

        await expect(handleRequest(request, hostile)).rejects.toThrow('binding unavailable')

        expect(logged).toHaveLength(1)
        expect(JSON.parse(logged[0]!)).toMatchObject({ status: 500, path: '/v1/pokemon/25' })
    })

    test('records one structured line per request, including the status', async () => {
        const path = '/v1/pokemon/does-not-exist'
        logged.length = 0

        await call(path)

        // Logged from the entry point, so the line exists as soon as the request
        // resolves - no waiting, and it cannot be lost to a torn-down context.
        expect(logged).toHaveLength(1)
        expect(JSON.parse(logged[0]!)).toMatchObject({
            level: 'info',
            method: 'GET',
            path,
            status: 404
        })
    })
})

describe('reference values for the list filters', () => {
    test('each count is the total its /v1/pokemon filter or Pokédex page reports', async () => {
        const cases = [
            ['/v1/egg-groups', (slug: string) => `/v1/pokemon?eggGroup=${slug}`],
            ['/v1/home-games', (slug: string) => `/v1/pokemon?homeGame=${slug}`],
            ['/v1/pokedexes', (slug: string) => `/v1/pokedexes/${slug}`]
        ] as const

        for (const [path, filtered] of cases) {
            const { response, body } = await json(path)

            expect(response.status).toBe(200)
            expect(body.length).toBeGreaterThan(0)
            for (const { slug, count } of body)
                expect((await json(filtered(slug))).body.meta.total, `${path} ${slug}`).toBe(count)
        }
    })
})

describe('GET /v1/pokedexes/:slug', () => {
    test('lists species in regional order as list items with their regional number', async () => {
        const { response, body } = await json('/v1/pokedexes/KALOS-CENTRAL')

        expect(response.status).toBe(200)
        expect(body.meta).toEqual({ total: 2, limit: 20, offset: 0 })
        expect(body.data.map((p: any) => [p.slug, p.number])).toEqual([['greninja', 9], ['pikachu', 36]])
        expect(Object.keys(body.data[0]).sort()).toEqual(
            ['depositable', 'generation', 'name', 'ndex', 'number', 'slug', 'sprites', 'types']
        )
    })

    test('paginates like /v1/pokemon', async () => {
        const { body } = await json('/v1/pokedexes/kalos-central?limit=1&offset=1')

        expect(body.meta).toEqual({ total: 2, limit: 1, offset: 1 })
        expect(body.data.map((p: any) => p.slug)).toEqual(['pikachu'])
        expect((await json('/v1/pokedexes/kalos-central?limit=500')).response.status).toBe(422)
    })

    test('answers 404 as a problem for a Pokédex no species is in', async () => {
        const { response, body } = await json('/v1/pokedexes/johto')

        expect(response.status).toBe(404)
        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(body).toMatchObject({ status: 404, instance: '/v1/pokedexes/johto' })
    })
})

describe('GET /v1/forms', () => {
    test('applies the /v1/pokemon page defaults and cap', async () => {
        const { body } = await json('/v1/forms')

        expect(body.meta).toEqual({ total: 13, limit: 20, offset: 0 })
        expect((await json('/v1/forms?limit=500')).response.status).toBe(422)
    })

    test('depositable=false finds the blocked form of a species HOME accepts', async () => {
        const { body } = await json('/v1/forms?depositable=false&gen=1')

        expect(body.data.map((f: any) => [f.slug, f.species.slug, f.depositable])).toEqual([
            ['pikachu-partner', 'pikachu', false]
        ])
        expect((await json('/v1/pokemon?depositable=false&gen=1')).body.meta.total).toBe(0)
    })

    test('passes every filter through the query string', async () => {
        const slugs = async (query: string) => (await json(`/v1/forms?${query}`)).body.data.map((f: any) => f.slug)

        expect(await slugs('homeGame=LEGENDS-ARCEUS&type=water')).toEqual(['rotom-wash'])
        expect(await slugs('isDefault=false&gen=8')).toEqual(['urshifu-rapid-strike'])
        expect((await json('/v1/forms?isDefault=maybe')).response.status).toBe(422)
    })

    test('paginates with the unpaginated total', async () => {
        const { body } = await json('/v1/forms?limit=2&offset=11')

        expect(body.meta).toEqual({ total: 13, limit: 2, offset: 11 })
        expect(body.data.map((f: any) => f.slug)).toEqual(['ogerpon-teal', 'ogerpon-hearthflame'])
    })
})

describe('GET /v1/forms/:slug', () => {
    test("is the species document's form, plus its species", async () => {
        const { response, body } = await json('/v1/forms/PIKACHU-PARTNER')
        const { body: species } = await json('/v1/pokemon/pikachu')
        const { species: owner, ...rest } = body

        expect(response.status).toBe(200)
        expect(rest).toEqual(species.forms.find((f: any) => f.slug === 'pikachu-partner'))
        expect(owner).toEqual({ ndex: 25, slug: 'pikachu', name: species.name })
    })

    test('answers 404 as a problem for an unknown form', async () => {
        const { response, body } = await json('/v1/forms/pikachu-cosplay')

        expect(response.status).toBe(404)
        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(body).toMatchObject({ status: 404, instance: '/v1/forms/pikachu-cosplay' })
    })
})

describe('GET /v1/evolution-chains/:id', () => {
    test("lists the chain's species, and the steps a member's detail has", async () => {
        const { response, body } = await json('/v1/evolution-chains/10')
        const { body: raichu } = await json('/v1/pokemon/raichu')

        expect(response.status).toBe(200)
        expect(body.id).toBe(10)
        expect(body.members).toEqual((await json('/v1/pokemon?ids=25,26')).body.data)
        expect(body.steps).toEqual(raichu.evolutionChain.steps)
    })

    test('answers 404 as a problem for a chain no species is in, and 422 for a non-id', async () => {
        const { response, body } = await json('/v1/evolution-chains/9999')

        expect(response.status).toBe(404)
        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(body).toMatchObject({ status: 404, instance: '/v1/evolution-chains/9999' })
        for (const id of ['0', 'pikachu', '1.5']) expect((await json(`/v1/evolution-chains/${id}`)).response.status).toBe(422)
    })
})

describe('GET /v1/types/:slug and /v1/abilities/:slug', () => {
    test('a type with its names and a page of its species, ignoring case', async () => {
        const { response, body } = await json('/v1/types/WATER')

        expect(response.status).toBe(200)
        expect(body.slug).toBe('water')
        expect(body.name).toMatchObject({ en: 'Water', de: 'Wasser' })
        expect(body.meta).toEqual({ total: 2, limit: 20, offset: 0 })
        expect(body.data).toEqual((await json('/v1/pokemon?type=water')).body.data)
    })

    test("each type's total is the count /v1/types reports, unused types included", async () => {
        const { body } = await json('/v1/types')

        for (const { slug, count } of body) {
            const page = await json(`/v1/types/${slug}`)

            expect(page.response.status, slug).toBe(200)
            expect(page.body.meta.total, slug).toBe(count)
        }
    })

    test('an ability with its names and the species with it on any form, hidden or not', async () => {
        const { response, body } = await json('/v1/abilities/Lightning-Rod')

        expect(response.status).toBe(200)
        expect(body.slug).toBe('lightning-rod')
        expect(body.name.en).toBe('Lightning Rod')
        expect(body.data.map((p: any) => p.slug)).toEqual(['pikachu', 'raichu'])
        expect((await json('/v1/abilities/battle-bond')).body.data.map((p: any) => p.slug)).toEqual(['greninja'])
    })

    test('paginates like /v1/pokemon', async () => {
        const { body } = await json('/v1/abilities/lightning-rod?limit=1&offset=1')

        expect(body.meta).toEqual({ total: 2, limit: 1, offset: 1 })
        expect(body.data.map((p: any) => p.slug)).toEqual(['raichu'])
        expect((await json('/v1/types/water?limit=500')).response.status).toBe(422)
        expect((await json('/v1/abilities/static?offset=-1')).response.status).toBe(422)
    })

    test('answers 404 as a problem for a type or ability that does not exist', async () => {
        for (const path of ['/v1/types/sound', '/v1/abilities/wonder-guard']) {
            const { response, body } = await json(path)

            expect(response.status).toBe(404)
            expect(response.headers.get('content-type')).toBe('application/problem+json')
            expect(body).toMatchObject({ status: 404, instance: path })
        }
    })
})

describe('GET /v1/meta', () => {
    test('exposes dataset version, counts and provenance', async () => {
        const { body } = await json('/v1/meta')

        expect(body.dataVersion).toBe('test-0001')
        expect(body.counts).toEqual({ pokemon: 8, forms: 13, encounters: 6 })
        expect(Object.keys(body.sources)).toContain('source_serebii')
        expect(Object.keys(body.sources)).not.toContain('count_pokemon')
    })
})
