import { plain, section, templateParams } from './wikitext'

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
