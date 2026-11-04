import { and, count, countDistinct, eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { ability, form, formType, generation, move, pokemon, type } from '@/db/schema'
import { nameColumns, namesOf, type NameColumns } from '@/api/names'

const named = (rows: ({ slug: string } & NameColumns)[]) => rows.map((row) => ({ slug: row.slug, name: namesOf(row) }))

export const abilities = async (db: Db) => named(await db.select().from(ability).orderBy(ability.slug))

export const moves = async (db: Db) => named(await db.select().from(move).orderBy(move.slug))

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
