import { and, count, countDistinct, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import {
    ability, form, formHomeGame, formType, game, generation, move, pokedex, pokedexGame, pokemon, pokemonDexNumber,
    pokemonEggGroup, type
} from '@/db/schema'
import { nameColumns, namesOf, textsOf, type NameColumns } from '@/api/names'
import { groupBy } from '@/api/modules/pokemon/service'

const named = (rows: ({ slug: string } & NameColumns)[]) => rows.map((row) => ({ slug: row.slug, name: namesOf(row) }))

export const abilities = async (db: Db) =>
    named(await db.select({ slug: ability.slug, ...nameColumns(ability) }).from(ability).orderBy(ability.slug))

export const moves = async (db: Db) =>
    named(await db.select({ slug: move.slug, ...nameColumns(move) }).from(move).orderBy(move.slug))

/**
 * Gen IX index numbers from Bulbapedia's "List of types" (https://bulbapedia.bulbagarden.net/wiki/Type).
 * ??? (`unknown`) and Shadow have none there, so they stay unnumbered.
 */
const TYPE_IDS: Record<string, number> = {
    normal: 0, fighting: 1, flying: 2, poison: 3, ground: 4, rock: 5, bug: 6, ghost: 7, steel: 8,
    fire: 9, water: 10, grass: 11, electric: 12, psychic: 13, ice: 14, dragon: 15, dark: 16, fairy: 17,
    stellar: 99
}

// Slugs are stored lowercase, so lowering the input matches any case and keeps the primary key usable.
export const findType = async (db: Db, slug: string) => {
    const found = named(await db.select().from(type).where(eq(type.slug, slug.toLowerCase())))[0]
    return found && { id: TYPE_IDS[found.slug] ?? null, ...found }
}

const described = (row: typeof ability.$inferSelect) => ({
    ...named([row])[0]!,
    description: textsOf('description', row),
    effect: row.effect
})

export const findAbility = async (db: Db, slug: string) => {
    const [row] = await db.select().from(ability).where(eq(ability.slug, slug.toLowerCase()))
    return row && described(row)
}

export const findMove = async (db: Db, slug: string) => {
    const [row] = await db.select().from(move).where(eq(move.slug, slug.toLowerCase()))
    return row && described(row)
}

export const generations = async (db: Db) => {
    const [rows, games] = await Promise.all([
        db
            .select({
                id: generation.id,
                region: generation.region,
                debut: generation.debut,
                count: count(pokemon.ndex)
            })
            .from(generation)
            .leftJoin(pokemon, eq(pokemon.gen, generation.id))
            .groupBy(generation.id, generation.region, generation.debut)
            .orderBy(generation.id),
        db.select({ generation: game.generation, versionGroup: game.versionGroup, slug: game.slug }).from(game).orderBy(game.sort)
    ])
    const byGeneration = groupBy(games, (row) => row.generation, (row) => row)

    // A version group's versions are adjacent in `sort`, so grouping keeps release order.
    return rows.map((row) => ({
        ...row,
        games: Array.from(
            groupBy(byGeneration.get(row.id) ?? [], (g) => g.versionGroup, (g) => g.slug),
            ([versionGroup, versions]) => ({ versionGroup, versions })
        )
    }))
}

export const games = async (db: Db) => {
    const rows = await db.select().from(game).orderBy(game.sort)
    const dlcs = groupBy(rows.filter((row) => row.baseGame), (row) => row.baseGame, (row) => row.slug)

    return rows.map((row) => ({
        slug: row.slug,
        name: namesOf(row),
        generation: row.generation,
        versionGroup: row.versionGroup,
        baseGame: row.baseGame,
        color: row.color,
        dlcs: dlcs.get(row.slug) ?? []
    }))
}

// shortcut: reads all ~50 games to reuse games()' DLC lookup; query one row if the table grows large.
export const findGame = async (db: Db, slug: string) => (await games(db)).find((g) => g.slug === slug.toLowerCase())

export const types = async (db: Db) => {
    // Every type, unused ones (Stellar) at 0. Counted over default forms only, so a
    // species is not double-counted because one of its alternate forms changed type.
    const rows = await db
        .select({ slug: type.slug, ...nameColumns(type), count: countDistinct(form.ndex) })
        .from(type)
        .leftJoin(formType, eq(formType.type, type.slug))
        .leftJoin(form, and(eq(form.id, formType.formId), eq(form.isDefault, true)))
        .groupBy(type.slug)
        .orderBy(type.slug)

    return rows.map((row) => ({ id: TYPE_IDS[row.slug] ?? null, slug: row.slug, name: namesOf(row), count: row.count }))
}

export const eggGroups = (db: Db) =>
    db
        .select({ slug: pokemonEggGroup.eggGroup, count: count() })
        .from(pokemonEggGroup)
        .groupBy(pokemonEggGroup.eggGroup)
        .orderBy(pokemonEggGroup.eggGroup)

// A species counts once however many of its forms move into the game, as the homeGame filter means it.
export const homeGames = (db: Db) =>
    db
        .select({ slug: formHomeGame.game, count: countDistinct(form.ndex) })
        .from(formHomeGame)
        .innerJoin(form, eq(form.id, formHomeGame.formId))
        .groupBy(formHomeGame.game)
        .orderBy(formHomeGame.game)

/** Every regional Pokédex, or the one `slug` names, with its games in release order and its species count. */
export const pokedexes = async (db: Db, slug?: string) => {
    const where = slug === undefined ? undefined : sql`${pokedex.slug} = ${slug} COLLATE NOCASE`
    const [rows, games] = await Promise.all([
        db
            .select({
                slug: pokedex.slug,
                region: pokedex.region,
                mainSeries: pokedex.mainSeries,
                ...nameColumns(pokedex),
                count: count(pokemonDexNumber.ndex)
            })
            .from(pokedex)
            .leftJoin(pokemonDexNumber, eq(pokemonDexNumber.pokedex, pokedex.slug))
            .where(where)
            .groupBy(pokedex.slug)
            .orderBy(pokedex.slug),
        db
            .select({ pokedex: pokedexGame.pokedex, slug: game.slug })
            .from(pokedexGame)
            .innerJoin(game, eq(game.versionGroup, pokedexGame.versionGroup))
            .orderBy(game.sort)
    ])
    const gamesOf = groupBy(games, (row) => row.pokedex, (row) => row.slug)

    return rows.map((row) => ({
        slug: row.slug,
        name: namesOf(row),
        region: row.region,
        mainSeries: row.mainSeries,
        games: gamesOf.get(row.slug) ?? [],
        count: row.count
    }))
}
