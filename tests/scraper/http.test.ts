import { afterEach, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { fetchPage } from '@/scraper/http'

const PAGE = `https://homedex.test/maxlag-${crypto.randomUUID()}`
const CACHE = new URL('../../.cache/http/', import.meta.url).pathname
const key = new Bun.CryptoHasher('sha256').update(PAGE).digest('hex').slice(0, 32)
const realFetch = globalThis.fetch

afterEach(async () => {
    globalThis.fetch = realFetch
    await Promise.all([rm(`${CACHE}${key}.json`, { force: true }), rm(`${CACHE}${key}.body`, { force: true })])
})

test(
    'retries a 200 that asks to come back later instead of caching it',
    async () => {
        // MediaWiki's maxlag refusal: status 200, an error body, and Retry-After.
        const replies = [
            new Response('{"error":{"code":"maxlag"}}', { headers: { 'retry-after': '0' } }),
            new Response('{"query":{}}')
        ]
        globalThis.fetch = (async () => replies.shift()!) as unknown as typeof fetch

        expect((await fetchPage(PAGE)).body).toBe('{"query":{}}')
        expect(await Bun.file(`${CACHE}${key}.body`).text()).toBe('{"query":{}}')
    },
    // The fetcher keeps 5 s between requests, retries included.
    15_000
)

test('stops on any other MediaWiki error rather than caching it as the page', async () => {
    globalThis.fetch = (async () =>
        new Response('{"error":{"code":"internal_api_error_DBQueryError"}}', {
            headers: { 'mediawiki-api-error': 'internal_api_error_DBQueryError' }
        })) as unknown as typeof fetch

    await expect(fetchPage(PAGE)).rejects.toThrow('MediaWiki API error internal_api_error_DBQueryError')
    expect(await Bun.file(`${CACHE}${key}.body`).exists()).toBe(false)
}, 15_000)
