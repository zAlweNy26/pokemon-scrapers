import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestDb, type TestDb } from './support/database'
import { eq } from 'drizzle-orm'
import { form } from '@/db/schema'
import * as pokemon from '@/api/modules/pokemon/service'
import * as search from '@/api/modules/search/service'
import * as reference from '@/api/modules/reference/service'
import * as forms from '@/api/modules/forms/service'
import * as evolution from '@/api/modules/evolution/service'

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

    const slugs = async (filters: Partial<pokemon.ListFilters>) => (await list(filters)).items.map((i) => i.slug)

    test('homeGame takes a version group and matches through any form', async () => {
        expect(await slugs({ homeGame: 'legends-arceus' })).toEqual(['rotom'])
        expect(await slugs({ homeGame: 'Legends-ZA' })).toEqual(['gengar', 'greninja'])
        // `scarlet` is a version, not a version group: it names no HOME game.
        expect(await slugs({ homeGame: 'scarlet' })).toEqual([])
    })

    test('ability matches any form, hidden or not', async () => {
        // Battle Bond belongs only to Ash-Greninja, not the default form.
        expect(await slugs({ ability: 'battle-bond' })).toEqual(['greninja'])
        expect(await slugs({ ability: 'Lightning-Rod' })).toEqual(['pikachu', 'raichu'])
    })

    test('filters by egg group', async () => {
        expect(await slugs({ eggGroup: 'Water1' })).toEqual(['lapras', 'greninja'])
    })

    test('exclusiveTo takes a version and needs a row flagged exclusive', async () => {
        expect(await slugs({ exclusiveTo: 'omega-ruby' })).toEqual(['gengar'])
        expect(await slugs({ exclusiveTo: 'scarlet' })).toEqual([])
    })

    test('obtainableIn takes a version and needs a row the game can obtain on its own', async () => {
        expect(await slugs({ obtainableIn: 'scarlet' })).toEqual(['pikachu'])
        // Pikachu has an XD row, but only through transfer.
        expect(await slugs({ obtainableIn: 'xd' })).toEqual([])
        expect(await slugs({ obtainableIn: 'scarlet-violet' })).toEqual([])
    })

    test('filters by habitat, ignoring case', async () => {
        expect(await slugs({ habitat: 'Forest' })).toEqual(['pikachu', 'raichu'])
    })

    test('sorts ascending by English name, stat total, or a single stat of the default form', async () => {
        expect(await slugs({ sort: 'name' })).toEqual([
            'gengar', 'greninja', 'lapras', 'ogerpon', 'pikachu', 'raichu', 'rotom', 'urshifu'
        ])
        // Urshifu and Ogerpon both total 550: dex number breaks the tie.
        expect(await slugs({ sort: 'bst' })).toEqual([
            'pikachu', 'rotom', 'raichu', 'gengar', 'greninja', 'lapras', 'urshifu', 'ogerpon'
        ])
        expect(await slugs({ sort: 'hp', limit: 2 })).toEqual(['pikachu', 'rotom'])
    })

    test('a leading - sorts descending, still breaking ties by ascending dex number', async () => {
        expect(await slugs({ sort: '-bst' })).toEqual([
            'urshifu', 'ogerpon', 'lapras', 'greninja', 'gengar', 'raichu', 'rotom', 'pikachu'
        ])
        expect(await slugs({ sort: '-weight', limit: 3 })).toEqual(['lapras', 'urshifu', 'gengar'])
        expect((await list({ sort: '-bst', limit: 2, offset: 1 })).items.map((i) => i.slug)).toEqual(['ogerpon', 'lapras'])
    })

    test('sorts unknown values last in both directions', async () => {
        const own = await createTestDb()
        await own.db.update(form).set({ spd: null, weightKg: null }).where(eq(form.slug, 'raichu'))

        const ownSlugs = async (sort: pokemon.ListFilters['sort']) =>
            (await pokemon.list(own.db, { sort, limit: 50, offset: 0 }, IMAGES)).items.map((i) => i.slug)

        expect((await ownSlugs('bst')).at(-1)).toBe('raichu')
        expect((await ownSlugs('-bst')).at(-1)).toBe('raichu')
        expect((await ownSlugs('weight')).at(-1)).toBe('raichu')
        expect((await ownSlugs('-weight')).at(-1)).toBe('raichu')
        own.close()
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
        expect(ash?.shinySprites).toBeNull()
        expect(ash?.shinyAvailability).toEqual([])
        expect(result.depositable).toBe(true)
    })

    test('gives shiny availability per form, empty when nothing is known', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'ogerpon'))!, IMAGES)

        expect(result.forms.map((form) => form.shinyAvailability)).toEqual([
            [{ generation: 9, status: 'unobtainable', games: null }],
            [{ generation: 9, status: 'unobtainable', games: null }]
        ])
        expect((await forms.detail(db, 'pikachu', IMAGES))?.shinyAvailability).toEqual([])
    })

    test('splits a form into male and female looks only when HOME draws them apart', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'pikachu'))!, IMAGES)
        const [pikachu, partner] = result.forms

        expect(pikachu?.variants.map((variant) => variant.gender)).toEqual(['male', 'female'])
        expect(pikachu?.variants[0]?.sprites).toEqual(pikachu!.sprites)
        expect(pikachu?.variants[1]?.shinySprites?.['96']).toBe(`${IMAGES}/shiny/female/pokemon/25/pikachu/96.webp`)
        expect(partner?.variants).toEqual([{ gender: null, sprites: partner!.sprites, shinySprites: partner!.shinySprites }])
    })

    test('says which forms Gigantamax, can be alphas, and which mark each game gives', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'pikachu'))!, IMAGES)
        const [pikachu, partner] = result.forms

        expect([pikachu?.canGigantamax, partner?.canGigantamax]).toEqual([true, false])
        expect(pikachu?.alphaIn).toEqual(['legends-arceus', 'legends-za'])
        expect(partner?.alphaIn).toEqual([])
        expect(result.availability.map((row) => row.originMark)).toEqual([
            'game-boy', null, null, 'scarlet-violet', 'scarlet-violet', 'legends-za'
        ])
    })

    test('flags hidden abilities', async () => {
        const species = await pokemon.findSpecies(db, 'pikachu')
        const result = await pokemon.detail(db, species!, IMAGES)

        expect(result.forms[0]?.abilities.map(({ slug, hidden }) => ({ slug, hidden }))).toEqual([
            { slug: 'static', hidden: false },
            { slug: 'lightning-rod', hidden: true }
        ])
    })

    test('lists Pokédex entries and game locations in Bulbapedia order, "none" as null', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'pikachu'))!, IMAGES)

        expect(result.pokedexEntries.map((entry) => [entry.game, entry.form])).toEqual([
            ['red', null], ['sword', null], ['sword', 'Gigantamax'], ['scarlet', null], ['legends-za', null]
        ])
        expect(result.availability.map((place) => [place.game, place.dlc, place.obtainable])).toEqual([
            ['red', null, true], ['xd', null, false], ['black', null, false], ['scarlet', null, true],
            ['scarlet', 'the-hidden-treasure-of-area-zero', true], ['legends-za', 'mega-dimension', true]
        ])
        expect(result.availability[1]?.area).toBeNull()

        const lapras = await pokemon.detail(db, (await pokemon.findSpecies(db, 'lapras'))!, IMAGES)
        expect(lapras.pokedexEntries).toEqual([])
        expect(lapras.availability).toEqual([])
    })

    test('names abilities in every language', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'pikachu'))!, IMAGES)

        expect(result.forms[0]?.abilities[0]?.name).toMatchObject({ en: 'Static', it: 'Statico', ja: 'せいでんき', ja_romaji: null })
    })

    test('every member of a family gets the whole evolution chain, conditions parsed', async () => {
        const [pikachu, raichu] = await Promise.all(
            ['pikachu', 'raichu'].map(async (slug) => pokemon.detail(db, (await pokemon.findSpecies(db, slug))!, IMAGES))
        )

        expect(raichu!.evolutionChain).toEqual(pikachu!.evolutionChain)
        expect(pikachu!.evolutionChain.id).toBe(10)
        expect(pikachu!.evolutionChain.steps).toEqual([
            {
                from: 'pikachu', into: 'raichu', fromForm: 'pikachu', intoForm: null, trigger: 'use-item',
                game: 'red-blue', isDefault: true, conditions: { item: 'thunder-stone' }
            },
            {
                from: 'pikachu', into: 'raichu', fromForm: 'pikachu', intoForm: null, trigger: 'use-item',
                game: 'sun-moon', isDefault: true, conditions: { item: 'thunder-stone', region: 'alola' }
            }
        ])
    })

    test('a species that does not evolve has an empty chain', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'lapras'))!, IMAGES)

        expect(result.evolutionChain).toEqual({ id: 65, steps: [] })
        expect(result.dexNumbers).toEqual({})
    })

    test('reports regional dex numbers, species flags, EV yield and base experience', async () => {
        const result = await pokemon.detail(db, (await pokemon.findSpecies(db, 'pikachu'))!, IMAGES)

        expect(result.dexNumbers).toEqual({ 'kalos-central': 36, kanto: 25, kitakami: 21, paldea: 74 })
        expect(result).toMatchObject({
            isLegendary: false, isMythical: false, isBaby: false, hasGenderDifferences: true,
            growthRate: 'medium', color: 'yellow', shape: 'quadruped', habitat: 'forest'
        })
        expect(result.forms[0]?.evYield).toEqual({ hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 2 })
        expect(result.forms[0]?.baseExperience).toBe(112)

        const urshifu = await pokemon.detail(db, (await pokemon.findSpecies(db, 'urshifu'))!, IMAGES)
        expect(urshifu.isLegendary).toBe(true)
        expect(urshifu.habitat).toBeNull()
    })
})

