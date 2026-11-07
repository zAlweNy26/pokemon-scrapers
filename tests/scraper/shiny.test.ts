import { describe, expect, test } from 'bun:test'
import type { FormInfo } from '@/scraper/build'
import { shinyRowsOf, shinyTableOf } from '@/scraper/shiny'

// The page's shape: two header rows of `!` cells, then one row per species or form.
const page = (rows: string) => `intro
{| class="roundy sortable"
|-
! rowspan="2" colspan="2" | Pokémon
|-
! I & II
${rows}
|}`

const row = (name: string, cells: string) => `|- style="background:#fff"
| {{MSP/HOME|0000 s|X}}
| ${name}
| ${cells}`

describe('shinyTableOf', () => {
    test('repeats the first column for Generations I and II, spans grey cells, keeps named games', () => {
        const [articuno, zacian] = shinyTableOf(
            page(
                row('{{p|Articuno}}', '{{yes}}<br>{{gameabbrev1|RGBY}} || ~ || {{no}} || ~ || ~ || ~ || ~ || ~') + '\n' +
                    row('{{p|Zacian}}<ref>note</ref>', 'colspan=6 style="background:#999" |  || ~ || {{yes}}<br>{{gameabbrev9|MD}}')
            )
        )

        expect(articuno!.generations.slice(0, 4)).toEqual([
            { status: 'obtainable', games: 'RGBY' },
            { status: 'obtainable', games: 'RGBY' },
            { status: 'event', games: null },
            { status: 'unobtainable', games: null }
        ])
        expect(zacian!.name).toBe('Zacian')
        expect(zacian!.generations).toEqual([
            null, null, null, null, null, null, null, { status: 'event', games: null }, { status: 'obtainable', games: 'MD' }
        ])
    })

    test("drops grey padding past the eighth column, but fails on a row that doesn't add up", () => {
        const padded = row('Partner {{p|Pikachu}}', 'colspan=5 style="background:#999" |  || {{no}} || colspan=5 style="background:#999" |')
        expect(shinyTableOf(page(padded))[0]!.generations[6]).toEqual({ status: 'unobtainable', games: null })
        expect(() => shinyTableOf(page(row('{{p|Mew}}', '~ || ~')))).toThrow(/has 2 generations/)
    })
})

const form = (id: number, slug: string, speciesName: string, formName: string | null): FormInfo => ({
    id, ndex: 0, slug, isDefault: formName === null, pokemonName: null, formName, speciesName, signature: ''
})
const forms = [
    form(1, 'articuno', 'Articuno', null),
    form(2, 'articuno-galar', 'Articuno', 'Galarian Form'),
    form(3, 'vivillon-meadow', 'Vivillon', 'Meadow Pattern'),
    form(4, 'vivillon-fancy', 'Vivillon', 'Fancy Pattern')
]
const status = (generation: 'event' | 'unobtainable') => ({
    generations: [null, null, null, null, null, null, null, { status: generation, games: null }, null]
})

describe('shinyRowsOf', () => {
    test('a bare species row covers only the forms no other row names', () => {
        const { rows, unresolved } = shinyRowsOf(
            [{ name: 'Articuno', ...status('event') }, { name: 'Articuno; Galarian Form', ...status('unobtainable') }],
            forms
        )
        expect(rows).toEqual([[1, 8, 'event', null], [2, 8, 'unobtainable', null]])
        expect(unresolved).toEqual([])
    })

    test('group rows go by slug; rows matching nothing are reported', () => {
        const { rows, unresolved } = shinyRowsOf(
            [
                { name: 'Vivillon; All Patterns; (excluding Fancy & Poké Ball)', ...status('event') },
                { name: 'Vivillon; Ocean Pattern', ...status('event') },
                { name: 'Missingno', ...status('event') }
            ],
            forms
        )
        expect(rows).toEqual([[3, 8, 'event', null]])
        expect(unresolved).toEqual(['Vivillon; Ocean Pattern', 'Missingno'])
    })
})
