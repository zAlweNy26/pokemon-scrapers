import { readCorpus, renderTexts, type CorpusFile, type CorpusGame, type Texts } from './corpus'
import { LANGUAGES, type Language } from './pokeapi'

/**
 * Pokédex entries in every language each game shows them in, from Poké Corpus (CLAUDE.md,
 * "Game text only"). Where each game keeps them was matched by comparing every source's English
 * with Bulbapedia's transcriptions per game (2026-11-10): each listed source agreed on 98-100%.
 */
export interface DexEntry {
    ndex: number
    /** HOME's English label for the form ("Alolan Form"); '' for the species. */
    form: string
    game: string
    texts: Texts
}

/** HOME's entry sections (`zukan_comment_x`) → PokéAPI versions. HOME shows each game's entries in all its languages. */
const HOME_SECTIONS: Record<string, string[]> = {
    fr: ['firered'],
    lg: ['leafgreen'],
    x: ['x'],
    y: ['y'],
    omega: ['omega-ruby'],
    alpha: ['alpha-sapphire'],
    sun: ['sun'],
    moon: ['moon'],
    ultrasun: ['ultra-sun'],
    ultramoon: ['ultra-moon'],
    letsgo: ['lets-go-pikachu', 'lets-go-eevee'],
    sword: ['sword'],
    shield: ['shield'],
    brilliantdiamond: ['brilliant-diamond'],
    shiningpearl: ['shining-pearl'],
    arceus: ['legends-arceus'],
    scarlet: ['scarlet'],
    violet: ['violet'],
    za: ['legends-za']
}

/**
 * Generation IV-V keep one numbered message file per version, a line per National Dex number up
 * to the generation's last species; Black 2/White 2's lines after it are forms.
 */
const NUMBERED: [CorpusGame, string, string, number, string[]][] = [
    ['DiamondPearl', 'msg', 'dp.615', 493, ['diamond']],
    ['DiamondPearl', 'msg', 'dp.616', 493, ['pearl']],
    // Platinum also carries Diamond's and Pearl's entries (698-700); 706 is its own.
    ['Platinum', 'msg', 'pt.706', 493, ['platinum']],
    ['HeartGoldSoulSilver', 'msg', 'hgss.803', 493, ['heartgold']],
    ['HeartGoldSoulSilver', 'msg', 'hgss.804', 493, ['soulsilver']],
    ['BlackWhite', 'common', 'bw.common.236', 649, ['black']],
    ['BlackWhite', 'common', 'bw.common.235', 649, ['white']],
    ['Black2White2', 'common', 'b2w2.common.442', 649, ['black-2', 'white-2']]
]

/** Generation I-III label each entry with the species' name; Ruby/Sapphire splits it over two pages. */
const NAMED: [CorpusGame, string, RegExp, string[]][] = [
    ['RedBlue', 'msg', /^rb\.dex_text\.(\w+)DexEntry$/, ['red', 'blue']],
    ['Yellow', 'msg', /^y\.dex_text\.(\w+)DexEntry$/, ['yellow']],
    ['GoldSilver', 'msg', /^gs\.dex_entries_gold\.(\w+)PokedexEntry$/, ['gold']],
    ['GoldSilver', 'msg', /^gs\.dex_entries_silver\.(\w+)PokedexEntry$/, ['silver']],
    ['Crystal', 'msg', /^c\.dex_entries\.(\w+)PokedexEntry$/, ['crystal']],
    ['RubySapphire', 'msg', /^rs\.common\.pokedex_entries\^R\.DexDescription_(\w+)_1$/, ['ruby']],
    ['RubySapphire', 'msg', /^rs\.common\.pokedex_entries\^S\.DexDescription_(\w+)_1$/, ['sapphire']],
    ['Emerald', 'msg', /^e\.common\.pokedex_text\.g(\w+)PokedexText$/, ['emerald']]
]

/**
 * Game Boy text substitutes a word for some characters ("#" prints "POKé", Japanese `<NO>` "の　").
 * Each game file holds those words on fixed lines (1-based), as Poké Corpus's own corpus.json lists them.
 */
