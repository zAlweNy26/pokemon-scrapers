import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { pokemon } from '@/db/schema'
import { evolutionSteps, pokemonRef } from '@/api/modules/pokemon/service'

/** The chain a species is in: references to its species, and its steps exactly as each member's detail has them. */
export const chain = async (db: Db, ndex: number) => {
    const [species] = await db.select({ id: pokemon.evolutionChain }).from(pokemon).where(eq(pokemon.ndex, ndex)).limit(1)
    if (!species) return undefined

    const { id } = species
    const [rows, steps] = await db.batch([
        db
            .select({ ndex: pokemon.ndex, slug: pokemon.slug })
            .from(pokemon)
            .where(eq(pokemon.evolutionChain, id))
            .orderBy(pokemon.ndex),
        evolutionSteps(db, id)
    ])

    return { id, members: rows.map(pokemonRef), steps }
}
