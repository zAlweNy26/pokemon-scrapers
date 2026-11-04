import { count, countDistinct, eq } from 'drizzle-orm'
import type { Db } from '../../../db/client'
import { form, formType, generation, pokemon } from '../../../db/schema'

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

export const types = (db: Db) =>
    // Counted over default forms only, so a species is not double-counted because
    // one of its alternate forms changed type.
    db
        .select({ name: formType.type, count: countDistinct(form.ndex) })
        .from(formType)
        .innerJoin(form, eq(form.id, formType.formId))
        .where(eq(form.isDefault, true))
        .groupBy(formType.type)
        .orderBy(formType.type)