const GB_LITERALS: Partial<Record<CorpusGame, Record<string, number>>> = {
    RedBlue: { '#': 6, '<TM>': 2, '<TRAINER>': 3, '<PC>': 4, '<ROCKET>': 5, '<GA>': 9, '<PKMN>': 9 },
    Yellow: { '#': 6, '<TM>': 2, '<TRAINER>': 3, '<PC>': 4, '<ROCKET>': 5, '<GA>': 9, '<PKMN>': 9 },
    GoldSilver: {
        '#': 7, '<TM>': 3, '<TRAINER>': 4, '<PC>': 5, '<ROCKET>': 6, '<KOUGEKI>': 8, '<GA>': 12, '<PKMN>': 12,
        '<WA>': 13, '<POKE>': 13, '<NO>': 14, '<WO>': 15, '<NI>': 16, '<TTE>': 17, '<WATASHI>': 19
    },
    Crystal: {
        '#': 7, '<TM>': 3, '<TRAINER>': 4, '<PC>': 5, '<ROCKET>': 6, '<KOUGEKI>': 8, '<GA>': 12, '<PKMN>': 12,
        '<WA>': 13, '<POKE>': 13, '<NO>': 14, '<WO>': 15, '<NI>': 16, '<TTE>': 17, '<WATASHI>': 19
    }
}

/**
 * Game Boy text as plain text with `\n` breaks: words for its literals, the text box codes as
 * breaks, `<DEXEND>` as the full stop it prints, and the two-tile PK/MN and PO/KE as letters.
 */
export const gameBoyText = (raw: string, language: Language, literals: Map<string, string>) => {
    let text = raw.replace('{text_start}', '')
    for (const [token, word] of literals) text = text.replaceAll(token, word)
    return text
        .replaceAll('<PK><MN>', 'PKMN')
        .replaceAll('<PO><KE>', 'POKE')
        .replaceAll('<.>', '.')
        .replaceAll('<DEXEND>', language === 'ja' ? '。' : '.')
        .replace(/<(NEXT|LINE|PAGE|PARA|CONT|LF)>|@/g, '\\n')
        .replace(/(\\n)+$/, '')
}

/**
 * Game Boy text boxes are narrow, so a long word is split with a hyphen at a line's end
 * ("sun-" / "light"), while a compound can also break at its own hyphen ("whitish-" / "blue").
 * The games' own text tells them apart: a compound is written hyphenated more often than whole,
 * counted first in the Game Boy games (spelling changed since: "hot-headed" is later "hotheaded"),
 * then in every game. Where neither form is written anywhere, two halves that are words of their
 * own make a compound ("iceberg-" / "filled"); anything else is a split word ("prod-" / "ding") and
 * loses its hyphen (a soft hyphen, which `render` drops).
 */
export const unsplitWords = (text: string, vocabularies: Map<string, number>[]) =>
    text.replace(/(\p{L}+)- *\\n *(\p{L}+)/gu, (all, before: string, after: string) => {
        for (const words of vocabularies) {
            const hyphenated = words.get(`${before}-${after}`.toLowerCase()) ?? 0
            const joined = words.get(`${before}${after}`.toLowerCase()) ?? 0
            if (hyphenated !== joined) return hyphenated > joined ? all : `${before}\u00ad\\n${after}`
        }
        const everywhere = vocabularies.at(-1)!
        const isWord = (part: string) => everywhere.has(part.toLowerCase())
        return isWord(before) && isWord(after) ? all : `${before}\u00ad\\n${after}`
    })

/** A line break in any game's markup: Game Boy codes, `\n`-style escapes, a Game Boy terminator. */
const BREAK = /<[A-Z_]+>|\\[nlprc]|@/g

/**
 * How often each word of some files appears per language, as their lines spell it: markup is not a
 * word, and neither half of a word split over two lines is. Pooled over every file read, since one
 * game's text is too small a vocabulary.
 */
const wordsOf = (files: CorpusFile[]) => {
    const result = new Map<Language, Map<string, number>>(LANGUAGES.map((language) => [language, new Map()]))
    for (const file of files)
        for (const label of file.labels)
            for (const [language, text] of Object.entries(file.get(label)!) as [Language, string | null][]) {
                const counts = result.get(language)!
                const plain = text
                    ?.replace(/\{[^}]*\}/g, ' ')
                    .replace(new RegExp(`\\p{L}*-\\s*(?:${BREAK.source})+\\s*\\p{L}*`, 'gu'), ' ')
                    .replace(BREAK, ' ')
                for (const word of plain?.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1)
            }
    return result
}

/** The literal words of a Game Boy file per language, read off its fixed lines. */
const literalsOf = (file: CorpusFile, game: CorpusGame) => {
    const result = new Map<Language, Map<string, string>>(LANGUAGES.map((language) => [language, new Map()]))
    for (const [token, line] of Object.entries(GB_LITERALS[game] ?? {})) {
        const texts = file.get(file.labels[line - 1]!)!
        for (const language of LANGUAGES) {
            const word = texts[language]
            if (word && word !== '[NULL]') result.get(language)!.set(token, word.replaceAll('@', ''))
        }
    }
    return result
}

