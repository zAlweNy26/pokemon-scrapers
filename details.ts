import * as cheerio from 'cheerio'

interface Location {
    game: string
    description: string
}

interface Pokemon {
    index: number
    subIndex: number
    locations: Location[]
}

const values: Pokemon[] = []

const pokedexUrl = 'https://www.serebii.net/pokedex'

const gensPrefixes = ['', '-gs', '-rs', '-dp', '-bw', '-xy', '-sm', '-swsh', '-sv']

/**
 * Retrieve the details of a Pokémon
 * @param gen the generation of the Pokémon
 * @param id can be the national dex number or the name of the Pokémon
 */
async function fetchPokemon(gen: number, id: string) {
    const ext = isNaN(parseInt(id)) ? '' : '.shtml'
    const url = `${pokedexUrl}${gensPrefixes[gen - 1]}/${id}${ext}`
    const html = await fetch(url).then(res => res.text())
    const $ = cheerio.load(html)
    const tables = $('table.dextable')
    const locations: Location[] = []
    const locationsEntries = tables.filter((_i, el) => $(el).text().trim().includes('Locations'))
        .find('tr').slice(1)

    locationsEntries.each((_i, el) => {
        const cols = $(el).find('td').filter((_i, el) => !$(el).text().trim().includes('Details'))
        // get all tds except the last one
        const games = cols.slice(0, -1).map((_i, el) => $(el).text().trim()).toArray()

        games.forEach((game) => {
            locations.push({
                game,
                description: $(el).find('td.fooinfo').text().trim(),
            })
        })
    })

    values.push({
        index: parseInt($('title').text().split('-')[1].trim().substring(1)),
        subIndex: 0,
        locations
    })
}

await fetchPokemon(1, '001')
await fetchPokemon(8, 'rotom')
await fetchPokemon(9, 'koraidon')

Bun.write('./pokemon_details.json', JSON.stringify(values, null, 2))