import { describe, expect, test } from 'bun:test'
import { availabilityOf, exclusivesOf, gamesOf } from '@/scraper/pokedex'

const versions = new Set(['red', 'blue', 'blue-japan', 'sun', 'lets-go-pikachu', 'sword', 'shield', 'scarlet', 'violet', 'legends-za'])

describe('gamesOf', () => {
    test('maps Bulbapedia labels to PokéAPI versions', () => {
        expect(gamesOf("Let's Go Pikachu", undefined, versions)).toEqual([{ game: 'lets-go-pikachu', dlc: null }])
        expect(gamesOf('Legends: Z-A', undefined, versions)).toEqual([{ game: 'legends-za', dlc: null }])
        expect(gamesOf('Blue', '(Japan)', versions)).toEqual([{ game: 'blue-japan', dlc: null }])
    })

    test('puts a DLC under each game it extends', () => {
        expect(gamesOf('Expansion Pass', undefined, versions)).toEqual([
            { game: 'sword', dlc: 'expansion-pass' },
            { game: 'shield', dlc: 'expansion-pass' }
        ])
        expect(gamesOf('Mega Dimension', undefined, versions)).toEqual([{ game: 'legends-za', dlc: 'mega-dimension' }])
    })

    test('drops what is not a main-series game', () => {
        expect(gamesOf('Stadium', undefined, versions)).toEqual([])
        expect(gamesOf('Pal Park', undefined, versions)).toEqual([])
    })
})

describe('availabilityOf', () => {
    const page = `==={{pkmn|games|Game}} locations===
{{Availability/Entry1|v=Blue|1|area=[[Route]]s {{rtn|5|Kanto}} and {{rtn|6|Kanto}}}}
{{Availability/Entry1|v=Blue|1|ex=(Japan)|area=[[Route]] {{rtn|5|Kanto}}}}
{{Availability/Entry1/None|1|v=Red}}
{{Availability/Entry2|v=Sword|v2=Shield|area=[[Trade]]<sup>Version 1.2.0+</sup> <small>('''Alolan Form''')</small><br>{{rt|4|Galar}}}}
{{Availability/Entry1|v=Expansion Pass|color={{Isle of Armor color}}|area=[[Isle of Armor]]}}
{{Availability/Entry1|v=Scarlet|area={{rt|1|Paldea}}}}
{{Availability/Entry1/None|v=Scarlet|area=[[Trade]]}}
{{Availability/Entry1|v=Violet|area={{rt|1|Paldea}}}}
{{Availability/Entry1|v=Violet|area={{pkmn|breeding|Breed}} {{p|Raichu}}}}
{{Availability/Entry1|v=Shuffle|area=Stage 1}}
===In side games===
{{Availability/Entry1|v=Sword|area=Not this section}}`

    test('reads every main-series game in the section, DLC and grey rows included', () => {
        const { rows, skipped } = availabilityOf(page, versions, new Set())

        expect(rows).toEqual([
            ['blue', '', 'Routes 5 and 6', true],
            ['blue-japan', '', 'Route 5', true],
            ['red', '', null, false],
            ['sword', '', 'Trade (Version 1.2.0+) (Alolan Form); Route 4', true],
            ['shield', '', 'Trade (Version 1.2.0+) (Alolan Form); Route 4', true],
            ['sword', 'expansion-pass', 'Isle of Armor', true],
            ['shield', 'expansion-pass', 'Isle of Armor', true],
            // A game listed twice: an obtainable row beats a grey one; two obtainable ones merge.
            ['scarlet', '', 'Route 1', true],
            ['violet', '', 'Route 1; Breed Raichu', true]
        ])
        expect([...skipped]).toEqual(['Shuffle'])
    })

    test('an unclosed <sup> note runs to the end of the cell, in parentheses like a closed one', () => {
        const unclosed = `==={{pkmn|games|Game}} locations===
{{Availability/Entry1/None|v=Sword|area=[[Trade]]<sup>Version 1.3.0+}}`

        expect(availabilityOf(unclosed, versions, new Set()).rows).toEqual([['sword', '', 'Trade (Version 1.3.0+)', false]])
    })
})

describe('exclusivesOf', () => {
    const siblings = new Map([['scarlet', ['violet']], ['violet', ['scarlet']], ['legends-arceus', []]])

    test('obtainable in one version of the pair only, DLC rows included', () => {
        const rows = [
            [1, 'scarlet', '', 'Area One', true],
            [1, 'violet', '', null, false],
            [2, 'scarlet', '', null, false],
            [2, 'scarlet', 'the-hidden-treasure-of-area-zero', 'Kitakami', true],
            [3, 'scarlet', '', 'Area One', true],
            [3, 'violet', 'the-hidden-treasure-of-area-zero', 'Kitakami', true]
        ] as const
        expect(exclusivesOf(rows, siblings)).toEqual(new Set(['1|scarlet', '2|scarlet']))
    })

    test('a version alone in its group has no exclusives', () => {
        expect(exclusivesOf([[1, 'legends-arceus', '', 'Fieldlands', true]], siblings)).toEqual(new Set())
    })
})
