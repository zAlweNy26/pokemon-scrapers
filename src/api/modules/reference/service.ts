import { and, count, countDistinct, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import {
    ability, form, formHomeGame, formType, generation, move, pokemon, pokemonDexNumber, pokemonEggGroup, type
} from '@/db/schema'
import { nameColumns, namesOf, type NameColumns } from '@/api/names'

const named = (rows: ({ slug: string } & NameColumns)[]) => rows.map((row) => ({ slug: row.slug, name: namesOf(row) }))

export const abilities = async (db: Db) => named(await db.select().from(ability).orderBy(ability.slug))

export const moves = async (db: Db) => named(await db.select().from(move).orderBy(move.slug))

export const findType = async (db: Db, slug: string) =>
    named(await db.select().from(type).where(sql`${type.slug} = ${slug} COLLATE NOCASE`).limit(1))[0]

export const findAbility = async (db: Db, slug: string) =>
    named(await db.select().from(ability).where(sql`${ability.slug} = ${slug} COLLATE NOCASE`).limit(1))[0]

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

    return rows.map((row) => ({ slug: row.slug, name: namesOf(row), count: row.count }))
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
