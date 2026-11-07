import type { FormInfo } from './build'
import { plain } from './wikitext'
import type { ShinyStatus } from '@/db/schema'

export const SHINY_PAGE = 'List of unobtainable Shiny Pokémon'

export interface ShinyCell {
    status: ShinyStatus
    /** The games the cell names ("USUM; PE"), as the page abbreviates them; null for the whole generation. */
    games: string | null
}

export interface ShinyRow {
    /** The name cell as a reader sees it: "Articuno; Galarian Form", "Cosplay Pikachu". */
    name: string
    /** Index 0 is Generation I; null where the page says nothing (grey: the form did not exist yet). */
    generations: (ShinyCell | null)[]
}

const MARKERS: [string, ShinyStatus][] = [['{{yes}}', 'obtainable'], ['~', 'event'], ['{{no}}', 'unobtainable']]

/** Cell text → cells, a `colspan=N style=... |` prefix spanning N generations. */
const cellsOf = (cell: string): (ShinyCell | null)[] => {
    const attributes = /^\s*((?:colspan=(\d+)\s*)?style="[^"]*")\s*\|(.*)$/s.exec(cell)
    const span = Number(attributes?.[2] ?? 1)
    const content = (attributes ? attributes[3]! : cell).trim()
    if (!content) return Array(span).fill(null)

    const marker = MARKERS.find(([text]) => content.startsWith(text))
    if (!marker) throw new Error(`${SHINY_PAGE}: unknown cell "${content}" - layout changed?`)
    const games = plain(content.slice(marker[0].length)).replace(/^;\s*/, '') || null
    return Array(span).fill({ status: marker[1], games })
}

/**
 * The page's table, one row per species or form. Its first column covers
 * Generations I and II together, so it is repeated for both: eight columns
 * become nine generations. Throws when a row does not add up to eight, past
 * trailing grey padding.
 */
export const shinyTableOf = (wikitext: string): ShinyRow[] => {
    const start = wikitext.indexOf('{| class="roundy sortable"')
    if (start < 0) throw new Error(`${SHINY_PAGE}: no table - layout changed?`)
    const table = wikitext.slice(start, wikitext.indexOf('\n|}', start)).replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')

    return table.split(/\n\|-[^\n]*/).flatMap((chunk) => {
        const lines = chunk.split('\n').filter((line) => line.startsWith('|') && !line.startsWith('|}'))
        if (lines.length < 3) return [] // header rows are `!` lines
        const name = plain(lines[1]!.slice(1))
        const cells = lines.slice(2).flatMap((line) => line.slice(1).split('||')).flatMap(cellsOf)
        // Grey padding past the eighth column is a slip of the page (the Partner rows span 11): dropped.
        if (cells.slice(8).every((cell) => cell === null)) cells.length = Math.min(cells.length, 8)
        if (cells.length !== 8) throw new Error(`${SHINY_PAGE}: "${name}" has ${cells.length} generations, not 8`)
        return [{ name, generations: [cells[0]!, ...cells] }]
    })
}

/** Rows whose name cell is not "Species" or "Species; Form name": the forms they stand for, by slug. */
const GROUPS: Record<string, (slug: string) => boolean> = {
    'Cosplay Pikachu': (slug) => /^pikachu-(cosplay|rock-star|belle|pop-star|phd|libre)$/.test(slug),
    'Pikachu in a cap; (excluding Partner Cap)': (slug) => /^pikachu-.+-cap$/.test(slug) && slug !== 'pikachu-partner-cap',
    'Partner Pikachu': (slug) => slug === 'pikachu-starter',
    'Partner Eevee': (slug) => slug === 'eevee-starter',
    'Spiky-eared Pichu': (slug) => slug === 'pichu-spiky-eared',
    'Greninja; Battle Bond': (slug) => slug === 'greninja-battle-bond',
    'Vivillon; All Patterns; (excluding Fancy & Poké Ball)': (slug) =>
        slug.startsWith('vivillon') && slug !== 'vivillon-fancy' && slug !== 'vivillon-poke-ball',
    'Melmetal; Gigantamax': (slug) => slug === 'melmetal-gmax'
}

/**
 * `[formId, generation, status, games]` for every form the table covers. A row
 * names its form by English form name ("Galarian Form") or through GROUPS; a bare
 * species row covers every form of the species no other row names (all of
 * Arceus's plates, Melmetal but not Gigantamax Melmetal). `unresolved` lists rows
 * that match no form: the build fails on them, like unmatched Serebii entries.
 */
export const shinyRowsOf = (table: ShinyRow[], forms: FormInfo[]) => {
    const claimed = new Map<number, ShinyRow>()
    const unresolved: string[] = []
    const bare: [ShinyRow, FormInfo[]][] = []

    for (const row of table) {
        const [species, label] = row.name.split('; ', 2)
        const ofSpecies = forms.filter((form) => form.speciesName === species)
        const group = GROUPS[row.name]

        if (!group && label === undefined) {
            if (ofSpecies.length) bare.push([row, ofSpecies])
            else unresolved.push(row.name)
            continue
        }

        const matched = group
            ? forms.filter((form) => group(form.slug))
            : ofSpecies.filter((form) => form.formName?.toLowerCase() === label!.toLowerCase())
        if (!matched.length) unresolved.push(row.name)
        for (const form of matched) claimed.set(form.id, row)
    }
    for (const [row, ofSpecies] of bare)
        for (const form of ofSpecies) if (!claimed.has(form.id)) claimed.set(form.id, row)

    const rows: [number, number, ShinyStatus, string | null][] = []
    for (const [formId, row] of claimed)
        row.generations.forEach((cell, index) => {
            if (cell) rows.push([formId, index + 1, cell.status, cell.games])
        })
    return { rows: rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]), unresolved }
}
