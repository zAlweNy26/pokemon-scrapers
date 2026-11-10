import { getTableColumns } from 'drizzle-orm'
import { ability, pokedexEntry, pokemon, type Pokemon } from '@/db/schema'

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

/** The species category per language, keyed like `Names`. Every language may be missing. */
export const CATEGORY_FIELDS = {
    en: 'categoryEn',
    ja: 'categoryJa',
    de: 'categoryDe',
    fr: 'categoryFr',
    it: 'categoryIt',
    es: 'categoryEs',
    ko: 'categoryKo',
    zh_hans: 'categoryZhHans',
    zh_hant: 'categoryZhHant'
} as const satisfies Record<Language, keyof Pokemon>

export type Categories = { [L in Language]: string | null }

export const categoriesOf = (row: Pokemon): Categories =>
    Object.fromEntries(
        Object.entries(CATEGORY_FIELDS).map(([language, column]) => [language, row[column]])
    ) as Categories

/** The in-game description per language on `ability` and `move`, keyed like `Names`. Every language may be missing. */
export const DESCRIPTION_FIELDS = {
    en: 'descriptionEn',
    ja: 'descriptionJa',
    de: 'descriptionDe',
    fr: 'descriptionFr',
    it: 'descriptionIt',
    es: 'descriptionEs',
    ko: 'descriptionKo',
    zh_hans: 'descriptionZhHans',
    zh_hant: 'descriptionZhHant'
} as const satisfies Record<Language, keyof typeof ability.$inferSelect>

export const descriptionsOf = (row: Record<(typeof DESCRIPTION_FIELDS)[Language], string | null>): Categories =>
    Object.fromEntries(
        Object.entries(DESCRIPTION_FIELDS).map(([language, column]) => [language, row[column]])
    ) as Categories

/** A Pokédex entry's text per language, keyed like `Names`. Null in a language the game never showed it in. */
export const ENTRY_TEXT_FIELDS = {
    en: 'textEn',
    ja: 'textJa',
    de: 'textDe',
    fr: 'textFr',
    it: 'textIt',
    es: 'textEs',
    ko: 'textKo',
    zh_hans: 'textZhHans',
    zh_hant: 'textZhHant'
} as const satisfies Record<Language, keyof typeof pokedexEntry.$inferSelect>

export const entryTextsOf = (row: typeof pokedexEntry.$inferSelect): Categories =>
    Object.fromEntries(
        Object.entries(ENTRY_TEXT_FIELDS).map(([language, column]) => [language, row[column]])
    ) as Categories

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
