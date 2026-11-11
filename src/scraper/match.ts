import type { FormInfo } from './build'
import type { SerebiiEntry } from './serebii'

/**
 * Serebii entries whose label the word matcher cannot resolve, keyed by
 * `${ndex}${code}` - or `${ndex}${code}:${label}` where Serebii reuses an image
 * code - to PokéAPI form identifiers. Add an entry when the build report lists one
 * as unmatched or ambiguous; never make the matcher guess.
 */
const OVERRIDES: Record<string, string[]> = {
    '128-p': ['tauros-paldea-combat-breed'], // the Paldean default breed
    '555-g': ['darmanitan-galar-standard'], // Zen Mode is battle-only
    '676-de': ['furfrou-debutante'], // Serebii spells it "Deputante"
    '774-r': ['minior-red'], // labelled just "Minior", which would match the Meteor Form
    '854-f': ['sinistea-antique'], // "Authentic Form" in the games, "antique" in PokéAPI
    '855-f': ['polteageist-antique'],
    '901-b': ['ursaluna-bloodmoon'],
    '215-h-f': ['sneasel-hisui'], // "Sneasel (Female)": the code, not the label, says Hisuian
    '718:Zygarde Power Construct': ['zygarde-50-power-construct'],
    '718-10:Zygarde Power Construct': ['zygarde-10-power-construct'],
    ...alcremie()
}

/**
 * Alcremie's label names only the cream; the sweet is in Serebii's image code
 * (`-lcstar` is Lemon Cream with a Star Sweet; no sweet means Strawberry).
 */
function alcremie() {
    const creams: Record<string, string> = {
        '': 'vanilla-cream', rc: 'ruby-cream', mac: 'matcha-cream', mic: 'mint-cream', lc: 'lemon-cream',
        sc: 'salted-cream', rs: 'ruby-swirl', cs: 'caramel-swirl', ras: 'rainbow-swirl'
    }
    const sweets = ['', 'berry', 'love', 'star', 'clover', 'flower', 'ribbon']
    const entries: Record<string, string[]> = {}

    for (const [code, cream] of Object.entries(creams))
        for (const sweet of sweets)
            if (code || sweet) entries[`869-${code}${sweet}`] = [`alcremie-${cream}-${sweet || 'strawberry'}-sweet`]

    return entries
}

export type Match =
    | { kind: 'matched'; entry: SerebiiEntry; forms: FormInfo[] }
    | { kind: 'unmatched' | 'ambiguous'; entry: SerebiiEntry; candidates: string[] }

const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        // Unown ! and ? differ only by punctuation, which would otherwise be stripped away.
        .replaceAll('!', ' exclamation ')
        .replaceAll('?', ' question ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const words = (value: string | null) => (value ? normalize(value).split(' ').filter(Boolean) : [])

/** Words of a form's names and identifier, minus the species' own name. */
const formWords = (form: FormInfo) => {
    const species = new Set(words(form.speciesName))
    return [...words(form.pokemonName), ...words(form.formName), ...words(form.slug.replaceAll('-', ' '))].filter(
        (word) => !species.has(word)
    )
}

/**
 * The candidates whose words cover `extras`, closest first; a tie is ambiguous.
 * "Closest" counts the form's words the label leaves unexplained, so "Alolan
 * Marowak" picks `marowak-alola` over `marowak-totem` ("Totem Alolan Marowak").
 * "form" and spelling variants (`alola` for "Alolan") explain nothing either way.
 */
const closest = (extras: string[], candidates: FormInfo[], covers: (form: FormInfo, word: string) => boolean) => {
    const unexplained = (form: FormInfo) =>
        new Set(
            formWords(form).filter(
                (word) => word !== 'form' && !extras.some((extra) => extra.startsWith(word) || word.startsWith(extra))
            )
        ).size

    const hits = candidates
        .filter((form) => extras.every((word) => covers(form, word)))
        .map((form) => ({ form, size: unexplained(form) }))
        .sort((a, b) => a.size - b.size)

    if (hits.length > 1 && hits[0]!.size === hits[1]!.size) return { ambiguous: hits.map((hit) => hit.form.slug) }
    return { form: hits[0]?.form }
}

/**
 * Resolves Serebii's label for a Pokémon or form to PokéAPI forms. Labels are the
 * species name plus words that identify the form ("Vivillon Savanna Pattern"), so
 * those extra words must all appear among a form's own words - exactly first, then
 * as substrings ("Blood Moon" in `bloodmoon`). "(Female)" without a matching form
 * is a gender difference, which PokéAPI does not model as a form: the default form.
 */
export const matchEntry = (entry: SerebiiEntry, forms: FormInfo[]): Match => {
    const candidates = forms.filter((form) => form.ndex === entry.ndex)

    const override = OVERRIDES[`${entry.ndex}${entry.code}:${entry.label}`] ?? OVERRIDES[`${entry.ndex}${entry.code}`]
    if (override) {
        const matched = candidates.filter((form) => override.includes(form.slug))
        if (matched.length !== override.length)
            return { kind: 'unmatched', entry, candidates: override.filter((slug) => !matched.some((f) => f.slug === slug)) }
        return { kind: 'matched', entry, forms: matched }
    }

    const defaultForm = candidates.find((form) => form.isDefault)
    if (!defaultForm) return { kind: 'unmatched', entry, candidates: [] }

    const species = new Set(words(defaultForm.speciesName))
    const extras = words(entry.label).filter((word) => !species.has(word))
    if (!extras.length) return { kind: 'matched', entry, forms: [defaultForm] }

    const exact = closest(extras, candidates, (form, word) => formWords(form).includes(word))
    const result = exact.form || exact.ambiguous ? exact : closest(extras, candidates, (form, word) => formWords(form).join('').includes(word))

    if (result.ambiguous) return { kind: 'ambiguous', entry, candidates: result.ambiguous }
    if (result.form) return { kind: 'matched', entry, forms: [result.form] }

    if (extras.every((word) => word === 'female' || word === 'male'))
        return { kind: 'matched', entry, forms: [defaultForm] }

    return { kind: 'unmatched', entry, candidates: candidates.map((form) => form.slug) }
}
