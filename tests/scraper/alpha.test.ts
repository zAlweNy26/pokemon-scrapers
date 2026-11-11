import { describe, expect, test } from 'bun:test'
import type { FormInfo } from '@/scraper/build'
import { alphaFormsOf, legendsArceusAlphas, zaAlphaRowsOf } from '@/scraper/alpha'

const row = (ndex: string, name: string, move: string, form = '') => `|-
| style="font-family: monospace, monospace;" | #${ndex}
| {{p|${name}}} || {{MSP/ZA|${ndex}|${name}${form ? `|form=${form}` : ''}}}
| {{m|${move}}}`

describe('zaAlphaRowsOf', () => {
    test('a starred move means the row is never a wild alpha', () => {
        const filler = Array.from({ length: 300 }, (_, i) => row(String(2000 + i), 'X', 'Tackle')).join('\n')
        const rows = zaAlphaRowsOf(
            [row('0052', 'Meowth', 'Fake Out'), row('0052', 'Meowth', 'Night Slash', '-Galar'), row('0670', 'Floette', 'Protect', '-Eternal') + '*', filler].join('\n')
        )

        expect(rows.get('52')).toBe(true)
        expect(rows.get('52-Galar')).toBe(true)
        expect(rows.get('670-Eternal')).toBe(false)
    })

    test('a second row with the same sprite is the form its label names, not an overwrite', () => {
        const filler = Array.from({ length: 300 }, (_, i) => row(String(2000 + i), 'X', 'Tackle')).join('\n')
        const battleBond = row('0658', 'Greninja', 'Gunk Shot').replace('{{p|Greninja}} ||', '{{p|Greninja}}<br><small>Battle Bond</small> ||')
        const rows = zaAlphaRowsOf([row('0658', 'Greninja', 'Blizzard'), battleBond + '*', filler].join('\n'))

        expect(rows.get('658')).toBe(true)
        expect(rows.get('658-Battle-Bond')).toBe(false)
        // Battle Bond Greninja is in the game: named by its own row, it is not covered by the species row.
        expect([...alphaFormsOf(rows, forms, new Set([10116]))].filter((id) => id === 658 || id === 10116)).toEqual([658])
    })

    test('fails when the table is gone', () => {
        expect(() => zaAlphaRowsOf('nothing')).toThrow(/layout changed/)
    })
})

const form = (id: number, ndex: number, slug: string, isDefault = false): FormInfo => ({
    id, ndex, slug, isDefault, pokemonName: null, formName: null, speciesName: '', signature: ''
})
const forms = [
    form(52, 52, 'meowth', true), form(10107, 52, 'meowth-alola'), form(10161, 52, 'meowth-galar'),
    form(670, 670, 'floette-red', true), form(10061, 670, 'floette-eternal'), form(10062, 670, 'floette-blue'),
    form(658, 658, 'greninja', true), form(10116, 658, 'greninja-battle-bond'),
    form(38, 38, 'ninetales', true), form(10104, 38, 'ninetales-alola'), form(150, 150, 'mewtwo', true)
]

describe('alphaFormsOf', () => {
    test('a form row is that form; a species row its default and its other forms in the game', () => {
        const rows = new Map([['52', true], ['52-Galar', true], ['670', true], ['670-Eternal', false]])
        // Alolan Meowth is in the game but has no row of its own, so the species row covers it.
        const ids = alphaFormsOf(rows, forms, new Set([10107, 10062, 10061]))

        expect([...ids].sort()).toEqual([52, 670, 10062, 10107, 10161].sort())
    })

    test('a form parameter that matches no form fails', () => {
        expect(() => alphaFormsOf(new Map([['52-Paldea', true]]), forms, new Set())).toThrow(/no form for 52-Paldea/)
    })
})

describe('legendsArceusAlphas', () => {
    test('everything in the game but legendaries, mythicals and gift-only Alolan Ninetales', () => {
        const ids = legendsArceusAlphas(forms, new Set([38, 10104, 150, 52]), new Set([150]))
        expect([...ids].sort()).toEqual([38, 52])
    })
})
