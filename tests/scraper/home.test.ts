import { describe, expect, test } from 'bun:test'
import type { FormInfo } from '@/scraper/build'
import { matchEntry } from '@/scraper/match'
import { decodeEntities, parseDepositable } from '@/scraper/serebii'

const cell = (file: string, alt: string) =>
    `<td class="pkmn"><a href="#"><img src="/pokemonhome/pokemon/80/${file}.png" loading="lazy" alt="${alt}" /></a></td>`

describe('parseDepositable', () => {
    test('reads the standard boxes only, with image code and decoded label', () => {
        // The shiny boxes repeat every entry; reading them would double the list.
        const html = `<div id="normal">${cell('052-g', 'Galarian Meowth')}${cell('669', 'Flab&eacute;b&eacute;')}</div>
            <div id="shiny">${cell('052-g', 'Galarian Meowth')}</div>`

        expect(parseDepositable(html)).toEqual([
            { ndex: 52, code: '-g', label: 'Galarian Meowth' },
            { ndex: 669, code: '', label: 'Flabébé' }
        ])
    })

    test('fails loudly when the layout changes instead of returning nothing', () => {
        expect(() => parseDepositable('<html>redesigned</html>')).toThrow(/layout changed/)
        expect(() => parseDepositable('<div id="normal"></div>')).toThrow(/no entries/)
    })

    test('decodes numeric entities too', () => {
        expect(decodeEntities('Pok&#233;mon &amp; &#x2640;')).toBe('Pokémon & ♀')
    })
})

const form = (slug: string, ndex: number, pokemonName: string | null, formName: string | null, isDefault = false): FormInfo => ({
    id: slug.length * 1000 + ndex,
    ndex,
    slug,
    isDefault,
    pokemonName,
    formName,
    speciesName: { 105: 'Marowak', 201: 'Unown', 869: 'Alcremie', 3: 'Venusaur', 678: 'Meowstic' }[ndex]!,
    signature: ''
})

const FORMS = [
    form('marowak', 105, null, null, true),
    form('marowak-alola', 105, 'Alolan Marowak', 'Alolan Form'),
    form('marowak-totem', 105, 'Totem Alolan Marowak', null),
    form('unown-a', 201, 'Unown A', 'A', true),
    form('unown-exclamation', 201, 'Unown !', '!'),
    form('unown-question', 201, 'Unown ?', '?'),
    form('venusaur', 3, null, null, true),
    form('venusaur-mega', 3, 'Mega Venusaur', 'Mega Venusaur'),
    form('meowstic-male', 678, 'Male Meowstic', 'Male', true),
    form('meowstic-female', 678, 'Female Meowstic', 'Female'),
    form('alcremie-vanilla-cream-strawberry-sweet', 869, null, null, true),
    form('alcremie-lemon-cream-star-sweet', 869, null, null),
    form('alcremie-lemon-cream-berry-sweet', 869, null, null)
]

const slugsFor = (ndex: number, code: string, label: string) => {
    const result = matchEntry({ ndex, code, label }, FORMS)
    return result.kind === 'matched' ? result.forms.map((f) => f.slug) : result.kind
}

describe('matchEntry', () => {
    test('prefers the regular regional form over a Totem form', () => {
        // "Totem Alolan Marowak" has fewer words than the real form; counting words picked it.
        expect(slugsFor(105, '-a', 'Alolan Marowak')).toEqual(['marowak-alola'])
    })

    test('keeps forms that differ only by punctuation apart', () => {
        expect(slugsFor(201, '-em', 'Unown !')).toEqual(['unown-exclamation'])
        expect(slugsFor(201, '-qm', 'Unown ?')).toEqual(['unown-question'])
    })

    test('maps a gender difference to the default form, but a real gender form to itself', () => {
        expect(slugsFor(3, '-f', 'Venusaur (Female)')).toEqual(['venusaur'])
        expect(slugsFor(678, '-f', 'Meowstic (Female)')).toEqual(['meowstic-female'])
    })

    test('reads the Alcremie sweet from the image code, which the label omits', () => {
        expect(slugsFor(869, '-lcstar', 'Alcremie Lemon Cream')).toEqual(['alcremie-lemon-cream-star-sweet'])
    })

    test('reports what it cannot resolve rather than guessing', () => {
        expect(slugsFor(869, '-lcplain', 'Alcremie Lemon Cream')).toBe('ambiguous')
        expect(slugsFor(105, '-x', 'Marowak Space Form')).toBe('unmatched')
    })
})
