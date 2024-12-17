import * as cheerio from 'cheerio'
import generations from '../pokedex.json'
import type { AnyNode } from 'domhandler'

interface Pokemon {
    index: number
    subIndex: number
    ndex: string
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

const poks = generations.flatMap(gen => gen.pokemons)
const pokedexUrl = 'https://pokemondb.net/pokedex'

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

for (const pok of poks) {
    const pokUrl = `${pokedexUrl}/${pok.name.toLowerCase()}`
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
        const [male, female] = getRow($, vitals, 'gender')!.find('span').map((_i, el) => parseFloat($(el).text())).toArray()
        const pokemon: Pokemon = {
            ...pok,
            subIndex: i + 1, 
            name: {
                english: getRow($, allVitals, 'english')!.text().trim(),
                japanese: getRow($, allVitals, 'japanese')!.text().trim(),
                german: getRow($, allVitals, 'german')!.text().trim(),
                french: getRow($, allVitals, 'french')!.text().trim(),
                italian: getRow($, allVitals, 'italian')!.text().trim(),
                spanish: getRow($, allVitals, 'spanish')!.text().trim(),
                korean: getRow($, allVitals, 'korean')!.text().trim(),
                chinese: getRow($, allVitals, 'chinese (simplified)')!.text().trim(),
                taiwanese: getRow($, allVitals, 'chinese (traditional)')!.text().trim()
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
            catchRate: parseInt(getRow($, vitals, 'catch rate')!.text()),
            friendship: parseInt(getRow($, vitals, 'base friendship')!.text()),
            gender: { male, female },
            egg: {
                groups: getRow($, vitals, 'egg groups')!.find('a').map((_i, el) => $(el).text().trim()).toArray(),
                cycles: parseInt(getRow($, vitals, 'egg cycles')!.text()),
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
}

Bun.write('pokemon_details.json', JSON.stringify(pokemons, null, 4))