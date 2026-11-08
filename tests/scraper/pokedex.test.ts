import { describe, expect, test } from 'bun:test'
import { availabilityOf, dexEntriesOf, exclusivesOf, gamesOf, unfold } from '@/scraper/pokedex'

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

describe('dexEntriesOf', () => {
    const page = `===[[Pokédex]] entries===
{{Dex/Gen/1|gen=I|reg1=Kanto}}
{{Dex/Entry2|v=Red|v2=Blue|t2=FFF|entry=Adores <sc>circular</sc> objects.}}
{{Dex/Entry1|v=Stadium|entry=Not a main-series game.}}
{{Dex/Gen/1|gen=VII|reg1=Alola}}
{{Dex/Entry1|v=Sun|entry=It lies around all day.}}
{{Dex/Form|Alolan Form}}
{{Dex/Entry1|v=Sun|entry=This {{ScPkmn}} was not originally found in Alola.}}
{{Dex/Gen/1|gen=VIII|reg1=Galar}}
{{Dex/Entry1|v=Sword|entry=It loves to collect shiny things.}}
===Game locations===`

    test('splits shared entries per game, switches forms, and resets at each generation', () => {
        const { rows, skipped } = dexEntriesOf(page, versions, new Set())

        expect(rows).toEqual([
            // Small capitals are the capitals Generations I-III print.
            ['', 'red', 'Adores CIRCULAR objects.'],
            ['', 'blue', 'Adores CIRCULAR objects.'],
            ['', 'sun', 'It lies around all day.'],
            ['Alolan Form', 'sun', 'This POKéMON was not originally found in Alola.'],
            ['', 'sword', 'It loves to collect shiny things.']
        ])
        expect([...skipped]).toEqual(['Stadium'])
    })

    const versionsRS = new Set(['ruby', 'sapphire', 'sword', 'heartgold', 'soulsilver'])

    test("gives each version its own word, and keeps a game's earlier revision apart", () => {
        const { rows, revisions } = dexEntriesOf(
            `===Pokédex entries===
{{Dex/Gen/1|gen=III|reg1=Hoenn}}
{{Dex/Entry2|v=Ruby|v2=Sapphire|entry=<sc>Paras</sc> feeds {{pkmn|food}} to the{{sup/3|R}}/this{{sup/3|S}} host. <small>''(Version 1.0)''</small><br><sc>Paras</sc> feeds this host. <small>''(Versions 1.1 and 1.2)''</small>}}
{{Dex/Entry2|v=HeartGold|v2=SoulSilver|entry=Remedies for lower-back{{sup/4|HG}}/lower back{{sup/4|SS}} pain.}}`,
            versionsRS,
            new Set()
        )
        expect(rows).toEqual([
            ['', 'ruby', 'PARAS feeds this host.'],
            ['', 'sapphire', 'PARAS feeds this host.'],
            ['', 'heartgold', 'Remedies for lower-back pain.'],
            ['', 'soulsilver', 'Remedies for lower back pain.']
        ])
        expect(revisions).toEqual([
            ['', 'ruby', '1.0', 'PARAS feeds food to the host.'],
            ['', 'sapphire', '1.0', 'PARAS feeds food to this host.']
        ])
    })

    test("drops Bulbapedia's notes and its translation of the Japanese text", () => {
        const { rows, revisions } = dexEntriesOf(
            `===Pokédex entries===
{{Dex/Gen/1|gen=VIII|reg1=Galar}}
{{Dex/Entry1|v=Sword|entry=It likes holes. <small>''(English)''</small><br>Its instinct is to bury itself. <small>''(Japanese)''</small>}}`,
            versionsRS,
            new Set()
        )
        expect(rows).toEqual([['', 'sword', 'It likes holes.']])
        expect(revisions).toEqual([])
    })

    test("keeps a misspelling a later release corrected as the earlier revision (Mawile's Ruby 1.0)", () => {
        const { rows, revisions } = dexEntriesOf(
            `===Pokédex entries===
{{Dex/Gen/1|gen=III|reg1=Hoenn}}
{{Dex/Entry1|v=Ruby|entry={{tt|<sc>Mawile</sc>|Misspelled as “Mawhile” in version 1.0, corrected in newer revisions}}'s jaws.}}`,
            versionsRS,
            new Set()
        )
        expect(rows).toEqual([['', 'ruby', "MAWILE's jaws."]])
        expect(revisions).toEqual([['', 'ruby', '1.0', "MAWHILE's jaws."]])
    })

    test("prints each form's type where the game does (Silvally)", () => {
        const page = `===Pokédex entries===
{{Dex/Gen/1|gen=VIII|reg1=Galar}}
{{Dex/Form|''All other forms''}}
{{Dex/Entry1|v=Sword|entry=This is its {{tt|<Type>|matches the type of the form}}-type form.}}`
        const { rows } = dexEntriesOf(page, versionsRS, new Set(), [['Type: Fire', 'Fire'], ['Type: Water', 'Water']])
        expect(rows).toEqual([
            ['Type: Fire', 'sword', 'This is its Fire-type form.'],
            ['Type: Water', 'sword', 'This is its Water-type form.']
        ])
        expect(() => dexEntriesOf(page, versionsRS, new Set())).toThrow()
    })

    test('unfolds forms Bulbapedia folded into one row', () => {
        expect(unfold('Hoenn Cap, Sinnoh Cap, and Alola Cap', 'Traveled the Hoenn/Sinnoh/Alola region.')).toEqual([
            ['Hoenn Cap', 'Traveled the Hoenn region.'],
            ['Sinnoh Cap', 'Traveled the Sinnoh region.'],
            ['Alola Cap', 'Traveled the Alola region.']
        ])
        // One text shared by every form stays one row.
        expect(unfold('Original Cap and Partner Cap', 'It wears a cap.')).toEqual([['Original Cap and Partner Cap', 'It wears a cap.']])
        expect(unfold('Galarian Form/Zen Mode', 'A/B test')).toEqual([['Galarian Form/Zen Mode', 'A/B test']])
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
