import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestDb, type TestDb } from './support/database'
import { eq } from 'drizzle-orm'
import { form } from '@/db/schema'
import * as pokemon from '@/api/modules/pokemon/service'
import * as search from '@/api/modules/search/service'
import * as reference from '@/api/modules/reference/service'

const IMAGES = 'https://images.test'

let fixture: TestDb
let db: TestDb['db']

beforeAll(async () => {
    fixture = await createTestDb()
    db = fixture.db
})

afterAll(() => fixture.close())

const list = (filters: Partial<pokemon.ListFilters> = {}) =>
    pokemon.list(db, { limit: 50, offset: 0, ...filters }, IMAGES)

describe('pokemon.list', () => {
    test('returns species ordered by dex number with their default form types', async () => {
        const { total, items } = await list()

        expect(total).toBe(8)
        expect(items.map((item) => item.ndex)).toEqual([25, 26, 94, 131, 479, 658, 892, 1017])
        expect(items[0]?.types).toEqual(['electric'])
        expect(items[2]?.types).toEqual(['ghost', 'poison'])
    })

    test('reports the unpaginated total alongside a page', async () => {
        const { total, items } = await list({ limit: 2, offset: 2 })

        expect(total).toBe(8)
        expect(items).toHaveLength(2)
        expect(items[0]?.slug).toBe('gengar')
    })

    test('filters by generation, region and type', async () => {
        expect((await list({ gen: 1 })).total).toBe(4)
        expect((await list({ region: 'Galar' })).items.map((i) => i.slug)).toEqual(['urshifu'])
        expect((await list({ type: 'Water' })).items.map((i) => i.slug)).toEqual([
            'lapras',
            'greninja'
        ])
    })

    test('matches type and region case-insensitively', async () => {
        expect((await list({ type: 'water' })).total).toBe(2)
        expect((await list({ region: 'galar' })).total).toBe(1)
    })

    test('depositable is species-level: true when any form can enter HOME', async () => {
        const { items } = await list({ depositable: true })

        // Greninja qualifies through its default form even though Ash-Greninja cannot.
        expect(items.map((item) => item.slug)).toContain('greninja')
        expect(items).toHaveLength(8)
    })

    test('list items and search results report depositable the way the filter means it', async () => {
        // A species whose default form cannot enter HOME but another form can: the
        // filter returns it, so every result row must say depositable: true too.
        const own = await createTestDb()
        await own.db.update(form).set({ depositable: false }).where(eq(form.slug, 'ogerpon-teal'))

        const { items } = await pokemon.list(own.db, { depositable: true, limit: 50, offset: 0 }, IMAGES)
        const [fullText] = await search.search(own.db, 'Ogerpon', 5, IMAGES)
        const [prefix] = await search.search(own.db, 'Og', 5, IMAGES)
        own.close()

        expect(items.find((item) => item.slug === 'ogerpon')?.depositable).toBe(true)
        expect(fullText?.depositable).toBe(true)
        expect(prefix?.depositable).toBe(true)
    })

    test('depositable=false means no form qualifies, not "has a blocked form"', async () => {
        // Pikachu and Greninja each own a form that cannot enter HOME, but both
        // species can - so a naive `depositable = 0` filter would wrongly list them.
        expect((await list({ depositable: false })).items).toEqual([])
    })

    test('builds sprite URLs from the image base, and null when artwork is absent', async () => {
        const { items } = await list()

        expect(items[0]?.sprites).toEqual({
            '96': `${IMAGES}/pokemon/25/pikachu/96.webp`,
            '256': `${IMAGES}/pokemon/25/pikachu/256.webp`,
            '512': `${IMAGES}/pokemon/25/pikachu/512.webp`
        })
    })
})

describe('pokemon.findSpecies', () => {
    test('resolves by dex number, slug and English name, ignoring case', async () => {
        for (const key of ['25', 'pikachu', 'Pikachu', 'PIKACHU'])
            expect((await pokemon.findSpecies(db, key))?.ndex).toBe(25)
    })

    test('returns undefined for an unknown identifier', async () => {
        expect(await pokemon.findSpecies(db, 'mewthree')).toBeUndefined()
        expect(await pokemon.findSpecies(db, '99999')).toBeUndefined()
    })
})

