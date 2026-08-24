import { Mwn } from 'mwn'
import type { PokemonBulbapedia } from '../types'
import type { Parameter } from 'mwn/build/wikitext'

const bot = await Mwn.init({
    apiUrl: 'https://bulbapedia.bulbagarden.net/w/api.php',
    username: Bun.env.BULBAPEDIA_USERNAME,
    password: Bun.env.BULBAPEDIA_PASSWORD,
    userAgent: 'LivingDexTracker 1.0 ([[https://github.com/zAlweNy26/LivingDexTracker]])',
})

let markup = ''

const file = Bun.file('pokemon.txt')
if (await file.exists()) markup = await file.text()

if (!markup) {
    const page = await bot.read('Darmanitan (Pokémon)')
    const content = page.revisions?.[0]?.content
    if (content) {
        markup = content
        await Bun.write('pokemon.txt', content)
    }
}

if (!markup) process.exit(1)

function getParams(markup: string) {
    const wkt = new bot.Wikitext(markup)
    const templates = wkt.parseTemplates({})
    const params = templates.map(t => t.parameters).flat()
    return params
}

function retrieveInfo(params: Parameter[]) {
    const type1Param = params.find(p => p.name === 'type1')
    const type2Param = params.find(p => p.name === 'type2')
    const types: string[] = [type1Param!.value]
    if (type2Param?.value) types.push(type2Param.value)
    const pokemon: Partial<PokemonBulbapedia> = {
        index: parseInt(params.find(p => p.name === 'ndex')!.value),
        name: params.find(p => p.name === 'name')!.value,
        ndex: params.find(p => p.name === 'ndex')!.value,
        category: params.find(p => p.name === 'category')!.value,
        gen: Number(params.find(p => p.name === 'generation')!.value),
        height: Number(params.find(p => p.name === 'height-m')!.value),
        heightUnit: 'm',
        weight: Number(params.find(p => p.name === 'weight-kg')!.value),
        weightUnit: 'kg',
        types,
        catchRate: Number(params.find(p => p.name === 'catchrate')!.value),
        genderRatio: Number(params.find(p => p.name === 'gendercode')!.value), // 255: genderless | 0-254 where 0 is 100% male and 254 is 100% female
        locations: {}
    }
    return pokemon
}

const params = getParams(markup)

const pokInfo = retrieveInfo(params)

console.log(pokInfo)

/*function extractBetween(text: string, startText: string, endText: string) {
    const startIndex = text.indexOf(startText) + startText.length
    const endIndex = text.indexOf(endText, startIndex)
    if (startIndex === -1 || endIndex === -1) throw new Error('Start or end text not found')
    return text.substring(startIndex, endIndex)
}

const romanNumeralMap: Record<string, number> = { I: 1, V: 5, X: 10 }

function romanToDecimal(roman: string) {
    let decimal = 0, prevValue = 0
    for (let i = roman.length - 1; i >= 0; i--) {
        const currentValue = romanNumeralMap[roman[i]]
        if (currentValue < prevValue) decimal -= currentValue
        else decimal += currentValue
        prevValue = currentValue
    }
    return decimal
}

function retrieveLocations(oldPok: Partial<PokemonBulbapedia>, markup: string) {
    const locationsMarkup = markup.split('|}').map(m => m.trim()).filter(Boolean)
    const locations: Record<string, GameLocation[]> = {}
    for (const loc of locationsMarkup) {
        const romanGen = loc.match(/gen=([IVX]+)/)?.[1]
        if (!romanGen) continue
        const decGen = romanToDecimal(romanGen)
        const locs = loc.match(/\[\[(.*?)\]\]/g)?.map(l => l.replace(/\[\[(.*?)\]\]/, '$1'))
        if (!locs) continue
        console.log(decGen, locs)
    }
    const pokemon: Partial<PokemonBulbapedia> = {
        ...oldPok,
        locations,
    }
    return pokemon
}

const locationsMarkup = extractBetween(markup, '===Game locations===', '{{Availability/Footer}}')
const pokLocations = retrieveLocations(pokInfo, locationsMarkup)

console.log(pokLocations)*/