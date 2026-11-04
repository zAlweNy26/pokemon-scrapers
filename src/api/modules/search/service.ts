import { eq, or, sql } from 'drizzle-orm'
import type { Db } from '../../../db/client'
import { form, pokemon } from '../../../db/schema'
import {
    matchedLanguage, nameAliases, nameProjection, namesOf, type NameColumns
} from '../../names'
import { spritesFor } from '../../sprites'

/** Every column the FTS index covers, so the prefix fallback searches the same ground. */
const searchableColumns = [pokemon.slug, ...Object.values(nameProjection)]

/**
 * FTS5 treats bare input as query syntax, where a stray quote or asterisk is a
 * parse error rather than a search term. Wrapping in a quoted string (with inner
 * quotes doubled) makes any user input a literal phrase.
 */
const asPhrase = (query: string) => `"${query.replace(/"/g, '""')}"`

/**
 * The trigram tokenizer cannot index anything shorter than three characters,
 * which would leave two-character Japanese, Korean and Chinese names
 * unsearchable. Those fall back to an indexed prefix scan - over ~1500 rows it
 * costs nothing, and it keeps the feature honest in every language rather than
 * only in Latin script.
 */
export const MIN_TRIGRAM_LENGTH = 3

interface SearchRow extends NameColumns {
    ndex: number
    slug: string
    gen: number
    spriteKey: string | null
    depositable: boolean
}

export const search = async (db: Db, query: string, limit: number, imageBaseUrl: string) => {
    const rows =
        query.length >= MIN_TRIGRAM_LENGTH
            ? await matchFullText(db, query, limit)
            : await matchPrefix(db, query, limit)

    return rows.map((row) => {
        const name = namesOf(row)

        return {
            ndex: row.ndex,
            slug: row.slug,
            generation: row.gen,
            name,
            matchedIn: matchedLanguage(name, query),
            depositable: !!row.depositable,
            sprites: spritesFor(imageBaseUrl, row.spriteKey)
        }
    })
}

/**
 * Raw SQL rather than the query builder: `pokemon_fts` is an FTS5 virtual table,
 * which Drizzle's schema DSL cannot describe, and `MATCH`/`rank` have no builder
 * equivalent. Values are still bound as parameters.
 */
const matchFullText = (db: Db, query: string, limit: number) =>
    db.all<SearchRow>(sql`
        SELECT p.ndex, p.slug, p.gen, f.sprite_key AS spriteKey, f.depositable,
               ${sql.raw(nameAliases('p'))}
        FROM pokemon_fts x
        JOIN pokemon p ON p.ndex = x.rowid
        JOIN form f ON f.ndex = p.ndex AND f.is_default = 1
        WHERE pokemon_fts MATCH ${asPhrase(query)}
        ORDER BY rank
        LIMIT ${limit}
    `)

const matchPrefix = async (db: Db, query: string, limit: number): Promise<SearchRow[]> => {
    // Escaped, not stripped: stripping turned `%%` into the pattern `%`, which matches every row.
    const pattern = `${query.replace(/[\\%_]/g, '\\$&')}%`

    return db
        .select({
            ndex: pokemon.ndex,
            slug: pokemon.slug,
            gen: pokemon.gen,
            spriteKey: form.spriteKey,
            depositable: form.depositable,
            ...nameProjection
        })
        .from(pokemon)
        .innerJoin(form, sql`${form.ndex} = ${pokemon.ndex} AND ${form.isDefault} = 1`)
        .where(or(...searchableColumns.map((column) => sql`${column} LIKE ${pattern} ESCAPE '\\' COLLATE NOCASE`)))
        .orderBy(pokemon.ndex)
        .limit(limit)
}