describe('evolution.chain', () => {
    test("lists the chain's species as list items, with the steps every member's detail has", async () => {
        const result = await evolution.chain(db, 26, IMAGES)
        const raichu = await pokemon.detail(db, (await pokemon.findSpecies(db, 'raichu'))!, IMAGES)

        expect(result?.id).toBe(10)
        expect(result?.members).toEqual((await list({})).items.filter((i) => [25, 26].includes(i.ndex)))
        expect(result?.steps).toEqual(raichu.evolutionChain.steps)
        expect(result?.steps).toHaveLength(2)
    })

    test('a chain of one species has no steps', async () => {
        const result = await evolution.chain(db, 131, IMAGES)

        expect(result?.members.map((member) => member.slug)).toEqual(['lapras'])
        expect(result?.steps).toEqual([])
    })

    test('returns undefined for a dex number no species has', async () => {
        expect(await evolution.chain(db, 9999, IMAGES)).toBeUndefined()
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
        const bySlug = Object.fromEntries(types.map((t) => [t.slug, t.count]))

        // Water counts Lapras and Greninja; Rapid Strike Urshifu is not a default form.
        expect(bySlug.water).toBe(2)
        // Only Hearthflame Ogerpon, not a default form, is Fire: listed, at 0.
        expect(bySlug.fire).toBe(0)
    })

    test('names every type, ability and move', async () => {
        const types = await reference.types(db)
        expect(types.find((t) => t.slug === 'dark')?.name).toMatchObject({ en: 'Dark', de: 'Unlicht', fr: 'Ténèbres' })

        const abilities = await reference.abilities(db)
        expect(abilities.map((a) => a.slug)).toContain('lightning-rod')
        expect(abilities.find((a) => a.slug === 'protean')?.name.ko).toBe('변환자재')

        expect(await reference.moves(db)).toEqual([
            expect.objectContaining({ slug: 'thunderbolt', name: expect.objectContaining({ en: 'Thunderbolt', it: 'Fulmine' }) }),
            expect.objectContaining({ slug: 'volt-tackle' })
        ])
    })

    test('counts species per egg group, HOME game and regional Pokédex, ordered by slug', async () => {
        expect(await reference.eggGroups(db)).toEqual([
            { slug: 'fairy', count: 2 }, { slug: 'ground', count: 2 }, { slug: 'humanshape', count: 1 },
            { slug: 'indeterminate', count: 2 }, { slug: 'monster', count: 1 }, { slug: 'no-eggs', count: 1 },
            { slug: 'water1', count: 2 }
        ])
        // Urshifu's two forms both move into Scarlet/Violet and Sword/Shield, but it is one species.
        expect(await reference.homeGames(db)).toEqual([
            { slug: 'legends-arceus', count: 1 }, { slug: 'legends-za', count: 2 },
            { slug: 'lets-go-pikachu-lets-go-eevee', count: 1 }, { slug: 'scarlet-violet', count: 6 },
            { slug: 'sword-shield', count: 6 }
        ])
        expect(await reference.pokedexes(db)).toEqual([
            { slug: 'kalos-central', count: 2 }, { slug: 'kanto', count: 2 }, { slug: 'kitakami', count: 2 },
            { slug: 'paldea', count: 2 }
        ])
    })

    test('every count is the total the matching filter returns', async () => {
        for (const { slug, count } of await reference.eggGroups(db))
            expect((await list({ eggGroup: slug })).total, slug).toBe(count)
        for (const { slug, count } of await reference.homeGames(db))
            expect((await list({ homeGame: slug })).total, slug).toBe(count)
        for (const { slug, count } of await reference.pokedexes(db))
            expect((await pokemon.pokedex(db, slug, { limit: 50, offset: 0 }, IMAGES)).total, slug).toBe(count)
        for (const { slug, count } of await reference.types(db))
            expect((await list({ type: slug })).total, slug).toBe(count)
    })

    test('finds a type or ability by slug, ignoring case', async () => {
        expect(await reference.findType(db, 'WATER')).toEqual({
            slug: 'water', name: expect.objectContaining({ en: 'Water', de: 'Wasser' })
        })
        expect((await reference.findAbility(db, 'Levitate'))?.slug).toBe('levitate')
        expect(await reference.findType(db, 'sound')).toBeUndefined()
        expect(await reference.findAbility(db, 'wonder-guard')).toBeUndefined()
    })
})

