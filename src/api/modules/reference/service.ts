import { and, count, countDistinct, eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import {
    ability, form, formHomeGame, formType, generation, move, pokemon, pokemonDexNumber, pokemonEggGroup, type
} from '@/db/schema'
import { nameColumns, namesOf, type NameColumns } from '@/api/names'

const named = (rows: ({ slug: string } & NameColumns)[]) => rows.map((row) => ({ slug: row.slug, name: namesOf(row) }))

export const abilities = async (db: Db) =>
    named(await db.select({ slug: ability.slug, ...nameColumns(ability) }).from(ability).orderBy(ability.slug))

export const moves = async (db: Db) => named(await db.select().from(move).orderBy(move.slug))

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

export const findAbility = async (db: Db, slug: string) => {
    const [row] = await db.select().from(ability).where(eq(ability.slug, slug.toLowerCase()))
    return row && { ...named([row])[0]!, description: row.description, effect: row.effect }
}

export const generations = (db: Db) =>
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
        .orderBy(generation.id)

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

export const pokedexes = (db: Db) =>
    db
        .select({ slug: pokemonDexNumber.pokedex, count: count() })
        .from(pokemonDexNumber)
        .groupBy(pokemonDexNumber.pokedex)
        .orderBy(pokemonDexNumber.pokedex)
