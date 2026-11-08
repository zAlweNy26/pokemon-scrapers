import { plain, section, templateAt } from './wikitext'

/** Where a Bulbapedia game label lands: a PokéAPI version, and the DLC when it is one. */
export interface Game {
    game: string
    dlc: string | null
}

/**
 * DLCs, which Bulbapedia lists as games of their own, bundled differently from
 * PokéAPI (one "Expansion Pass" for The Isle of Armor and The Crown Tundra).
 */
const DLCS: Record<string, Game[]> = {
    'Expansion Pass': [{ game: 'sword', dlc: 'expansion-pass' }, { game: 'shield', dlc: 'expansion-pass' }],
    'Sword Expansion Pass': [{ game: 'sword', dlc: 'expansion-pass' }],
    'Shield Expansion Pass': [{ game: 'shield', dlc: 'expansion-pass' }],
    'The Hidden Treasure of Area Zero': [
        { game: 'scarlet', dlc: 'the-hidden-treasure-of-area-zero' },
        { game: 'violet', dlc: 'the-hidden-treasure-of-area-zero' }
    ],
    'The Hidden Treasure of Area Zero (Scarlet)': [{ game: 'scarlet', dlc: 'the-hidden-treasure-of-area-zero' }],
    'The Hidden Treasure of Area Zero (Violet)': [{ game: 'violet', dlc: 'the-hidden-treasure-of-area-zero' }],
    'Mega Dimension': [{ game: 'legends-za', dlc: 'mega-dimension' }]
}

/**
 * A Bulbapedia version label as PokéAPI version identifiers: "Let's Go Pikachu" →
 * `lets-go-pikachu`, "Blue" with `ex=(Japan)` → `blue-japan`. Labels that are not
 * a PokéAPI version (Stadium, Shuffle, Pal Park, ...) give nothing.
 */
