import { fetchPage } from './http'
import { plain, section, templateParams } from './wikitext'

const API = 'https://bulbapedia.bulbagarden.net/w/api.php'

/** MediaWiki's limit for titles in one query from a normal user. */
const BATCH = 50

/**
 * Our language keys → the `{{Other languages}}` parameter holding that name's
 * meaning. Mandarin (`zh_cmn`) is one name in two scripts, so both get it.
 * Japanese romaji has no meaning of its own; English comes from "Name origin".
 */
const MEANINGS: Record<string, string> = {
    ja: 'jameaning',
    de: 'demeaning',
    fr: 'frmeaning',
    it: 'itmeaning',
    es: 'esmeaning',
    ko: 'komeaning',
    zh_hans: 'zh_cmnmeaning',
    zh_hant: 'zh_cmnmeaning'
}

export interface Etymology {
    rows: [number, string, string][]
    /** Requested pages Bulbapedia does not have. */
    missing: string[]
    /** Pages whose infobox names a different dex number than the species requested. */
    mismatched: string[]
    /** Templates rendered by guess; add them to src/scraper/wikitext.ts. */
    unknownTemplates: Set<string>
}

/** The species' page wikitext, parsed into origin notes. Pure, for tests. */
export const originsOf = (wikitext: string, unknown: Set<string>): [string, string][] => {
    const notes: [string, string][] = []

    const english = section(wikitext, 'Name origin')
    if (english) notes.push(['en', plain(english, unknown)])

    const languages = templateParams(wikitext, 'Other languages') ?? {}
    for (const [language, parameter] of Object.entries(MEANINGS)) {
        const meaning = languages[parameter]
        if (meaning) notes.push([language, plain(meaning, unknown)])
    }

    return notes.filter(([, note]) => note !== '')
}

/**
 * Name etymology for every species from Bulbapedia's pages, through its API: 50
 * titles per request (~21 requests, ~57 MB in all), `maxlag=5` so the wiki can
 * defer us when busy, cached for 30 days - etymology rarely changes.
 */
export const fetchEtymology = async (species: { ndex: number; name: string }[]): Promise<Etymology> => {
    const result: Etymology = { rows: [], missing: [], mismatched: [], unknownTemplates: new Set() }

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

                for (const [language, note] of originsOf(wikitext, result.unknownTemplates))
                    result.rows.push([ndex, language, note])
            }

            next = json.continue ?? {}
        } while (Object.keys(next).length)
    }

    return result
}
