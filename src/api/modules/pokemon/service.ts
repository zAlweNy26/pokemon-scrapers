import { and, count, eq, exists, inArray, notExists, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import {
    encounter, form, formAbility, formType, generation, pokemon,
    pokemonEggGroup, pokemonOrigin, type Pokemon
} from '@/db/schema'
import { nameProjection, namesOf } from '@/api/names'
import { spritesFor } from '@/api/sprites'

export interface ListFilters {
    gen?: number
    type?: string
    region?: string
    depositable?: boolean
    limit: number
    offset: number
}

/**
 * Exactly what the list projection returns. `detail()` deliberately does not
 * share this: it is handed a whole `pokemon` row by `findSpecies`, so listing
 * columns here for its benefit would only over-select on the hot list query.
 */
const listColumns = {
    ndex: pokemon.ndex,
    slug: pokemon.slug,
    gen: pokemon.gen,
    ...nameProjection
}

/**
 * HOME depositability is species-level everywhere it is published: true when at
 * least one form can enter HOME. One expression, so the filter, list items,
 * search results and the detail document cannot disagree.
 */
const anyDepositable = sql`(SELECT 1 FROM ${form} AS df
    WHERE df.ndex = ${pokemon.ndex} AND df.depositable = 1)`

export const speciesDepositable = exists(anyDepositable).mapWith(Boolean)

/** Rows to a lookup of arrays, preserving the order the query returned them in. */
const groupBy = <Row, Key, Value>(
    rows: Row[],
    keyOf: (row: Row) => Key,
    valueOf: (row: Row) => Value
): Map<Key, Value[]> => {
    const grouped = new Map<Key, Value[]>()

    for (const row of rows) {
        const key = keyOf(row)
        const existing = grouped.get(key)

        if (existing) existing.push(valueOf(row))
        else grouped.set(key, [valueOf(row)])
    }

    return grouped
}

const filterConditions = (filters: ListFilters) => {
    const conditions = []

    if (filters.gen !== undefined) conditions.push(eq(pokemon.gen, filters.gen))

    // Case-insensitive, as callers expect from a name filter. This scans rather
    // than using an index (the indexes are BINARY), which costs nothing at ~1,000 species.
    if (filters.region !== undefined)
        conditions.push(sql`${generation.region} = ${filters.region} COLLATE NOCASE`)

    if (filters.type !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${formType} WHERE ${formType.formId} = ${form.id}
                     AND ${formType.type} = ${filters.type} COLLATE NOCASE)`
            )
        )

    // Asymmetric on purpose: `false` must mean *no* form can enter HOME. Testing
    // `depositable = 0` would match any species that merely has a blocked form -
    // which is most of them, Pikachu included.
    if (filters.depositable !== undefined)
        conditions.push(filters.depositable ? exists(anyDepositable) : notExists(anyDepositable))

    return conditions.length ? and(...conditions) : undefined
}

export const list = async (db: Db, filters: ListFilters, imageBaseUrl: string) => {
    const where = filterConditions(filters)

    const [counted, page] = await db.batch([
        db
            .select({ total: count() })
            .from(pokemon)
            .innerJoin(form, and(eq(form.ndex, pokemon.ndex), eq(form.isDefault, true)))
            .innerJoin(generation, eq(generation.id, pokemon.gen))
            .where(where),
        db
            .select({
                ...listColumns,
                formId: form.id,
                spriteKey: form.spriteKey,
                depositable: speciesDepositable
            })
            .from(pokemon)
            .innerJoin(form, and(eq(form.ndex, pokemon.ndex), eq(form.isDefault, true)))
            .innerJoin(generation, eq(generation.id, pokemon.gen))
            .where(where)
            .orderBy(pokemon.ndex)
            .limit(filters.limit)
            .offset(filters.offset)
    ])

    const types = await typesByForm(db, page.map((row) => row.formId))

    return {
        total: counted[0]?.total ?? 0,
        items: page.map((row) => ({
            ndex: row.ndex,
            slug: row.slug,
            generation: row.gen,
            name: namesOf(row),
            types: types.get(row.formId) ?? [],
            depositable: row.depositable,
            sprites: spritesFor(imageBaseUrl, row.spriteKey)
        }))
    }
}

/** Types for a set of forms, grouped by form id and ordered by slot. */
const typesByForm = async (db: Db, formIds: number[]) => {
    if (!formIds.length) return new Map<number, string[]>()

    const rows = await db
        .select({ formId: formType.formId, type: formType.type })
        .from(formType)
        .where(inArray(formType.formId, formIds))
        .orderBy(formType.formId, formType.slot)

    return groupBy(rows, (row) => row.formId, (row) => row.type)
}

/** Accepts a National Dex number, a slug, or an English name - case-insensitively. */
export const findSpecies = async (db: Db, idOrName: string): Promise<Pokemon | undefined> => {
    const asNumber = Number(idOrName)

    const where =
        Number.isInteger(asNumber) && asNumber > 0
            ? eq(pokemon.ndex, asNumber)
            : sql`(${pokemon.slug} = ${idOrName} COLLATE NOCASE
                   OR ${pokemon.nameEn} = ${idOrName} COLLATE NOCASE)`

    const [row] = await db.select().from(pokemon).where(where).limit(1)

    return row
}

/**
 * The full document in one round trip. Six statements are cheaper batched than
 * awaited in sequence, and this is the endpoint most likely to miss the cache.
 */
export const detail = async (db: Db, species: Pokemon, imageBaseUrl: string) => {
    const { ndex } = species

    const [forms, typeRows, abilityRows, eggGroups, origins, encounters] = await db.batch([
        db.select().from(form).where(eq(form.ndex, ndex)).orderBy(sql`${form.isDefault} DESC`, form.id),
        db
            .select({ formId: formType.formId, slot: formType.slot, type: formType.type })
            .from(formType)
            .innerJoin(form, eq(form.id, formType.formId))
            .where(eq(form.ndex, ndex))
            .orderBy(formType.formId, formType.slot),
        db
            .select({
                formId: formAbility.formId,
                ability: formAbility.ability,
                isHidden: formAbility.isHidden
            })
            .from(formAbility)
            .innerJoin(form, eq(form.id, formAbility.formId))
            .where(eq(form.ndex, ndex))
            .orderBy(formAbility.formId, formAbility.slot),
        db
            .select({ eggGroup: pokemonEggGroup.eggGroup })
            .from(pokemonEggGroup)
            .where(eq(pokemonEggGroup.ndex, ndex))
            .orderBy(pokemonEggGroup.eggGroup),
        db
            .select({ lang: pokemonOrigin.lang, note: pokemonOrigin.note })
            .from(pokemonOrigin)
            .where(eq(pokemonOrigin.ndex, ndex))
            .orderBy(pokemonOrigin.lang),
        db
            .select({
                game: encounter.game,
                location: encounter.location,
                method: encounter.method
            })
            .from(encounter)
            .where(eq(encounter.ndex, ndex))
            .orderBy(encounter.game, encounter.location)
    ])

    const types = groupBy(typeRows, (row) => row.formId, (row) => row.type)

    const abilities = groupBy(
        abilityRows,
        (row) => row.formId,
        (row) => ({ name: row.ability, hidden: row.isHidden })
    )

    return {
        ndex: species.ndex,
        slug: species.slug,
        generation: species.gen,
        category: species.category,
        name: namesOf(species),
        catchRate: species.catchRate,
        baseFriendship: species.baseFriendship,
        genderRate: species.genderRate,
        eggCycles: species.eggCycles,
        eggGroups: eggGroups.map((row) => row.eggGroup),
        origins: Object.fromEntries(origins.map((row) => [row.lang, row.note])),
        depositable: forms.some((entry) => entry.depositable),
        forms: forms.map((entry) => ({
            slug: entry.slug,
            name: entry.nameEn,
            isDefault: entry.isDefault,
            depositable: entry.depositable,
            types: types.get(entry.id) ?? [],
            abilities: abilities.get(entry.id) ?? [],
            height: entry.heightM,
            weight: entry.weightKg,
            stats: {
                hp: entry.hp,
                atk: entry.atk,
                def: entry.def,
                spAtk: entry.spAtk,
                spDef: entry.spDef,
                spd: entry.spd
            },
            sprites: spritesFor(imageBaseUrl, entry.spriteKey)
        })),
        encounters: encounters.map((row) => ({
            game: row.game,
            location: row.location,
            method: row.method
        }))
    }
}
