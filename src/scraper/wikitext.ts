import { decodeEntities } from './serebii'

/** The body of the first `== title ==` section at any level, up to the next heading. */
export const section = (wikitext: string, title: string): string | null => {
    const heading = new RegExp(`^(=+)\\s*${title}\\s*\\1\\s*$`, 'm').exec(wikitext)
    if (!heading) return null

    const rest = wikitext.slice(heading.index + heading[0].length)
    const next = /^=+[^=\n].*=+\s*$/m.exec(rest)
    return rest.slice(0, next?.index).trim()
}

/**
 * Named parameters of the first `{{name ...}}`. Splits on `|` only at the
 * template's own level - values contain `{{tt|...}}` and `[[a|b]]` with pipes of
 * their own.
 */
export const templateParams = (wikitext: string, name: string): Record<string, string> | null => {
    const start = wikitext.indexOf(`{{${name}`)
    if (start < 0) return null

    const parts: string[] = []
    let depth = 0
    let part = ''

    for (let i = start; i < wikitext.length; i++) {
        const pair = wikitext.slice(i, i + 2)

        if (pair === '{{' || pair === '[[') {
            depth++
            if (depth > 1) part += pair
            i++
        } else if (pair === '}}' || pair === ']]') {
            depth--
            if (depth === 0) {
                parts.push(part)
                break
            }
            part += pair
            i++
        } else if (wikitext[i] === '|' && depth === 1) {
            parts.push(part)
            part = ''
        } else part += wikitext[i]
    }

    return Object.fromEntries(
        parts
            .slice(1)
            .map((param) => /^\s*([^=]+?)\s*=([\s\S]*)$/.exec(param))
            .filter((match) => match !== null)
            .map((match) => [match[1]!, match[2]!.trim()])
    )
}

/** Cleanup and layout templates: they render no text. */
const SILENT = new Set(['specify', 'reflist', 'left clear', 'clear', '-', 'citation needed', 'cn', 'sic'])

/** Templates rendered by `render` from what they are known to show. Others are reported. */
const KNOWN = new Set([
    'tt', 'pkmn', 'p', 'wp', 'dl', 'm', 't', 'a', 'i', 'g', 'game', 'game3', 'gen', 'ruby', 'tcg',
    'badge', 'pmin', 'wk', 'j', 'jwp', 'tera'
])

const render = (inner: string, unknown: Set<string>): string => {
    const [rawName = '', ...args] = inner.split('|')
    const name = rawName.trim().toLowerCase()
    const positional = args.filter((arg) => !/^\s*[a-z0-9_]+\s*=/i.test(arg)).map((arg) => arg.trim())

    if (SILENT.has(name)) return ''
    if (!KNOWN.has(name)) unknown.add(rawName.trim())

    switch (name) {
        case 'tt': // tooltip: the text, unless it is a footnote marker
            return positional[0] === '*' ? '' : (positional[0] ?? '')
        case 'pkmn': // {{pkmn|battle}} → "Pokémon battle"
            return positional[1] ?? `Pokémon ${positional[0] ?? ''}`
        case 'ruby': // kanji with its reading: the kanji
            return positional[0] ?? ''
        case 'g': // {{g|Bank}}, {{g|Black 2 and White 2|s}} → "Pokémon Bank"; the suffix only pluralises
            return `Pokémon ${positional[0] ?? ''}`
        case 'game': // {{game|Black and White|s|Black}}: the display text, else the game
            return positional[2] ?? `Pokémon ${positional[0] ?? ''}`
        case 'game3': // {{game3|link|display|suffix}}
            return `Pokémon ${positional[1] ?? positional[0] ?? ''}`
        case 'badge':
            return `${positional[0] ?? ''} Badge`
        default: // links and their kin show their last argument
            return positional.at(-1) ?? ''
    }
}

/**
 * Wikitext as the plain text a reader sees. `unknown` collects template names
 * rendered by guess (their last argument), so a build can report them.
 */
export const plain = (wikitext: string, unknown = new Set<string>()): string => {
    let text = wikitext
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<ref[^>]*\/>/g, '')
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
        .replace(/<br\s*\/?>/gi, '; ')

    // Innermost templates first, until none are left.
    for (let previous = ''; previous !== text; ) {
        previous = text
        text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => render(inner, unknown))
    }

    text = text
        .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
        .replace(/\[https?:\/\/[^\]]*\]/g, '')
        .replace(/'{2,}/g, '')
        .replace(/<[^>]+>/g, '')

    return decodeEntities(text)
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:)])/g, '$1')
        .replace(/(;\s*)+$/, '')
        .trim()
}
