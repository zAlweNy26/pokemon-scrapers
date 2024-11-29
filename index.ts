import * as cheerio from 'cheerio'
import { parse } from 'node:path'

const homeUrls = [
    'https://www.serebii.net/pokemonhome/kantopokemon.shtml',
    'https://www.serebii.net/pokemonhome/johtopokemon.shtml',
    'https://www.serebii.net/pokemonhome/hoennpokemon.shtml',
    'https://www.serebii.net/pokemonhome/sinnohpokemon.shtml',
    'https://www.serebii.net/pokemonhome/unovapokemon.shtml',
    'https://www.serebii.net/pokemonhome/kalospokemon.shtml',
    'https://www.serebii.net/pokemonhome/alolapokemon.shtml',
    'https://www.serebii.net/pokemonhome/galarpokemon.shtml',
    'https://www.serebii.net/pokemonhome/hisuipokemon.shtml',
    'https://www.serebii.net/pokemonhome/paldeapokemon.shtml',
    'https://www.serebii.net/pokemonhome/unknownpokemon.shtml',
]

const formInName = ['Gigantamax ', 'Mega ', 'Primal ']

interface Pokemon {
    index: number
    subIndex: number
    ndex: string
    form: string | null
    depositable: boolean
    name: string
    types: string[]
}

const values: Pokemon[] = []

async function fetchGenderDiffs() {
    const html = await fetch('https://www.serebii.net/games/gender.shtml').then(res => res.text())
    const $ = cheerio.load(html)
    const table = $('table.dextable:last')
    const rows = table.find('tr').slice(1).filter((_i, el) => $(el).find('td').length > 1)
    const values: string[] = []
    rows.each((_i, row) => {
        const cols = $(row).find('td')
        const ndex = cols.eq(0).text().trim().substring(1).padStart(4, '0')
        const img = parse(cols.eq(1).find('img').attr('src') ?? '').name.padStart(4, '0')
        values.push(values.includes(ndex) ? img : ndex)
    })
    return values
}

let genderDiffs = await fetchGenderDiffs()

async function fetchPokemons(url: string, selector = 'table') {
    const html = await fetch(url).then(res => res.text())
    const $ = cheerio.load(html)
    const table = $(selector)
    const rows = table.find('tr').slice(3).filter((_i, el) => $(el).find('td').length > 1)
    rows.each((_i, row) => {
        const cols = $(row).find('td')
        const ndex = cols.eq(0).text().trim().substring(1).padStart(4, '0')
        const index = parseInt(ndex)
        if (index === 0 || isNaN(index)) return
        const img = parse(cols.eq(1).find('img').attr('src') ?? '').name.padStart(4, '0')
        const subIndex = values.filter(p => p.ndex === ndex).length
        const name = cols.eq(2).find('a').text().trim() || cols.eq(2).text().trim()
        const types = cols.eq(3).find('a') .map((_i, el) => 
            parse($(el).attr('href') ?? '').name
        ).toArray()
        const depositable = !cols.eq(4).text().trim().includes('Not Depositable')
        const form = name.match(/\(([^)]+)\)/)?.[1] 
            || formInName.find(f => name.startsWith(f))?.trim() 
            || null
        if (form === 'Female') return
        const item = { index, subIndex, ndex, form, depositable, name, types }
        values.push(item)
        const hasGenderDiff = genderDiffs.some(g => [ndex, img].includes(g))
        genderDiffs = genderDiffs.filter(g => ![ndex, img].includes(g))
        if (hasGenderDiff) values.push({ ...item, subIndex: subIndex + 1, form: 'Gender' })
    })
}

for (const url of homeUrls) {
    await fetchPokemons(url)
    console.log(`${parse(url).name} :`, values.length)
}

// Sort by index and then by subIndex
values.sort((a, b) => a.index === b.index ? a.subIndex - b.subIndex : a.index - b.index)

console.log('Pokémon :', values.length)

Bun.write('./pokedex.json', JSON.stringify(values, null, 2))