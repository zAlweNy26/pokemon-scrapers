import { $ } from 'bun'
import { LANGUAGES, type Language } from './pokeapi'

/**
 * Poké Corpus: every game's message files as extracted from the game, in each
 * language it ships - the dataset's source of truth for game text (CLAUDE.md,
 * "Game text only"). Read from a git checkout pinned for reproducible builds.
 */
export const CORPUS_COMMIT = '1df697e384e7d3ef5994c011151e6820f9fd839e'

const REPO = 'https://github.com/abcboy101/poke-corpus.git'
const DIR = new URL('../../.cache/poke-corpus/', import.meta.url).pathname

/** The corpus file for each of our languages, best first: kanji Japanese where the game has it, else its kana. */
const CORPUS_LANGUAGES: Record<Language, string[]> = {
    en: ['en'],
    ja: ['ja', 'ja-Hrkt'],
    de: ['de'],
    fr: ['fr'],
    it: ['it'],
    es: ['es'],
    ko: ['ko'],
    zh_hans: ['zh-Hans'],
    zh_hant: ['zh-Hant']
}

/** The message files the build reads, as `[game folder, file]`. */
export const CORPUS_FILES = [
    ['HOME', 'megaturtle_nx'],
    ['Champions', 'ms'],
    ['RedBlue', 'msg'],
    ['Yellow', 'msg'],
    ['GoldSilver', 'msg'],
    ['Crystal', 'msg'],
    ['RubySapphire', 'msg'],
    ['Emerald', 'msg'],
    ['FireRedLeafGreen', 'msg'],
    ['DiamondPearl', 'msg'],
    ['Platinum', 'msg'],
    ['HeartGoldSoulSilver', 'msg'],
    ['BlackWhite', 'common'],
    ['Black2White2', 'common'],
    ['XY', 'common'],
    ['OmegaRubyAlphaSapphire', 'common'],
    ['SunMoon', 'common'],
    ['UltraSunUltraMoon', 'common'],
    ['LetsGoPikachuLetsGoEevee', 'common'],
    ['SwordShield', 'common'],
    ['BrilliantDiamondShiningPearl', 'message'],
    ['LegendsArceus', 'common'],
    ['ScarletViolet', 'common'],
    ['LegendsZA', 'common']
] as const

export type CorpusGame = (typeof CORPUS_FILES)[number][0]

/** A shallow, sparse, blob-less clone holding only CORPUS_FILES' labels and languages, at CORPUS_COMMIT. */
export const checkoutCorpus = async (): Promise<void> => {
    const prefixes = ['qid', ...new Set(Object.values(CORPUS_LANGUAGES).flat())]
    const patterns = CORPUS_FILES.flatMap(([game, file]) => prefixes.map((prefix) => `/corpus/${game}/${prefix}_${file}.txt`))

    if (!(await Bun.file(`${DIR}.git/HEAD`).exists()))
        await $`git clone --quiet --depth 1 --filter=blob:none --sparse --no-checkout ${REPO} ${DIR}`
    await $`git -C ${DIR} sparse-checkout set --no-cone ${patterns}`

    const head = (await $`git -C ${DIR} rev-parse HEAD`.nothrow().text()).trim()
    if (head !== CORPUS_COMMIT) await $`git -C ${DIR} fetch --quiet --depth 1 origin ${CORPUS_COMMIT}`
    await $`git -C ${DIR} checkout --quiet ${CORPUS_COMMIT}`
}

const lines = async (path: string) => {
    const file = Bun.file(path)
    // Only some files end in a newline; that one is not an empty last message.
    return (await file.exists()) ? (await file.text()).replace(/\n$/, '').split('\n') : null
}

/** One message per language, null where the game has none (a language it never shipped, or an empty line). */
export type Texts = Record<Language, string | null>

export interface CorpusFile {
    /** Every label, in file order. */
    labels: string[]
    /** The raw message per language for `label`, undefined when the file has no such label. */
    get(label: string): Texts | undefined
}

/** Reads one message file of one game: labels from `qid_*`, each language's line at the same position. */
export const readCorpus = async (game: CorpusGame, file: string): Promise<CorpusFile> => {
    const path = (prefix: string) => `${DIR}corpus/${game}/${prefix}_${file}.txt`
    const labels = await lines(path('qid'))
    if (!labels) throw new Error(`Poké Corpus has no ${game}/qid_${file}.txt; run the build to check it out`)

    const columns = Object.fromEntries(
        await Promise.all(
            LANGUAGES.map(async (language) => {
                for (const prefix of CORPUS_LANGUAGES[language]) {
                    const column = await lines(path(prefix))
                    if (!column) continue
                    // Lines pair with labels by position; a file that drifted would mislabel every message after it.
                    if (column.length !== labels.length)
                        throw new Error(`${game}/${prefix}_${file}.txt has ${column.length} lines, its labels ${labels.length}`)
                    return [language, column]
                }
                return [language, null]
            })
        )
    ) as Record<Language, string[] | null>

    const index = new Map(labels.map((label, i) => [label, i]))
    return {
        labels,
        get: (label) => {
            const i = index.get(label)
            if (i === undefined) return undefined
            return Object.fromEntries(LANGUAGES.map((language) => [language, columns[language]?.[i] || null])) as Texts
        }
    }
}

/**
 * What one line break stands for once a message is flattened: a space where the language spaces
 * its words, nothing in Chinese, and in Japanese the full-width space its kana text puts between
 * phrases (nothing in text written without them).
 */
const breakIn = (language: Language, text: string) => {
    if (language === 'zh_hans' || language === 'zh_hant') return ''
    if (language === 'ja') return text.includes('　') ? '　' : ''
    return ' '
}

/**
 * A message as the screen shows it, on one line (CLAUDE.md, "Game text only"): the text box's
 * line and page breaks (`\n`, and Generation III-IV's `\l`, `\p`, `\r`, `\c`) become `breakIn`'s
 * separator, and a word the box split after its hyphen or at a soft hyphen is whole again - unless
 * the hyphen stands for a word left out before "and"/"or" ("Normal- and Fighting-type"). A dash
 * keeps its spaces where it has them (" - "), and an em dash at a break joins its words ("volts—a").
 * Placeholders the game fills at run time (`[~ 12]`, `[VAR …]`) are not text: the message is null.
 */
export const render = (text: string | null, language: Language): string | null => {
    if (!text || /\[(~ |VAR )/.test(text)) return null
    const lines = text.replace(/\\[nlprc]/g, '\n')
    return lines
        .replace(/\u00ad\n/g, '')
        .replace(/ -\n/g, ' - ')
        .replace(/([—–])\n/g, '$1')
        .replace(/(?<!-)-\n(?=(and|or|und|oder) )/g, '- ')
        .replace(/-\n/g, '-')
        .replace(/\n/g, breakIn(language, lines))
        .replace(/\u00ad/g, '')
        .trim()
}

/** `render` for every language of a message. */
export const renderTexts = (texts: Texts): Texts =>
    Object.fromEntries(LANGUAGES.map((language) => [language, render(texts[language], language)])) as Texts
