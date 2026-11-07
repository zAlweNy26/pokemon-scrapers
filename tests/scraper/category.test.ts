import { describe, expect, test } from 'bun:test'
import { categoryOf, type FormInfo } from '@/scraper/build'

const form = (slug: string, formName: string | null, signature = 'base', isDefault = false): FormInfo => ({
    id: 1, ndex: 1, slug, isDefault, pokemonName: null, formName, speciesName: 'X', signature
})
const facts = { battleOnly: false, identifier: '', switchable: false }
const base = form('x', null, 'base', true)

describe('categoryOf', () => {
    test('the default form wins over every other rule', () => {
        expect(categoryOf(base, { ...facts, battleOnly: true, switchable: true }, base)).toBe('default')
    })

    test('battle-only beats regional: Galarian Zen Darmanitan', () => {
        expect(categoryOf(form('darmanitan-galar-zen', 'Galarian Form'), { ...facts, battleOnly: true }, base)).toBe('battle-only')
    })

    test('regional by the English form name, not the slug', () => {
        expect(categoryOf(form('vulpix-alola', 'Alolan Form', 'other'), facts, base)).toBe('regional')
        expect(categoryOf(form('pikachu-alola-cap', 'Alola Cap'), facts, base)).toBe('cosmetic')
    })

    test("a gender's own form, then switchable, then cosmetic or variant by types and stats", () => {
        expect(categoryOf(form('meowstic-female', null, 'other'), { ...facts, identifier: 'female' }, base)).toBe('gender')
        expect(categoryOf(form('rotom-wash', null, 'other'), { ...facts, switchable: true }, base)).toBe('switchable')
        expect(categoryOf(form('unown-b', 'B'), facts, base)).toBe('cosmetic')
        expect(categoryOf(form('lycanroc-midnight', 'Midnight Form', 'other'), facts, base)).toBe('variant')
    })
})
