import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'

interface Location {
    game: string
    description: string
}

interface Stats {
    hp: number
    atk: number
    def: number
    spAtk: number
    spDef: number
    spd: number
}

interface Pokemon {
    index: number
    subIndex: number
    locations: Location[]
    stats: Stats
}

const values: Pokemon[] = []

const pokedexUrl = 'https://www.serebii.net/pokedex'

const gensPrefixes = ['', '-gs', '-rs', '-dp', '-bw', '-xy', '-sm', '-swsh', '-sv']

const getTableEntries = <T extends AnyNode>($: cheerio.CheerioAPI, table: cheerio.Cheerio<T>, title: string) => {
    return table.filter((_i, el) => 
        $(el).find('td').length > 1 &&
        $(el).text().trim().includes(title)
    ).find('tr')
}

async function fetchPokemon(gen: number, id: string) {
    const ext = isNaN(parseInt(id)) ? '' : '.shtml'
    const url = `${pokedexUrl}${gensPrefixes[gen - 1]}/${id}${ext}`
    const html = await fetch(url).then(res => res.text())
    const $ = cheerio.load(html)
    const tables = $('table.dextable')
    const locations: Location[] = []
    const locationsEntries = getTableEntries($, tables, 'Locations').slice(1)

    locationsEntries.each((_i, el) => {
        const cols = $(el).find('td').filter((_i, el) => !$(el).text().trim().includes('Details'))
        const games = cols.slice(0, -1).map((_i, el) => $(el).text().trim()).toArray()

        games.forEach((game) => {
            const description = $(el).find('td.fooinfo').text().trim()
            if (!description) return
            locations.push({ game, description })
        })
    })

    const statsEntries = $(getTableEntries($, tables, 'Stats').slice(2)[0]).find('td').slice(1)
    const stats: Stats = { 
        hp: parseInt(statsEntries.eq(0).text().trim()),
        atk: parseInt(statsEntries.eq(1).text().trim()),
        def: parseInt(statsEntries.eq(2).text().trim()),
        spAtk: parseInt(statsEntries.eq(3).text().trim()),
        spDef: parseInt(statsEntries.eq(gen === 1 ? 3 : 4).text().trim()),
        spd: parseInt(statsEntries.eq(gen === 1 ? 4 : 5).text().trim())
    }

    values.push({
        index: parseInt($('title').text().split('-')[1].trim().substring(1)),
        subIndex: 0, // TODO: Find a way to get this value
        locations,
        stats
    })
}

await fetchPokemon(1, '001')
await fetchPokemon(5, '555')
await fetchPokemon(9, 'koraidon')

Bun.write('./pokemon_details.json', JSON.stringify(values, null, 2))