import { and, count, eq, exists, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { form, formHomeGame, formType, pokemon } from '@/db/schema'
import { nameColumns, nameProjection, namesOf } from '@/api/names'
import { spritesFor } from '@/api/sprites'
import { formDocuments, formFacts, groupBy, typesByForm } from '@/api/modules/pokemon/service'

export interface FormFilters {
    gen?: number
    type?: string
    depositable?: boolean
    homeGame?: string
    isDefault?: boolean
    limit: number
    offset: number
}

const filterConditions = (filters: FormFilters) => {
    const conditions = []

    if (filters.gen !== undefined) conditions.push(eq(pokemon.gen, filters.gen))

    if (filters.type !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${formType} WHERE ${formType.formId} = ${form.id}
                     AND ${formType.type} = ${filters.type} COLLATE NOCASE)`
            )
        )

    // The form's own flag: no any-form rule here, unlike the species filter.
    if (filters.depositable !== undefined) conditions.push(eq(form.depositable, filters.depositable))

    if (filters.homeGame !== undefined)
        conditions.push(
            exists(
                sql`(SELECT 1 FROM ${formHomeGame} WHERE ${formHomeGame.formId} = ${form.id}
                     AND ${formHomeGame.game} = ${filters.homeGame} COLLATE NOCASE)`
            )
        )

    if (filters.isDefault !== undefined) conditions.push(eq(form.isDefault, filters.isDefault))

    return conditions.length ? and(...conditions) : undefined
}

export const list = async (db: Db, filters: FormFilters, imageBaseUrl: string) => {
    const where = filterConditions(filters)

    const [counted, page] = await db.batch([
        db.select({ total: count() }).from(form).innerJoin(pokemon, eq(pokemon.ndex, form.ndex)).where(where),
        db
            .select({
                id: form.id,
                slug: form.slug,
                ...nameColumns(form),
                ndex: form.ndex,
                // Renamed: D1 batches key rows by column name, and the form's is `slug` too.
                speciesSlug: sql<string>`${pokemon.slug}`.as('species_slug'),
                isDefault: form.isDefault,
                depositable: form.depositable,
                spriteKey: form.spriteKey,
                shinySpriteKey: form.shinySpriteKey
            })
            .from(form)
            .innerJoin(pokemon, eq(pokemon.ndex, form.ndex))
            .where(where)
            .orderBy(form.ndex, sql`${form.isDefault} DESC`, form.id)
            .limit(filters.limit)
            .offset(filters.offset)
    ])

    const ids = page.map((row) => row.id)
    const [types, homeGames] = await Promise.all([typesByForm(db, ids), homeGamesByForm(db, ids)])

    return {
        total: counted[0]?.total ?? 0,
        items: page.map((row) => ({
            slug: row.slug,
            name: namesOf(row),
            species: { ndex: row.ndex, slug: row.speciesSlug },
            isDefault: row.isDefault,
            depositable: row.depositable,
            homeGames: homeGames.get(row.id) ?? [],
            types: types.get(row.id) ?? [],
            sprites: spritesFor(imageBaseUrl, row.spriteKey),
            shinySprites: spritesFor(imageBaseUrl, row.shinySpriteKey)
        }))
    }
}

/**
 * HOME games for a set of forms, grouped by form id. One bound parameter per
 * form, as in `typesByForm`: at most a page of 100, within D1's cap.
 */
const homeGamesByForm = async (db: Db, formIds: number[]) => {
    if (!formIds.length) return new Map<number, string[]>()

    const rows = await db
        .select({ formId: formHomeGame.formId, game: formHomeGame.game })
        .from(formHomeGame)
        .where(inArray(formHomeGame.formId, formIds))
        .orderBy(formHomeGame.formId, formHomeGame.game)

    return groupBy(rows, (row) => row.formId, (row) => row.game)
}

/** One form as `forms[]` in /v1/pokemon/:idOrName has it, plus its species. Slugs match case-insensitively. */
export const detail = async (db: Db, slug: string, imageBaseUrl: string) => {
    // Slugs are stored lowercase; COLLATE NOCASE would skip the unique index and scan every form, five times.
    const where = eq(form.slug, slug.toLowerCase())

    const [forms, species, typeRows, abilityRows, homeRows] = await db.batch([
        db.select().from(form).where(where),
        db
            .select({ ndex: pokemon.ndex, slug: pokemon.slug, ...nameProjection })
            .from(pokemon)
            .innerJoin(form, eq(form.ndex, pokemon.ndex))
            .where(where),
        ...formFacts(db, where)
    ])

    const [document] = formDocuments(forms, typeRows, abilityRows, homeRows, imageBaseUrl)
    const [owner] = species
    if (!document || !owner) return undefined

    return { ...document, species: { ndex: owner.ndex, slug: owner.slug, name: namesOf(owner) } }
}
