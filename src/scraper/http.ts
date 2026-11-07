import { mkdir } from 'node:fs/promises'

/**
 * The only way the scraper talks to a website. Serebii's permission is conditional
 * on not spamming it, and Bulbapedia's robots.txt asks for `Crawl-delay: 5`, so:
 * one request at a time, at least DELAY_MS apart, an identifying User-Agent, an
 * on-disk cache answered with conditional requests, and a hard stop after a few
 * failures instead of retrying forever. Never parallelise this or route it through
 * proxies: being slow is the point.
 */
const USER_AGENT = 'homedex-scraper/0.1 (+https://github.com/zAlweNy26/pokemon-scrapers)'
const DELAY_MS = 5_000
const MAX_ATTEMPTS = 3
/** Serebii sends no ETag or Last-Modified, so a conditional request cannot help: reuse a fresh copy instead. */
const DAY_MS = 24 * 60 * 60 * 1_000
const CACHE_DIR = new URL('../../.cache/http/', import.meta.url).pathname

interface Cached {
    url: string
    etag: string | null
    lastModified: string | null
    fetchedAt: string
}

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const keyOf = (url: string) => new Bun.CryptoHasher('sha256').update(url).digest('hex').slice(0, 32)

/** Seconds from Retry-After (either form), else exponential backoff. */
const backoffMs = (response: Response, attempt: number) => {
    const header = response.headers.get('retry-after')
    const seconds = header ? Number(header) : Number.NaN
    if (Number.isFinite(seconds)) return seconds * 1_000

    const date = header ? Date.parse(header) : Number.NaN
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : DELAY_MS * 2 ** attempt
}

const request = async (url: string, cached: Cached | null): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
        const wait = lastRequestAt + DELAY_MS - Date.now()
        if (wait > 0) await sleep(wait)
        lastRequestAt = Date.now()

        const headers: Record<string, string> = { 'user-agent': USER_AGENT }
        if (cached?.etag) headers['if-none-match'] = cached.etag
        if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified

        const response = await fetch(url, { headers, redirect: 'follow' })
        // MediaWiki answers `maxlag` with a 200 error body and Retry-After: cached, it would fail every build for 30 days.
        const retryable = response.status === 429 || response.status >= 500 || response.headers.has('retry-after')

        if (!retryable) return response
        if (attempt >= MAX_ATTEMPTS)
            throw new Error(`${url}: HTTP ${response.status} after ${attempt} attempts - stopping`)

        await sleep(backoffMs(response, attempt))
    }
}

/**
 * Fetches `url` politely and returns its body decoded with `charset` (Serebii is
 * windows-1252, not UTF-8). A cached copy younger than `maxAgeDays` is used without
 * any request; an older one is revalidated, coming back via a 304 when unchanged.
 */
export const fetchPage = (
    url: string,
    { charset = 'utf-8', maxAgeDays = 1 }: { charset?: 'utf-8' | 'windows-1252'; maxAgeDays?: number } = {}
): Promise<{ body: string; fetchedAt: string }> => {
    const run = async () => {
        await mkdir(CACHE_DIR, { recursive: true })
        const key = keyOf(url)
        const metaFile = Bun.file(`${CACHE_DIR}${key}.json`)
        const bodyFile = Bun.file(`${CACHE_DIR}${key}.body`)
        const cached: Cached | null = (await metaFile.exists()) ? await metaFile.json() : null

        if (cached && (await bodyFile.exists()) && Date.now() - Date.parse(cached.fetchedAt) < maxAgeDays * DAY_MS)
            return { body: new TextDecoder(charset).decode(await bodyFile.arrayBuffer()), fetchedAt: cached.fetchedAt }

        const response = await request(url, cached)

        if (response.status === 304 && cached && (await bodyFile.exists()))
            return { body: new TextDecoder(charset).decode(await bodyFile.arrayBuffer()), fetchedAt: cached.fetchedAt }

        if (!response.ok) throw new Error(`${url}: HTTP ${response.status} - stopping`)

        const bytes = await response.arrayBuffer()
        const fetchedAt = new Date().toISOString()
        await Bun.write(bodyFile, bytes)
        await Bun.write(
            metaFile,
            JSON.stringify({
                url,
                etag: response.headers.get('etag'),
                lastModified: response.headers.get('last-modified'),
                fetchedAt
            } satisfies Cached)
        )

        return { body: new TextDecoder(charset).decode(bytes), fetchedAt }
    }

    // Single flight: every call waits for the previous one, whatever the caller does.
    const result = queue.then(run)
    queue = result.catch(() => {})
    return result
}
