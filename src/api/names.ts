import { getTableColumns } from 'drizzle-orm'
import { pokemon, type Pokemon } from '@/db/schema'

/**
 * The single place the nine game languages are listed: each response key
 * (snake_case, as published) with the suffix its columns carry (`name_zh_hans`
 * is `nameZhHans`).
 *
 * Every other spelling of that list is derived from this map: the Drizzle select
 * projection, the alias list in search's raw FTS5 query, the response types and
 * the row-to-response mapping. Adding a language is one edit here plus the
 * schema columns and `namesSchema` - and `namesSchema satisfies z.ZodType<Names>`
 * in src/api/models.ts makes forgetting the latter a compile error rather than a
 * silently missing field.
 */
const SUFFIXES = { en: 'En', ja: 'Ja', de: 'De', fr: 'Fr', it: 'It', es: 'Es', ko: 'Ko', zh_hans: 'ZhHans', zh_hant: 'ZhHant' } as const

type Language = keyof typeof SUFFIXES
const languages = Object.keys(SUFFIXES) as Language[]

/** The column of each language for a prefix: `{ en: 'nameEn', ... }` for `name`. */
type ColumnsOf<P extends string> = { [L in Language]: `${P}${(typeof SUFFIXES)[L]}` }

const columnsOf = <P extends string>(prefix: P) =>
    Object.fromEntries(languages.map((language) => [language, `${prefix}${SUFFIXES[language]}`])) as ColumnsOf<P>

export const NAME_FIELDS = columnsOf('name') satisfies Record<Language, keyof Pokemon>

type NameColumn = (typeof NAME_FIELDS)[Language]

/** Nullability comes straight from the schema: `en` is NOT NULL, the rest are not. */
export type Names = { [L in Language]: Pokemon[(typeof NAME_FIELDS)[L]] }

/** Any row carrying the name columns - the list projection, a whole species row, a search hit. */
export type NameColumns = Pick<Pokemon, NameColumn>

const fields = Object.entries(NAME_FIELDS) as [Language, NameColumn][]

/**
 * Spread into a Drizzle `.select()` to pull every name column of `table` (a
 * species, or a localised reference table such as `type`) under the key the
 * rest of this file expects.
 */
export const nameColumns = <T extends Record<NameColumn, unknown>>(table: T) =>
    Object.fromEntries(fields.map(([, column]) => [column, table[column]])) as { [C in NameColumn]: T[C] }

export const nameProjection = nameColumns(pokemon)

/** Also reads a `form` row: its name columns carry the same keys and nullability. */
export const namesOf = (row: NameColumns): Names =>
    Object.fromEntries(fields.map(([language, column]) => [language, row[column]])) as Names

/** A text keyed like `Names` where every language may be missing: a category, a description, a Pokédex entry. */
export type Texts = { [L in Language]: string | null }

/** `row`'s columns with `prefix` keyed by language: `textsOf('category', species)`, `textsOf('text', entry)`. */
export const textsOf = <P extends string>(prefix: P, row: { [C in ColumnsOf<P>[Language]]: string | null }): Texts => {
    const columns = columnsOf(prefix)
    return Object.fromEntries(languages.map((language) => [language, row[columns[language]]])) as Texts
}

/**
 * `p.name_ja AS nameJa, ...` for the one query that cannot use the builder.
 *
 * Interpolated with `sql.raw`, which is safe precisely because nothing here comes
 * from a request: the identifiers are read back off the Drizzle table definition.
 */
export const nameAliases = (table: string) => {
    const columns = getTableColumns(pokemon)

    // Aliased to the column key, not the language key, so a search hit has the
    // same shape as every other row and `namesOf` reads all three identically.
    return fields.map(([, column]) => `${table}.${columns[column].name} AS ${column}`).join(', ')
}

/**
 * Which language actually matched a query - the detail that makes cross-language
 * search legible ("you found Greninja because its German name is Quajutsu").
 * Cheap to compute here and impossible to get from FTS5 without highlight().
 */
export const matchedLanguage = (names: Names, query: string): string | null => {
    const needle = query.toLocaleLowerCase()

    for (const [language, value] of Object.entries(names))
        if (value && value.toLocaleLowerCase().includes(needle)) return language

    return null
}
