import { fetchPage } from './http'

const API = 'https://bulbapedia.bulbagarden.net/w/api.php'

/** MediaWiki's limit for titles in one query from a normal user. */
const BATCH = 50

export interface SpeciesPages {
    /** ndex → the species page's wikitext, in dex order. */
    pages: Map<number, string>
    /** Requested pages Bulbapedia does not have. */
    missing: string[]
    /** Pages whose infobox names a different dex number than the species requested. */
    mismatched: string[]
}

/**
 * Every species' Bulbapedia page, through its API: 50 titles per request (~21
 * requests, ~57 MB in all), `maxlag=5` so the wiki can defer us when busy,
 * cached for 30 days. Etymology, Pokédex entries and game locations all come
 * from these pages, so one download serves all three.
 */
export const fetchSpeciesPages = async (species: { ndex: number; name: string }[]): Promise<SpeciesPages> => {
    const pages = new Map<number, string>()
    const result: SpeciesPages = { pages, missing: [], mismatched: [] }

    for (let start = 0; start < species.length; start += BATCH) {
        const batch = species.slice(start, start + BATCH)
        const ndexByTitle = new Map(batch.map(({ ndex, name }) => [`${name} (Pokémon)`, ndex]))
        let next: Record<string, string> = {}

        do {
            const params = new URLSearchParams({
                action: 'query',
                prop: 'revisions',
                rvprop: 'content',
                rvslots: 'main',
                titles: [...ndexByTitle.keys()].join('|'),
                redirects: '1',
                format: 'json',
                formatversion: '2',
                maxlag: '5',
                ...next
            })
            const { body } = await fetchPage(`${API}?${params}`, { maxAgeDays: 30 })
            const json = JSON.parse(body)
            if (json.error) throw new Error(`Bulbapedia: ${json.error.code} - ${json.error.info}`)

            // Map the titles the wiki answered with back to the ones requested.
            const requestedFor = new Map<string, string>()
            for (const { from, to } of [...(json.query.normalized ?? []), ...(json.query.redirects ?? [])])
                requestedFor.set(to, requestedFor.get(from) ?? from)

            for (const page of json.query.pages) {
                const requested = requestedFor.get(page.title) ?? page.title
                const ndex = ndexByTitle.get(requested)
                if (page.missing || !page.revisions) {
                    result.missing.push(requested)
                    continue
                }
                if (ndex === undefined) continue

                const wikitext: string = page.revisions[0].slots.main.content
                const infobox = Number(/\|\s*ndex\s*=\s*(\d+)/.exec(wikitext)?.[1])
                if (infobox !== ndex) {
                    result.mismatched.push(`${requested} (infobox #${infobox})`)
                    continue
                }

                pages.set(ndex, wikitext)
            }

            next = json.continue ?? {}
        } while (Object.keys(next).length)
    }

    result.pages = new Map([...pages].sort(([a], [b]) => a - b))
    return result
}

/** One page's wikitext through the API, cached for 30 days like the species pages. Throws when the page is gone. */
export const fetchWikitext = async (title: string): Promise<string> => {
    const params = new URLSearchParams({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        titles: title,
        redirects: '1',
        format: 'json',
        formatversion: '2',
        maxlag: '5'
    })
    const json = JSON.parse((await fetchPage(`${API}?${params}`, { maxAgeDays: 30 })).body)
    if (json.error) throw new Error(`Bulbapedia: ${json.error.code} - ${json.error.info}`)
    const page = json.query.pages[0]
    if (!page || page.missing || !page.revisions) throw new Error(`Bulbapedia has no page "${title}"`)
    return page.revisions[0].slots.main.content
}
