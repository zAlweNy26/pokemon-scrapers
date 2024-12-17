import * as cheerio from 'cheerio'

interface Type {
    name: string
    strong: string[]
    weak: string[]
    resist: string[]
    immune: string[]
}

const typesUrl = 'https://pokemondb.net/type'

const typesHtml = await fetch(typesUrl).then(res => res.text())
const $ = cheerio.load(typesHtml)

const table = $('table.type-table')

const head = table.find('thead>tr>th>a').slice(1).map((_i, el) => $(el).attr('title')!).toArray()

const body = table.find('tbody>tr').map((_i, el) => {
    const cols = $(el).find('td').slice(1).toArray()
        .map((value, index) => ({ value: $(value).text().trim(), index }))

    const strong = cols.filter(col => col.value === '2').map(col => head[col.index])
    const resist = cols.filter(col => col.value === '').map(col => head[col.index])
    const weak = cols.filter(col => col.value === '½').map(col => head[col.index])
    const immune = cols.filter(col => col.value === '0').map(col => head[col.index])
    const name = $(el).find('th>a').text().trim()
    const type: Type = { name, strong, weak, resist, immune }
    return type
}).toArray()

Bun.write('types.json', JSON.stringify(body, null, 4))