import { getTableColumns } from 'drizzle-orm'
import { pokemon, type Pokemon } from '../db/schema'

/**
 * The single place the nine game languages are listed.
 *
 * Every other spelling of that list is derived from this map: the Drizzle select
 * projection, the alias list in search's raw FTS5 query, the response type and
 * the row-to-response mapping. Adding a language is one edit here plus the
 * schema column and `namesSchema` - and `namesSchema satisfies z.ZodType<Names>`
 * in src/api/models.ts makes forgetting the latter a compile error rather than a
 * silently missing field.
 *
 * Keys are the response shape (snake_case, as published); values name the column
 * on `pokemon`.
 */
export const NAME_FIELDS = {
    en: 'nameEn',
    ja: 'nameJa',
    ja_romaji: 'nameJaRomaji',
    de: 'nameDe',
    fr: 'nameFr',
    it: 'nameIt',
    es: 'nameEs',
    ko: 'nameKo',
    zh_hans: 'nameZhHans',
    zh_hant: 'nameZhHant'
} as const satisfies Record<string, keyof Pokemon>

type Language = keyof typeof NAME_FIELDS
type NameColumn = (typeof NAME_FIELDS)[Language]

/** Nullability comes straight from the schema: `en` is NOT NULL, the rest are not. */
export type Names = { [L in Language]: Pokemon[(typeof NAME_FIELDS)[L]] }

/** Any row carrying the name columns - the list projection, a whole species row, a search hit. */
export type NameColumns = Pick<Pokemon, NameColumn>

const fields = Object.entries(NAME_FIELDS) as [Language, NameColumn][]

/**
 * Spread into a Drizzle `.select()` to pull every name column under the key the
 * rest of this file expects.
 */
export const nameProjection = Object.fromEntries(
    fields.map(([, column]) => [column, pokemon[column]])
) as { [C in NameColumn]: (typeof pokemon)[C] }

export const namesOf = (row: NameColumns): Names =>
    Object.fromEntries(fields.map(([language, column]) => [language, row[column]])) as Names

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
