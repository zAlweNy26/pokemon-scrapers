import * as cheerio from 'cheerio'

const pokedexUrl = 'https://pokemondb.net/pokedex/national'

const pokedexHtml = await fetch(pokedexUrl).then(res => res.text())
const $ = cheerio.load(pokedexHtml)

const gens = $('main>h2')

interface Pokemon {
    index: number
    ndex: string
    name: string
    types: string[]
}

interface Generation {
    index: number
    count: number
    pokemons: Pokemon[]
}

const generations: Generation[] = []

for (const gen of gens) {
    const num = $(gen).attr('id')?.replace('gen-', '')
    if (!num) continue
    const sibling = $(gen).next()
    // count children of sibling
    const children = sibling.children()
    const count = children.length
    const pokemons: Pokemon[] = []
    for (const child of children) {
        const el = $(child, '.infocard-lg-data')
        const ndex = el.find('small:first-child').text()
        const index = parseInt(ndex.substring(1))
        const name = el.find('.ent-name').text()
        const types = el.find('.itype').map((_i, el) => $(el).text()).toArray()
        const pokemon: Pokemon = { index, ndex, name, types }
        pokemons.push(pokemon)
    }
    generations.push({ index: parseInt(num), count, pokemons })
}

Bun.write('pokedex.json', JSON.stringify(generations, null, 4))