describe('pokemon.detail', () => {
    test('assembles the full document in one call', async () => {
        const species = await pokemon.findSpecies(db, 'pikachu')
        const result = await pokemon.detail(db, species!, IMAGES)

        expect(result.name.ja).toBe('ピカチュウ')
        expect(result.eggGroups).toEqual(['fairy', 'ground'])
        expect(Object.keys(result.origins)).toEqual(['en', 'ja'])
        expect(result.encounters).toHaveLength(2)
    })

    test('puts the default form first and keeps per-form data separate', async () => {
        const species = await pokemon.findSpecies(db, 'urshifu')
        const result = await pokemon.detail(db, species!, IMAGES)

        expect(result.forms[0]?.isDefault).toBe(true)
        expect(result.forms[0]?.types).toEqual(['fighting', 'dark'])
        expect(result.forms[1]?.types).toEqual(['fighting', 'water'])
        expect(result.forms[1]?.homeGames).toEqual(['scarlet-violet', 'sword-shield'])
    })

    test('localises the category and every form name, keeping missing languages as null', async () => {
        const species = await pokemon.findSpecies(db, 'rotom')
        const result = await pokemon.detail(db, species!, IMAGES)

        expect(result.category.en).toBe('Plasma Pokémon')
        expect(result.category.ja).toBe('プラズマポケモン')
        expect(result.category.de).toBeNull()
        expect(result.forms[1]?.name).toMatchObject({ en: 'Wash Rotom', ja: 'ウォッシュロトム', fr: null })
    })

    test('a form that cannot be stored in HOME can move into no game', async () => {
        const species = await pokemon.findSpecies(db, 'pikachu')
        const result = await pokemon.detail(db, species!, IMAGES)
        const partner = result.forms.find((form) => form.slug === 'pikachu-partner')

        expect(partner?.depositable).toBe(false)
        expect(partner?.homeGames).toEqual([])
    })

    test('marks a form that cannot enter HOME while the species still can', async () => {
        const species = await pokemon.findSpecies(db, 'greninja')
        const result = await pokemon.detail(db, species!, IMAGES)

        const ash = result.forms.find((form) => form.slug === 'greninja-ash')

        expect(ash?.depositable).toBe(false)
        expect(ash?.sprites).toBeNull()
        expect(result.depositable).toBe(true)
    })

    test('flags hidden abilities', async () => {
        const species = await pokemon.findSpecies(db, 'pikachu')
        const result = await pokemon.detail(db, species!, IMAGES)

        expect(result.forms[0]?.abilities).toEqual([
            { name: 'static', hidden: false },
            { name: 'lightning-rod', hidden: true }
        ])
    })
})

describe('search', () => {
    test('finds a species by a name in a language other than English', async () => {
        const [result] = await search.search(db, 'Quaj', 10, IMAGES)

        expect(result?.slug).toBe('greninja')
        expect(result?.matchedIn).toBe('de')
    })

    test('uses the trigram index for three or more characters', async () => {
        const [result] = await search.search(db, 'ゲンガ', 10, IMAGES)

        expect(result?.slug).toBe('gengar')
        expect(result?.matchedIn).toBe('ja')
    })

    test('falls back to a prefix match for two-character CJK queries', async () => {
        // Below the trigram floor: without the fallback these return nothing at all.
        expect((await search.search(db, '耿鬼', 10, IMAGES))[0]?.slug).toBe('gengar')
        expect((await search.search(db, '라프', 10, IMAGES))[0]?.slug).toBe('lapras')
    })

    test('honours the result limit', async () => {
        // 'chu' matches both Pikachu and Raichu, so the cap is doing real work here.
        expect(await search.search(db, 'chu', 10, IMAGES)).toHaveLength(2)
        expect(await search.search(db, 'chu', 1, IMAGES)).toHaveLength(1)
    })

    test('treats FTS5 syntax in user input as literal text', async () => {
        // A bare quote or asterisk is a query-syntax error in FTS5, not a search term.
        for (const query of ['pika"', 'pika*', '"OR"', 'pika NEAR gengar'])
            expect(async () => search.search(db, query, 10, IMAGES)).not.toThrow()
    })

    test('returns nothing for a query that matches nothing', async () => {
        expect(await search.search(db, 'zzzzz', 10, IMAGES)).toEqual([])
    })
})

describe('reference', () => {
    test('counts species per generation', async () => {
        const generations = await reference.generations(db)

        expect(generations.map((g) => [g.id, g.count])).toEqual([
            [1, 4],
            [4, 1],
            [6, 1],
            [8, 1],
            [9, 1]
        ])
    })

    test('counts types over default forms only', async () => {
        const types = await reference.types(db)
        const byName = Object.fromEntries(types.map((t) => [t.name, t.count]))

        // Water counts Lapras and Greninja; Rapid Strike Urshifu is not a default form.
        expect(byName.water).toBe(2)
        expect(byName.fire).toBeUndefined()
    })
})
