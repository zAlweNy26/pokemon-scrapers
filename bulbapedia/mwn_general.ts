import { Mwn } from 'mwn'
import type { PokemonBase } from '../types'

const bot = await Mwn.init({
    apiUrl: 'https://bulbapedia.bulbagarden.net/w/api.php',
    username: Bun.env.BULBAPEDIA_USERNAME,
    password: Bun.env.BULBAPEDIA_PASSWORD,
    userAgent: 'LivingDexTracker 1.0 ([[https://github.com/zAlweNy26/LivingDexTracker]])',
})

let markup = ''

const file = Bun.file('bulbapedia.txt')
if (await file.exists()) markup = await file.text()

if (!markup) {
    const page = await bot.read('Ndex')
    const content = page.revisions?.[0]?.content
    if (content) {
        markup = content
        await Bun.write('bulbapedia.txt', content)
    }
}

if (!markup) process.exit(1)

const allTypes = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 
    'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
]

markup = markup.split('===[[Generation I]]===')[1]

const wkt = new bot.Wikitext(markup)
const templates = wkt.parseTemplates({})

const pokemons: PokemonBase[] = []

let gen = 0
for (const template of templates) {
    const ndex = template.getValue(1)
    if (!ndex) continue
    const index = parseInt(ndex)
    if (isNaN(index)) gen++
    else if (!pokemons.some(p => p.ndex === ndex)) {
        const name = template.getValue(2)
        if (!name) continue
        const types = template.parameters.map(p => p.value).filter(v => allTypes.includes(v))
        pokemons.push({ index, gen, ndex, name, types })
    }
}

console.log('Pokemons:', pokemons.length)

Bun.write('bulbapedia.json', JSON.stringify(pokemons, null, 4))
