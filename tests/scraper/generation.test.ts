import { expect, test } from 'bun:test'
import { debutYearsOf } from '@/scraper/build'

// Rows of Bulbapedia's Generation table, trimmed to the cells before the main-series games.
test('debutYearsOf reads the first release year of each generation', () => {
    const wikitext = `
! style="background: #{{kanto color light}}" rowspan="2" | {{color2|000|Generation I|I}}
| rowspan="2" | {{cat|Generation I Pokémon|151}}
| rowspan="2" | 151
| rowspan="2" | {{2v2|Red|Green}} (1996/&mdash;)<br>{{2v2|Red|Blue}} (&mdash;/1998)
|-
! rowspan="2" style="background: #{{paldea color light}}" | {{color2|000|Generation IX|IX}}
| rowspan="2" style="background: #FFF" | {{cat|Generation IX Pokémon|120}}
| rowspan="2" style="background: #FFF" | 120
| rowspan="2" style="background: #FFF" | {{pkmn|Scarlet and Violet}} (2022)<br>[[The Hidden Treasure of Area Zero]] (2023)
|-
! rowspan="2" | {{color2|000|Generation X|X}}
| rowspan="2" | {{cat|Generation X Pokémon|{{PAGESINCATEGORY:Generation X Pokémon|pages}}}}
| rowspan="2" | {{numpkmn}}
| rowspan="2" | {{pkmn|Winds and Waves}} (2027)`

    expect([...debutYearsOf(wikitext)]).toEqual([['generation-i', 1996], ['generation-ix', 2022], ['generation-x', 2027]])
})