describe('pokemon.pokedex', () => {
    const dex = (slug: string, limit = 50, offset = 0) => pokemon.pokedex(db, slug, { limit, offset }, IMAGES)

    test('lists species in regional order with their regional number, ignoring case', async () => {
        const { total, items } = await dex('Kalos-Central')

        // Greninja is #9 in Central Kalos, Pikachu #36: not National Dex order.
        expect(total).toBe(2)
        expect(items.map((item) => [item.slug, item.number])).toEqual([['greninja', 9], ['pikachu', 36]])
        expect(items[0]).toMatchObject({ ndex: 658, generation: 6, types: ['water', 'dark'], depositable: true })
    })

    test('pages without changing the total', async () => {
        const { total, items } = await dex('kalos-central', 1, 1)

        expect(total).toBe(2)
        expect(items.map((item) => item.slug)).toEqual(['pikachu'])
    })

    test('reports nothing for a Pokédex no species is in', async () => {
        expect(await dex('johto')).toEqual({ total: 0, items: [] })
    })
})

describe('forms.list', () => {
    const formList = (filters: Partial<forms.FormFilters> = {}) =>
        forms.list(db, { limit: 50, offset: 0, ...filters }, IMAGES)
    const slugs = async (filters: Partial<forms.FormFilters>) => (await formList(filters)).items.map((item) => item.slug)

    test('lists every form by dex number, default form first', async () => {
        const { total, items } = await formList()

        expect(total).toBe(13)
        expect(items.slice(0, 4).map((item) => item.slug)).toEqual(['pikachu', 'pikachu-partner', 'raichu', 'gengar'])
        expect(items[1]).toEqual({
            slug: 'pikachu-partner',
            name: expect.objectContaining({ en: 'Partner Pikachu', ja: null }),
            species: { ndex: 25, slug: 'pikachu' },
            isDefault: false,
            category: 'variant',
            depositable: false,
            homeGames: [],
            types: ['electric'],
            sprites: expect.any(Object),
            shinySprites: {
                '96': `${IMAGES}/shiny/pokemon/25/pikachu-partner/96.webp`,
                '256': `${IMAGES}/shiny/pokemon/25/pikachu-partner/256.webp`,
                '512': `${IMAGES}/shiny/pokemon/25/pikachu-partner/512.webp`
            },
            variants: [{ gender: null, sprites: expect.any(Object), shinySprites: expect.any(Object) }]
        })
        expect(items[0]?.homeGames).toEqual(['lets-go-pikachu-lets-go-eevee', 'scarlet-violet', 'sword-shield'])
    })

    test('filters on category', async () => {
        expect(await slugs({ category: 'switchable' })).toEqual(['rotom-wash'])
        expect(await slugs({ category: 'battle-only' })).toEqual(['greninja-ash'])
        expect((await formList({ category: 'default' })).total).toBe(8)
    })

    test("depositable is the form's own flag, so it tells Pikachu apart from its blocked form", async () => {
        // Pikachu and Greninja are depositable at species level; these two forms are not.
        expect(await slugs({ depositable: false })).toEqual(['pikachu-partner', 'greninja-ash'])
        expect(await slugs({ depositable: true })).toContain('pikachu')
        expect((await formList({ depositable: true })).total).toBe(11)
    })

    test('filters by HOME game, type, generation and default flag, ignoring case', async () => {
        expect(await slugs({ homeGame: 'Legends-Arceus' })).toEqual(['rotom', 'rotom-wash'])
        expect(await slugs({ type: 'Water' })).toEqual([
            'lapras', 'rotom-wash', 'greninja', 'greninja-ash', 'urshifu-rapid-strike'
        ])
        expect(await slugs({ gen: 1 })).toEqual(['pikachu', 'pikachu-partner', 'raichu', 'gengar', 'lapras'])
        expect(await slugs({ isDefault: false })).toEqual([
            'pikachu-partner', 'rotom-wash', 'greninja-ash', 'urshifu-rapid-strike', 'ogerpon-hearthflame'
        ])
    })

    test('pages without changing the total', async () => {
        const { total, items } = await formList({ limit: 2, offset: 1 })

        expect(total).toBe(13)
        expect(items.map((item) => item.slug)).toEqual(['pikachu-partner', 'raichu'])
    })
})

