import * as cheerio from 'cheerio'
import generations from './pokedex.json'
import type { AnyNode } from 'domhandler'
import { SingleBar, Presets } from 'cli-progress'

interface Pokemon {
    index: number
    subIndex: number
    ndex: string
    depositable: boolean
    name: {
        english: string
        japanese: string
        german: string
        french: string
        italian: string
        spanish: string
        korean: string
        chinese: string
        taiwanese: string
    }
    origin: [string, string][]
    category: string
    abilities: [string, boolean][]
    form: string | null
    height: number
    weight: number
    catchRate: number
    friendship: number
    gender: {
        male: number
        female: number
    }
    egg: {
        groups: string[]
        cycles: number
    }
    types: string[]
    stats: {
        hp: number
        atk: number
        def: number
        spAtk: number
        spDef: number
        spd: number
    }
}

const defaultFormNames = {
    "Unown": "Unown (A)", // Only model
    "Cherrim": "Cherrim (Overcast Form)", // Only model
    "Shellos": "Shellos (West Sea)", // Missing form (East Sea)
    "Gastrodon": "Gastrodon (West Sea)", // Missing form (East Sea)
    "Arceus": "Arceus (Normal-Type)",
    "Deerling": "Deerling (Spring Form)", // Only model
    "Sawsbuck": "Sawsbuck (Spring Form)", // Only model
    "Vivillon": "Vivillon (Meadow Pattern)", // Only model
    "Flabébé": "Flabébé (Red Flower)", // Only model
    "Floette": "Floette (Red Flower)", // Only model
    "Florges": "Florges (Red Flower)", // Only model
    "Silvally": "Silvally (Normal-Type)",
    "Sinistea": "Sinistea (Phony Form)", // Missing form (Antique Form)
    "Polteageist": "Polteageist (Phony Form)", // Missing form (Antique Form)
    "Alcremie": "Alcremie (Vanilla Cream)", // TODO: change Alcremie names to "Alcremie (Vanilla Cream - Strawberry Sweet)"
    "Poltchageist": "Poltchageist (Counterfeit Form)", // Missing form (Artisan Form)
    "Sinistcha": "Sinistcha (Unremarkable Form)", // Missing form (Masterpiece Form)
}

const progressBar = new SingleBar({ 
    format: `Scraping pokémons: {bar} {percentage}% | {value}/{total} pokémons`,
    fps: 15,
    hideCursor: true
}, Presets.shades_classic)

console.time('Scraping')

const poks = generations.flatMap(gen => gen.pokemons)
const pokedexUrl = 'https://pokemondb.net/pokedex'

progressBar.start(poks.length, 0)

const depositableUrl = 'https://www.serebii.net/pokemonhome/depositablepokemon.shtml'
const depositableHtml = await fetch(depositableUrl).then(res => res.text())
const dep = cheerio.load(depositableHtml)
const depositableBoxes = dep('td.pkmn').toArray()
const depositable = depositableBoxes.map(box => dep(box).find('img').attr('title')!)

const pokemons: Pokemon[] = []

function getRow<T extends AnyNode>($: cheerio.CheerioAPI, rows: cheerio.Cheerio<T>, name: string) {
    const row = rows.toArray().find(tr => $(tr).find('th').text().toLowerCase().includes(name.toLowerCase()))
    return row ? $(row).find('td') : undefined
}

function chunkArray<T>(arr: T[], chunkSize = 2): T[][] {
    return Array.from(
        { length: Math.ceil(arr.length / chunkSize) },
        (_, i) => arr.slice(i * chunkSize, (i + 1) * chunkSize)
    );
}

const standardizeName = (name: string) => name.toLowerCase().replace(':', '').replaceAll(' ', '-')

for (const pok of poks) {
    const pokUrl = `${pokedexUrl}/${standardizeName(pok.name)}`
    const pokHtml = await fetch(pokUrl).then(res => res.text())
    const $ = cheerio.load(pokHtml)
    const tabs = $('.tabset-basics.sv-tabs-wrapper .sv-tabs-tab-list').children()
    const allVitals = $('.vitals-table>tbody>tr')
    for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i]
        const id = $(tab).attr('href')
        if (!id) continue
        const form = $(tab).text()
        const vitals = $(id).find('.vitals-table>tbody>tr')
        const hasKeys = vitals.map((_i, el) => $(el).find('th').text()).toArray().length > 0
        if (!hasKeys) continue
        const gender = getRow($, vitals, 'gender')?.find('span')
        const [male, female] = gender && gender.length > 0 ? gender.map((_i, el) => parseFloat($(el).text())).toArray() : [0, 0]
        const pokemon: Pokemon = {
            ...pok,
            subIndex: i + 1,
            depositable: depositable.includes(form) || i === 0,
            name: {
                english: getRow($, allVitals, 'english')?.text().trim() || pok.name,
                japanese: getRow($, allVitals, 'japanese')?.text().trim() || '',
                german: getRow($, allVitals, 'german')?.text().trim() || '',
                french: getRow($, allVitals, 'french')?.text().trim() || '',
                italian: getRow($, allVitals, 'italian')?.text().trim() || '',
                spanish: getRow($, allVitals, 'spanish')?.text().trim() || '',
                korean: getRow($, allVitals, 'korean')?.text().trim() || '',
                chinese: getRow($, allVitals, 'chinese (simplified)')?.text().trim() || '',
                taiwanese: getRow($, allVitals, 'chinese (traditional)')?.text().trim() || ''
            },
            abilities: getRow($, vitals, 'abilities')!.find('a').toArray()
                .map(el => 
                    [$(el).text().trim(), !$(el).parent().text()!.includes('hidden')]
                ),
            origin: chunkArray($('dl.etymology').children().toArray())
                .map(([el1, el2]) => 
                    [$(el1).text().trim(), $(el2).text().trim().replaceAll(/‘|’/g, '\'')]
                ),
            types: getRow($, vitals, 'type')!.find('a').map((_i, el) => $(el).text().trim()).toArray(),
            category: getRow($, vitals, 'species')!.text().replace('Pokémon', '').trim(),
            height: parseFloat(getRow($, vitals, 'height')!.text().split(' ')[0]),
            weight: parseFloat(getRow($, vitals, 'weight')!.text().split(' ')[0]),
            catchRate: parseInt(getRow($, vitals, 'catch rate')!.text()) || 0,
            friendship: parseInt(getRow($, vitals, 'base friendship')!.text()) || 0,
            gender: { male, female },
            egg: {
                groups: getRow($, vitals, 'egg groups')!.find('a').map((_i, el) => $(el).text().trim()).toArray(),
                cycles: parseInt(getRow($, vitals, 'egg cycles')!.text()) || 0,
            },
            form: form === pok.name ? null : form.replace(pok.name, '').trim(),
            stats: {
                hp: parseInt(getRow($, vitals, 'hp')!.first().text()),
                atk: parseInt(getRow($, vitals, 'attack')!.first().text()),
                def: parseInt(getRow($, vitals, 'defense')!.first().text()),
                spAtk: parseInt(getRow($, vitals, 'sp. atk')!.first().text()),
                spDef: parseInt(getRow($, vitals, 'sp. def')!.first().text()),
                spd: parseInt(getRow($, vitals, 'speed')!.first().text())
            }
        }
        pokemons.push(pokemon)
    }
    progressBar.increment()
}

progressBar.stop()

console.timeEnd('Scraping')

Bun.write('pokemon_details.json', JSON.stringify(pokemons, null, 4))