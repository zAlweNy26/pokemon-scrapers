import { and, count, eq, exists, inArray, notExists, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { Db } from '@/db/client'
import {
    ability, availability, encounter, evolution, form, formAbility, formHomeGame, formType, generation, pokedexEntry,
    pokemon, pokemonDexNumber, pokemonEggGroup, pokemonOrigin, type Pokemon
} from '@/db/schema'
import { categoriesOf, nameColumns, nameProjection, namesOf } from '@/api/names'
import { spritesFor } from '@/api/sprites'

export interface ListFilters {
    gen?: number
    type?: string
    region?: string
    depositable?: boolean
    homeGame?: string
    ability?: string
    hiddenAbility?: string
    eggGroup?: string
    obtainableIn?: string
    legendary?: boolean
    mythical?: boolean
    baby?: boolean
    color?: string
    shape?: string
    habitat?: string
    growthRate?: string
    ids?: number[]
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

    // A version group (`scarlet-violet`), as HOME publishes it; any form counts.
    if (filters.homeGame !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${formHomeGame} INNER JOIN ${form} AS hf ON hf.id = ${formHomeGame.formId}
                     WHERE hf.ndex = ${pokemon.ndex} AND ${formHomeGame.game} = ${filters.homeGame} COLLATE NOCASE)`
            )
        )

    if (filters.ability !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${formAbility} INNER JOIN ${form} AS af ON af.id = ${formAbility.formId}
                     WHERE af.ndex = ${pokemon.ndex} AND ${formAbility.ability} = ${filters.ability} COLLATE NOCASE)`
            )
        )

    if (filters.hiddenAbility !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${formAbility} INNER JOIN ${form} AS af ON af.id = ${formAbility.formId}
                     WHERE af.ndex = ${pokemon.ndex} AND ${formAbility.isHidden} = 1
                     AND ${formAbility.ability} = ${filters.hiddenAbility} COLLATE NOCASE)`
            )
        )

    if (filters.eggGroup !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${pokemonEggGroup} WHERE ${pokemonEggGroup.ndex} = ${pokemon.ndex}
                     AND ${pokemonEggGroup.eggGroup} = ${filters.eggGroup} COLLATE NOCASE)`
            )
        )

    // A version (`scarlet`), not a version group: availability is recorded per game.
    if (filters.obtainableIn !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${availability} WHERE ${availability.ndex} = ${pokemon.ndex}
                     AND ${availability.game} = ${filters.obtainableIn} COLLATE NOCASE AND ${availability.obtainable} = 1)`
            )
        )

    if (filters.legendary !== undefined) conditions.push(eq(pokemon.isLegendary, filters.legendary))
    if (filters.mythical !== undefined) conditions.push(eq(pokemon.isMythical, filters.mythical))
    if (filters.baby !== undefined) conditions.push(eq(pokemon.isBaby, filters.baby))

    if (filters.color !== undefined) conditions.push(sql`${pokemon.color} = ${filters.color} COLLATE NOCASE`)
    if (filters.shape !== undefined) conditions.push(sql`${pokemon.shape} = ${filters.shape} COLLATE NOCASE`)
    if (filters.habitat !== undefined) conditions.push(sql`${pokemon.habitat} = ${filters.habitat} COLLATE NOCASE`)
    if (filters.growthRate !== undefined)
        conditions.push(sql`${pokemon.growthRate} = ${filters.growthRate} COLLATE NOCASE`)

    // One bound parameter, not one per id: D1 refuses a statement with more than 100.
    if (filters.ids !== undefined)
        conditions.push(sql`${pokemon.ndex} IN (SELECT value FROM json_each(${JSON.stringify(filters.ids)}))`)

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

const evolvesFrom = alias(pokemon, 'evolves_from')
const evolvesInto = alias(pokemon, 'evolves_into')
const fromForm = alias(form, 'from_form')
const intoForm = alias(form, 'into_form')

/**
 * The full document in one round trip. Eleven statements are cheaper batched than
 * awaited in sequence, and this is the endpoint most likely to miss the cache.
 */
export const detail = async (db: Db, species: Pokemon, imageBaseUrl: string) => {
    const { ndex } = species

    const [
        forms, typeRows, abilityRows, homeRows, eggGroups, origins, encounters, dexNumbers, evolutions, entries, places
    ] = await db.batch([
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
                slug: ability.slug,
                ...nameColumns(ability),
                isHidden: formAbility.isHidden
            })
            .from(formAbility)
            .innerJoin(form, eq(form.id, formAbility.formId))
            // Inner join is safe: the build fails if an ability has no name row.
            .innerJoin(ability, eq(ability.slug, formAbility.ability))
            .where(eq(form.ndex, ndex))
            .orderBy(formAbility.formId, formAbility.slot),
        db
            .select({ formId: formHomeGame.formId, game: formHomeGame.game })
            .from(formHomeGame)
            .innerJoin(form, eq(form.id, formHomeGame.formId))
            .where(eq(form.ndex, ndex))
            .orderBy(formHomeGame.formId, formHomeGame.game),
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
            .orderBy(encounter.game, encounter.location),
        db
            .select({ pokedex: pokemonDexNumber.pokedex, number: pokemonDexNumber.number })
            .from(pokemonDexNumber)
            .where(eq(pokemonDexNumber.ndex, ndex))
            .orderBy(pokemonDexNumber.pokedex),
        // The whole family, so a client can draw the tree from any member. The slugs
        // are renamed because D1 batches return rows keyed by column name: four
        // columns all called `slug` would collapse into one.
        db
            .select({
                from: sql<string>`${evolvesFrom.slug}`.as('from_slug'),
                into: sql<string>`${evolvesInto.slug}`.as('into_slug'),
                fromForm: sql<string | null>`${fromForm.slug}`.as('from_form_slug'),
                intoForm: sql<string | null>`${intoForm.slug}`.as('into_form_slug'),
                trigger: evolution.trigger,
                game: evolution.game,
                isDefault: evolution.isDefault,
                conditions: evolution.conditions
            })
            .from(evolution)
            .innerJoin(evolvesFrom, eq(evolvesFrom.ndex, evolution.fromNdex))
            .innerJoin(evolvesInto, eq(evolvesInto.ndex, evolution.ndex))
            .leftJoin(fromForm, eq(fromForm.id, evolution.fromFormId))
            .leftJoin(intoForm, eq(intoForm.id, evolution.intoFormId))
            .where(eq(evolvesInto.evolutionChain, species.evolutionChain))
            .orderBy(evolution.id),
        // rowid is Bulbapedia's order: oldest game first, each form after the species.
        db
            .select({ game: pokedexEntry.game, form: pokedexEntry.form, text: pokedexEntry.text })
            .from(pokedexEntry)
            .where(eq(pokedexEntry.ndex, ndex))
            .orderBy(sql`rowid`),
        db
            .select({
                game: availability.game,
                dlc: availability.dlc,
                area: availability.area,
                obtainable: availability.obtainable
            })
            .from(availability)
            .where(eq(availability.ndex, ndex))
            .orderBy(sql`rowid`)
    ])

    const types = groupBy(typeRows, (row) => row.formId, (row) => row.type)

    const homeGames = groupBy(homeRows, (row) => row.formId, (row) => row.game)

    const abilities = groupBy(
        abilityRows,
        (row) => row.formId,
        (row) => ({ slug: row.slug, name: namesOf(row), hidden: row.isHidden })
    )

    return {
        ndex: species.ndex,
        slug: species.slug,
        generation: species.gen,
        category: categoriesOf(species),
        name: namesOf(species),
        catchRate: species.catchRate,
        baseFriendship: species.baseFriendship,
        genderRate: species.genderRate,
        eggCycles: species.eggCycles,
        isLegendary: species.isLegendary,
        isMythical: species.isMythical,
        isBaby: species.isBaby,
        hasGenderDifferences: species.hasGenderDifferences,
        formsSwitchable: species.formsSwitchable,
        growthRate: species.growthRate,
        color: species.color,
        shape: species.shape,
        habitat: species.habitat,
        dexNumbers: Object.fromEntries(dexNumbers.map((row) => [row.pokedex, row.number])),
        evolutionChain: { id: species.evolutionChain, steps: evolutions },
        eggGroups: eggGroups.map((row) => row.eggGroup),
        origins: Object.fromEntries(origins.map((row) => [row.lang, row.note])),
        depositable: forms.some((entry) => entry.depositable),
        forms: forms.map((entry) => ({
            slug: entry.slug,
            name: namesOf(entry),
            isDefault: entry.isDefault,
            depositable: entry.depositable,
            homeGames: homeGames.get(entry.id) ?? [],
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
            // The build writes all six or none.
            evYield:
                entry.evHp === null
                    ? null
                    : {
                          hp: entry.evHp,
                          atk: entry.evAtk!,
                          def: entry.evDef!,
                          spAtk: entry.evSpAtk!,
                          spDef: entry.evSpDef!,
                          spd: entry.evSpd!
                      },
            baseExperience: entry.baseExperience,
            sprites: spritesFor(imageBaseUrl, entry.spriteKey)
        })),
        // '' is the stored "none" for these key columns; the API says null.
        pokedexEntries: entries.map((row) => ({ game: row.game, form: row.form || null, text: row.text })),
        availability: places.map((row) => ({
            game: row.game,
            dlc: row.dlc || null,
            area: row.area,
            obtainable: row.obtainable
        })),
        encounters: encounters.map((row) => ({
            game: row.game,
            location: row.location,
            method: row.method
        }))
    }
}
