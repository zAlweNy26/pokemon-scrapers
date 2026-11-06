import { decodeEntities } from './serebii'

/**
 * The body of the first `== title ==` section at any level, up to the next heading.
 * Headings compare as plain text: `==={{pkmn|games|Game}} locations===` is "Game locations".
 */
export const section = (wikitext: string, title: string): string | null => {
    const heading = [...wikitext.matchAll(/^(=+)\s*(.+?)\s*\1\s*$/gm)].find((match) => plain(match[2]!) === title)
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
    return start < 0 ? null : templateAt(wikitext, start).named
}

/** The template opening at `start` (`{{`): its name, positional and named parameters. */
export const templateAt = (wikitext: string, start: number) => {
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

    const named: Record<string, string> = {}
    const positional: string[] = []
    for (const param of parts.slice(1)) {
        // A name is a plain word; `=` inside links or templates does not make one.
        const match = /^\s*([^=[{|]+?)\s*=([\s\S]*)$/.exec(param)
        if (match) named[match[1]!] = match[2]!.trim()
        else positional.push(param.trim())
    }

    return { name: (parts[0] ?? '').trim(), positional, named }
}

/** Cleanup and layout templates: they render no text. */
const SILENT = new Set([
    'specify', 'reflist', 'left clear', 'clear', '-', 'citation needed', 'cn', 'sic', 'shinystar', 'gameicon'
])

/**
 * Templates rendered by `render` from what they are known to show. Others are
 * reported. Most link templates show their last argument: `{{al|Trainers' School}}`,
 * `{{rf|Galarian}}`, `{{DL|page|text}}`, `{{dwa|Spooky Manor}}`.
 */
const KNOWN = new Set([
    'tt', 'pkmn', 'p', 'wp', 'dl', 'm', 't', 'a', 'i', 'g', 'game', 'game3', 'gen', 'ruby', 'tcg',
    'badge', 'pmin', 'wk', 'j', 'jwp', 'tera', 'rt', 'rtn', 'gdis', 'scpkmn', 'scball', 'pdollar', 'male',
    'female', 'al', 'rf', 'kal', 'ka', 'jo', 'ho', 'sinnoh', 'si', 'pal', 'ga', 'gal', 'hoenn', 'pw', 'dwa',
    'dotw', 'weather', 'type', 'color2', 'pkmn2', 'player', 'obp', 'tm', 'shiny', 'tc', 'status', 'fb',
    'berries', 'steven', 'safari'
])

const render = (inner: string, unknown: Set<string>): string => {
    const [rawName = '', ...args] = inner.split('|')
    const name = rawName.trim().toLowerCase()
    const positional = args.filter((arg) => !/^\s*[a-z0-9_]+\s*=/i.test(arg)).map((arg) => arg.trim())

    // Colour helpers ({{normal color dark}}) only feed styles; version marks
    // ({{sup/t|N}}) are footnotes the text reads fine without.
    if (SILENT.has(name) || / colou?r( dark| light)?$/.test(name) || name.startsWith('sup/') || name.startsWith('locationcolor')) return ''
    if (!KNOWN.has(name)) unknown.add(rawName.trim())

    switch (name) {
        case 'rt': // {{rt|2|Alola}} → "Route 2"
            return `Route ${positional[0] ?? ''}`
        case 'rtn': // the number alone, after "Routes"
        case 'gdis': // {{gdis|Battle Frontier|III}}: the place, not the generation
            return positional[0] ?? ''
        case 'scpkmn':
            return 'Pokémon'
        case 'scball':
            return 'Poké Ball'
        case 'pdollar':
            return '₽'
        case 'male':
            return '♂'
        case 'female':
            return '♀'
        case 'tera': // {{Tera}} is the word itself
            return positional.at(-1) ?? 'Tera'
        case 'pkmn2': // {{pkmn2|wild}} → "wild Pokémon"
            return `${positional[0] ?? ''} Pokémon`
        case 'tm': // {{TM|97|Defog}}
            return `TM${positional[0] ?? ''}${positional[1] ? ` (${positional[1]})` : ''}`
        case 'safari': // {{safari|Johto}}: the Safari Zone of that region
            return 'Safari Zone'
        case 'player':
        case 'shiny':
        case 'berries':
        case 'steven': // words linked to their article: {{Berries}} → "Berries"
            return positional.at(-1) ?? rawName.trim().replace(/^./, (c) => c.toUpperCase())
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
