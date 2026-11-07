import { describe, expect, test } from 'bun:test'
import { type PokeosRow, placeOf, shinyLockedForms } from '@/scraper/pokeos'

describe('placeOf', () => {
    const at = (location_identifier: string, description: string | null = null) =>
        placeOf({ pokemon_id: 1, version_identifier: 'scarlet', location_identifier, method_identifier: 'walk', description })

    test('keeps real places, drops ways of obtaining that pokeos files as locations', () => {
        expect(at('coastal-biome')).toBe('coastal-biome')
        expect(['anywhere-trade', 'pokemon-go', 'quaxwell'].map((location) => at(location))).toEqual([null, null, null])
    })

    test('a biodiversity boost is an encounter in the biome it names', () => {
        expect(at('boosting-biodiversity', 'after boosting biodiversity in the Canyon Biome (DLC)')).toBe('canyon-biome')
        expect(at('boosting-biodiversity', null)).toBeNull()
    })
})

const row = (id: number, number: number, identifier: string, form_identifier = '', locked = 1): PokeosRow => ({
    id, number, identifier, form_identifier, is_sublegendary: 0, is_ub: 0, is_paradox: 0, is_shiny_locked: locked
})

// Homedex forms carry PokéAPI's form ids and slugs.
const forms = [
    { id: 25, ndex: 25, slug: 'pikachu', isDefault: true },
    { id: 10094, ndex: 25, slug: 'pikachu-original-cap', isDefault: false },
    { id: 901, ndex: 901, slug: 'ursaluna', isDefault: true },
    { id: 10450, ndex: 901, slug: 'ursaluna-bloodmoon', isDefault: false },
    { id: 1024, ndex: 1024, slug: 'terapagos-normal', isDefault: true },
    { id: 10445, ndex: 1024, slug: 'terapagos-terastal', isDefault: false }
]
const speciesSlug = new Map([[25, 'pikachu'], [901, 'ursaluna'], [1024, 'terapagos']])

describe('shinyLockedForms', () => {
    test('a species row locks its default form, whatever that form is called', () => {
        expect(shinyLockedForms([row(1024, 1024, 'Terapagos')], forms, speciesSlug).ids).toEqual(new Set([1024]))
    })

    test('form rows match by name, by species + form identifier, or by override, never by pokeos id', () => {
        const rows = [
            row(10272, 901, 'Ursaluna-Bloodmoon', 'bloodmoon'),
            row(10600, 25, 'Pikachu-Original', 'original-cap'),
            row(10507, 1024, 'Terapagos-Tera', 'tera')
        ]
        expect(shinyLockedForms(rows, forms, speciesSlug).ids).toEqual(new Set([10450, 10094, 10445]))
    })

    test('ignores unlocked rows and reports locked forms homedex lacks', () => {
        const rows = [row(25, 25, 'Pikachu', '', 0), row(10503, 1024, 'Ogerpon-Teal-Tera', 'teal-mask-tera')]
        expect(shinyLockedForms(rows, forms, speciesSlug)).toEqual({ ids: new Set(), unmatched: ['ogerpon-teal-tera'] })
    })
})