/** A label's species name ("NidoranF", "MrMime", "HoOh") in the same shape as a PokéAPI slug's letters. */
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Every entry of every game, by species. `speciesSlugs` maps a National Dex number to its
 * PokéAPI slug; `formLabel` HOME's English label for a species' numbered form.
 */
export const dexEntriesFromCorpus = async (
    speciesSlugs: Map<number, string>,
    formLabel: (ndex: number, form: number) => string | undefined
): Promise<{ entries: DexEntry[]; unmatched: string[] }> => {
    const entries: DexEntry[] = []
    const unmatched: string[] = []
    const seen = new Set<string>()
    const add = (ndex: number, form: string, games: string[], texts: Texts) => {
        if (!Object.values(texts).some(Boolean)) return
        for (const game of games) {
            // One entry per species, form and game: two forms HOME labels alike would collide.
            const key = `${ndex}|${form}|${game}`
            if (seen.has(key)) {
                unmatched.push(`${game}: #${ndex} "${form}" twice`)
                continue
            }
            seen.add(key)
            entries.push({ ndex, form, game, texts })
        }
    }
    const files = new Map<string, Promise<CorpusFile>>()
    const read = (game: CorpusGame, file: string) => {
        const key = `${game}/${file}`
        if (!files.has(key)) files.set(key, readCorpus(game, file))
        return files.get(key)!
    }

    const home = await read('HOME', 'megaturtle_nx')
    const gameBoyWords = wordsOf(await Promise.all(NAMED.filter(([game]) => GB_LITERALS[game]).map(([game, file]) => read(game, file))))
    const words = wordsOf(
        await Promise.all([...NAMED, ...NUMBERED].map(([game, file]) => read(game, file)).concat(Promise.resolve(home)))
    )

    // Generation I-III: by species name.
    const byName = new Map([...speciesSlugs].map(([ndex, slug]) => [nameKey(slug), ndex]))
    for (const [game, file, pattern, games] of NAMED) {
        const corpus = await read(game, file)
        const literals = literalsOf(corpus, game)
        for (const label of corpus.labels) {
            const name = label.match(pattern)?.[1]
            if (!name) continue
            const ndex = byName.get(nameKey(name))
            if (ndex === undefined) {
                unmatched.push(`${game}: ${name}`)
                continue
            }
            const raw = corpus.get(label)!
            // Ruby/Sapphire's second page, where the entry has one.
            const second = game === 'RubySapphire' ? corpus.get(label.replace(/_1$/, '_2')) : undefined
            const texts = Object.fromEntries(
                LANGUAGES.map((language) => {
                    let text = raw[language]
                    if (!text || text === '[NULL]') return [language, null]
                    if (GB_LITERALS[game]) text = unsplitWords(gameBoyText(text, language, literals.get(language)!), [
                            gameBoyWords.get(language)!,
                            words.get(language)!
                        ])
                    const page = second?.[language]
                    if (page && page !== '[NULL]') text = `${text}\\n${page}`
                    return [language, text]
                })
            ) as Texts
            add(ndex, '', games, renderTexts(texts))
        }
    }

    // Generation IV-V: by line number.
    for (const [game, file, prefix, last, games] of NUMBERED) {
        const corpus = await read(game, file)
        for (const label of corpus.labels) {
            if (!label.startsWith(`${prefix}.`)) continue
            const ndex = Number(label.slice(prefix.length + 1))
            if (!(ndex >= 1 && ndex <= last)) continue
            add(ndex, '', games, renderTexts(corpus.get(label)!))
        }
    }

    // HOME: by National Dex number and form index, for every game since FireRed/LeafGreen's it shows.
    // A form gets an entry of its own only where its text is not the species' (HOME repeats it for every Unown).
    const speciesText = new Map<string, string | null>()
    for (const label of home.labels) {
        const match = label.match(/^home\.nx\.zukan_comment_(\w+?)\.ZKN_[A-Z]+_(\d+)_(\d+)$/)
        const games = match && HOME_SECTIONS[match[1]!]
        if (!games) continue
        const ndex = Number(match[2])
        const formIndex = Number(match[3])
        if (!speciesSlugs.has(ndex)) continue
        const form = formIndex === 0 ? '' : formLabel(ndex, formIndex)
        const texts = renderTexts(home.get(label)!)
        const key = `${match[1]}|${ndex}`
        if (formIndex === 0) speciesText.set(key, texts.en)
        else if (texts.en === speciesText.get(key)) continue
        if (form === undefined) {
            unmatched.push(`HOME ${match[1]}: #${ndex} form ${formIndex} has no label`)
            continue
        }
        add(ndex, form, games, texts)
    }
    return { entries, unmatched }
}