export const gamesOf = (label: string, ex: string | undefined, versions: Set<string>): Game[] => {
    if (DLCS[label]) return DLCS[label]
    const slug =
        label === 'Legends: Z-A'
            ? 'legends-za'
            : label.toLowerCase().replace(/[':,!.]/g, '').replace(/\s+/g, '-') + (ex === '(Japan)' ? '-japan' : '')
    return versions.has(slug) ? [{ game: slug, dlc: null }] : []
}

/** Every `{{prefix...}}` in `text`, in order, with its parameters. */
const templates = (text: string, prefix: string) =>
    [...text.matchAll(new RegExp(`\\{\\{${prefix.replace('/', '\\/')}`, 'g'))].map((match) => templateAt(text, match.index))

const labelsOf = (named: Record<string, string>) =>
    ['v', 'v2', 'v3', 'v4'].map((key) => named[key]).filter((label): label is string => !!label)

export interface Parsed<Row> {
    rows: Row[]
    /** Labels that are not a main-series game, for the build to report. */
    skipped: Set<string>
}

/** Generations I-III print names in capitals, which Bulbapedia marks `<sc>`; "é" stays small ("POKéMON"). */
const capitals = (text: string) => text.toUpperCase().replace(/É/g, 'é')

/**
 * An entry's wikitext as `label`'s game prints it: of a word the versions sharing
 * the row print differently (`the{{sup/3|R}}/this{{sup/3|S}}`), that version's;
 * small capitals as capitals. Still wikitext, for `plain`.
 */
const forVersion = (entry: string, label: string, unknown: Set<string>) => {
    const abbreviation = label.replace(/[^A-Z0-9]/g, '') // "HeartGold" → "HG", the {{sup}} label
    return (
        entry
            // shortcut: the first alternative is one word (true of every entry today); a phrase would lose all but its last word.
            .replace(/([^\s/{}]+)\{\{sup\/\d\|(\w+)\}\}\/([^/{}]+?)\{\{sup\/\d\|(\w+)\}\}/g, (_, a: string, x: string, b: string, y: string) => {
                if (x === abbreviation) return a
                if (y === abbreviation) return b
                throw new Error(`Pokédex entry: no ${label} text among "${a}" (${x}) and "${b}" (${y})`)
            })
            .replace(/\{\{ScPkmn\}\}/gi, '<sc>Pok</sc>é<sc>mon</sc>')
            .replace(/\{\{ScBall\}\}/gi, '<sc>Pok</sc>é <sc>Ball</sc>')
            .replace(/<sc>([\s\S]*?)<\/sc>/g, (_, inner: string) => capitals(plain(inner, unknown)))
    )
}

/**
 * The texts stacked in one entry, latest last: Bulbapedia stacks a game's revisions
 * with `<br>` and a note (`<small>''(Version 1.0)''</small>`). The notes are
 * Bulbapedia's, not the game's, and a "(Japanese)" text is Bulbapedia's translation:
 * both are dropped.
 */
const textsOf = (entry: string, unknown: Set<string>) =>
    entry.split(/<br\s*\/?>/i).flatMap((part) => {
        const note = /<small>''\(([^)]*)\)''<\/small>/.exec(part)?.[1] ?? ''
        if (note === 'Japanese') return []
        const revision = /Version (\d+\.\d+)/.exec(note)?.[1] ?? null
        return [{ revision, text: plain(part.replace(/<small>[\s\S]*?<\/small>/g, ''), unknown) }]
    })

/**
 * Bulbapedia folds forms whose entries differ by one word into one row: "Hoenn Cap,
 * Sinnoh Cap, and Alola Cap" with "the Hoenn/Sinnoh/Alola region". Unfolded, each
 * form gets its own word back; any other row stays as it is.
 */
export const unfold = (form: string, text: string): [string, string][] => {
    const forms = form.split(/,\s*(?:and\s+)?|\s+and\s+/)
    const run = /[^\s/.,;]+(?:\/[^\s/.,;]+)+/.exec(text)?.[0]
    const words = run?.split('/')
    if (forms.length < 2 || words?.length !== forms.length) return [[form, text]]
    return forms.map((one, index) => [one, text.replace(run!, words[index]!)])
}

export interface DexEntries extends Parsed<[string, string, string]> {
    /** `[form, game, revision, text]`: a game's texts before its latest revision ("1.0"). */
    revisions: [string, string, string, string][]
}

/** `[form, game, text]`: the species' Pokédex entries, in each game's own words; form is '' for the species itself. */
export const dexEntriesOf = (wikitext: string, versions: Set<string>, unknown: Set<string>): DexEntries => {
    const result: DexEntries = { rows: [], skipped: new Set(), revisions: [] }
    const body = section(wikitext, 'Pokédex entries')
    if (!body) return result

    let form = ''
    for (const { name, positional, named } of templates(body, 'Dex/')) {
        // Each generation's table starts with the species; {{Dex/Form|Alolan Form}} switches.
        if (name.startsWith('Dex/Gen')) form = ''
        else if (name === 'Dex/Form') form = plain(positional[0] ?? '', unknown)
        else if (/^Dex\/Entry\d$/.test(name) && named.entry)
            for (const label of labelsOf(named)) {
                const games = gamesOf(label, named.ex, versions)
                if (!games.length) result.skipped.add(label)
                for (const { game } of games) {
                    const texts = textsOf(forVersion(named.entry, label, unknown), unknown)
                    for (const [one, text] of unfold(form, texts.at(-1)!.text)) result.rows.push([one, game, text])
                    for (const { revision, text } of texts.slice(0, -1)) {
                        if (!revision) throw new Error(`Pokédex entry: ${label} has a second text with no version note: "${text}"`)
                        result.revisions.push([form, game, revision, text])
                    }
                }
            }
    }
    return result
}

/**
 * `[game, dlc, area, obtainable]` from "Game locations": `area` as a reader sees
 * it, with Bulbapedia's form notes ("(Alolan Form)") kept in the text. A grey
 * `/None` row means the game cannot obtain it on its own; its area, when given,
 * says how it gets in ("Trade, Event").
 */
export const availabilityOf = (
    wikitext: string,
    versions: Set<string>,
    unknown: Set<string>
): Parsed<[string, string, string | null, boolean]> => {
    const result: Parsed<[string, string, string | null, boolean]> = { rows: [], skipped: new Set() }
    const body = section(wikitext, 'Game locations')
    if (!body) return result

    // A page occasionally lists a game twice (Volbeat's White: a swarm, then breeding).
    // Two ways to obtain it are both kept; an obtainable row beats a grey one.
    const byGame = new Map<string, [string, string, string | null, boolean]>()
    for (const { name, named } of templates(body, 'Availability/Entry')) {
        // "Trade<sup>Version 1.2.0+</sup>" reads "Trade (Version 1.2.0+)", not "TradeVersion".
        const area = (named.area ? plain(named.area.replace(/<sup>([\s\S]*?)<\/sup>/g, ' ($1)'), unknown) : '') || null
        const obtainable = !name.endsWith('/None')
        for (const label of labelsOf(named)) {
            const games = gamesOf(label, named.ex, versions)
            if (!games.length) result.skipped.add(label)
            for (const { game, dlc } of games) {
                const key = `${game}|${dlc}`
                const seen = byGame.get(key)
                if (!seen || (obtainable && !seen[3])) byGame.set(key, [game, dlc ?? '', area, obtainable])
                else if (obtainable === seen[3] && area && area !== seen[2])
                    seen[2] = seen[2] ? `${seen[2]}; ${area}` : area
            }
        }
    }
    result.rows = [...byGame.values()]
    return result
}

/**
 * `${ndex}|${game}` for every version exclusive: the species can be obtained in
 * that version on its own (any DLC included) and in no other version of its group,
 * as Scarlet against Violet. `siblings` maps a version to the rest of its group;
 * a version alone in its group (Legends: Arceus) has no exclusives.
 */
export const exclusivesOf = (
    rows: readonly (readonly [number, string, string, string | null, boolean])[],
    siblings: Map<string, string[]>
): Set<string> => {
    const obtainable = new Set(rows.filter((row) => row[4]).map(([ndex, game]) => `${ndex}|${game}`))
    return new Set(
        [...obtainable].filter((key) => {
            const [ndex, game] = key.split('|') as [string, string]
            const others = siblings.get(game) ?? []
            return others.length > 0 && others.every((other) => !obtainable.has(`${ndex}|${other}`))
        })
    )
}

/**
 * The origin mark a Pokémon caught in each version carries, from Bulbapedia's
 * "Origin mark". Generations III-V have none; Generation I and II Pokémon get the
 * Game Boy mark, and FireRed and LeafGreen the Game Boy Advance one, only from the
 * Nintendo Switch releases, the only copies that reach HOME.
 */
export const ORIGIN_MARKS: Record<string, string> = {
    ...Object.fromEntries(
        ['red', 'blue', 'yellow', 'red-japan', 'green-japan', 'blue-japan', 'gold', 'silver', 'crystal'].map((game) => [game, 'game-boy'])
    ),
    firered: 'game-boy-advance', leafgreen: 'game-boy-advance',
    x: 'pentagon', y: 'pentagon', 'omega-ruby': 'pentagon', 'alpha-sapphire': 'pentagon',
    sun: 'alola', moon: 'alola', 'ultra-sun': 'alola', 'ultra-moon': 'alola',
    'lets-go-pikachu': 'lets-go', 'lets-go-eevee': 'lets-go',
    sword: 'galar', shield: 'galar',
    'brilliant-diamond': 'brilliant-diamond-shining-pearl', 'shining-pearl': 'brilliant-diamond-shining-pearl',
    'legends-arceus': 'legends-arceus',
    scarlet: 'scarlet-violet', violet: 'scarlet-violet',
    'legends-za': 'legends-za'
}
