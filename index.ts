import * as cheerio from 'cheerio'
import { basename } from 'node:path'

const ndexUrl = 'https://www.serebii.net/pokemon/nationalpokedex.shtml'

const html = await fetch(ndexUrl).then(res => res.text())

const $ = cheerio.load(html)
const table = $('.dextable')

const rows = table.find('tr').slice(2).filter((_i, el) => $(el).find('td').length > 1)

const values = rows.map((_i, row) => {
    const cols = $(row).find('td')
    const ndex = cols.eq(0).text().trim().substring(1)
    return {
        index: parseInt(ndex),
        ndex,
        name: cols.eq(3).find('a').text().trim(),
        types: cols.eq(4).find('a') .map((_i, el) => 
            basename($(el).prop('href') ?? '')
        ).toArray(),
        stats: {
            hp: parseInt(cols.eq(6).text().trim()),
            atk: parseInt(cols.eq(7).text().trim()),
            def: parseInt(cols.eq(8).text().trim()),
            spAtk: parseInt(cols.eq(9).text().trim()),
            spDef: parseInt(cols.eq(10).text().trim()),
            spd: parseInt(cols.eq(11).text().trim())
        }
    }
}).toArray()

console.log('Pokémon :', values.length)

Bun.write('./pokedex.json', JSON.stringify(values, null, 2))