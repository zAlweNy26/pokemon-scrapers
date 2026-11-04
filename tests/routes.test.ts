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

describe('GET /v1/meta', () => {
    test('exposes dataset version, counts and provenance', async () => {
        const { body } = await json('/v1/meta')

        expect(body.dataVersion).toBe('test-0001')
        expect(body.counts).toEqual({ pokemon: 8, forms: 13, encounters: 6 })
        expect(Object.keys(body.sources)).toContain('source_serebii')
        expect(Object.keys(body.sources)).not.toContain('count_pokemon')
    })
})