describe('forms.detail', () => {
    test("is the species document's form, plus its species", async () => {
        const species = await pokemon.detail(db, (await pokemon.findSpecies(db, 'greninja'))!, IMAGES)
        const { species: owner, encounters, ...rest } = (await forms.detail(db, 'Greninja-Ash', IMAGES))!

        expect(rest).toEqual(species.forms.find((entry) => entry.slug === 'greninja-ash')!)
        expect(encounters).toEqual([])
        expect(owner).toEqual({ ndex: 658, slug: 'greninja', name: species.name })
    })

    test("lists the form's own encounters, not its species'", async () => {
        const rapid = await forms.detail(db, 'urshifu-rapid-strike', IMAGES)
        const species = await pokemon.detail(db, (await pokemon.findSpecies(db, 'urshifu'))!, IMAGES)

        expect(rapid?.encounters).toEqual([
            { game: 'sword', location: 'tower-of-waters', method: 'gift', form: 'urshifu-rapid-strike' }
        ])
        expect(species.encounters.map((row) => row.form)).toEqual(['urshifu-single-strike', 'urshifu-rapid-strike'])
    })

    test('returns undefined for an unknown slug', async () => {
        expect(await forms.detail(db, 'pikachu-cosplay', IMAGES)).toBeUndefined()
    })
})
