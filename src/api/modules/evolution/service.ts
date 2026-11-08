import { and, eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { form, pokemon } from '@/db/schema'
import { evolutionSteps, listColumns, listItems } from '@/api/modules/pokemon/service'

/** The chain a species is in: its species as list items, and its steps exactly as each member's detail has them. */
export const chain = async (db: Db, ndex: number, imageBaseUrl: string) => {
    const [species] = await db.select({ id: pokemon.evolutionChain }).from(pokemon).where(eq(pokemon.ndex, ndex)).limit(1)
    if (!species) return undefined

    const { id } = species
    const [rows, steps] = await db.batch([
        db
            .select(listColumns)
            .from(pokemon)
            .innerJoin(form, and(eq(form.ndex, pokemon.ndex), eq(form.isDefault, true)))
            .where(eq(pokemon.evolutionChain, id))
            .orderBy(pokemon.ndex),
        evolutionSteps(db, id)
    ])

    return { id, members: await listItems(db, rows, imageBaseUrl), steps }
}
