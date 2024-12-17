import * as cheerio from 'cheerio'
import { parse } from 'node:path'
import type { PokemonSerebii, Region } from '../types'

// Base URL for the Pokémon Home section of Serebii
const homeUrl = 'https://www.serebii.net/pokemonhome'
// They have a trailing space to avoid matching with the pokemon name
const formInName = ['Gigantamax ', 'Mega ', 'Primal ']

// Pokémon with Special Abilities not listed in the table
const specialAbilities = {
    "Darmanitan": "Darmanitan (Zen Mode Ability)",
    "Darmanitan (Galarian Form)": "Darmanitan (Galarian Zen Mode Ability)",
    "Greninja": "Greninja (Battle Bond Ability)",
    "Zygarde (50% Forme)": "Zygarde (50% Forme Power Construct Ability)",
    "Zygarde (10% Forme)": "Zygarde (10% Forme Power Construct Ability)",
    "Rockruff": "Rockruff (Own Tempo Ability)"
}

// Pokémon with missing forms not listed in the table
const missingForms = {
    "Minior (Meteor)": "Minior (Red Core)",
    "Toxtricity (Low Key Form)": "Gigantamax Toxtricity (Low Key Form)"
}

// Pokémon with wrong default forms names
const defaultFormsNames = {
    "Unown": "Unown (A)",
    // "Castform": "Castform (Normal Form)", //or "Castform (Normal)"
    "Deoxys": "Deoxys (Normal Forme)",
    "Burmy": "Burmy (Plant Cloak)",
    "Wormadam": "Wormadam (Plant Cloak)",
    "Cherrim": "Cherrim (Overcast Form)",
    "Shellos": "Shellos (West Sea)",
    "Gastrodon": "Gastrodon (West Sea)",
    // Kept "Rotom" instead of "Rotom (Normal Forme)"
    // Kept "Dialga" instead of "Dialga (Standard Forme)"
    // Kept "Palkia" instead of "Palkia (Standard Forme)"
    "Giratina": "Giratina (Altered Forme)",
    "Shaymin": "Shaymin (Land Forme)",
    "Arceus": "Arceus (Normal-Type)",
    "Basculin": "Basculin (Red-Striped Form)",
    // Kept "Darmanitan" instead of "Darmanitan (Standard Mode)"
    "Deerling": "Deerling (Spring Form)",
    "Sawsbuck": "Sawsbuck (Spring Form)",
    "Tornadus": "Tornadus (Incarnate Forme)",
    "Thundurus": "Thundurus (Incarnate Forme)",
    "Landorus": "Landorus (Incarnate Forme)",
    "Keldeo": "Keldeo (Ordinary Form)",
    "Meloetta": "Meloetta (Aria Forme)",
    // Kept "Genesect" instead of "Genesect (No Drive)"
    "Vivillon": "Vivillon (Meadow Pattern)",
    "Flabébé": "Flabébé (Red Flower)",
    "Floette": "Floette (Red Flower)",
    "Florges": "Florges (Red Flower)",
    // Kept "Furfrou" instead of "Furfrou (Natural Form)"
    "Aegislash": "Aegislash (Shield Forme)",
    "Pumpkaboo": "Pumpkaboo (Average Size)",
    "Gourgeist": "Gourgeist (Average Size)",
    "Xerneas": "Xerneas (Neutral Mode)",
    "Zygarde": "Zygarde (50% Forme)",
    "Hoopa": "Hoopa (Hoopa Confined)",
    "Oricorio": "Oricorio (Baile Style)",
    "Lycanroc": "Lycanroc (Midday Form)",
    "Wishiwashi": "Wishiwashi (Solo Form)",
    "Silvally": "Silvally (Normal-Type)", // TODO: change Silvally names to "Silvally (Type: Normal)"
    "Minior": "Minior (Meteor)",
    "Mimikyu": "Mimikyu (Disguised Form)",
    "Toxtricity": "Toxtricity (Amped Form)",
    "Sinistea": "Sinistea (Phony Form)",
    "Sinistea (Authentic Form)": "Sinistea (Antique Form)",
    "Polteageist": "Polteageist (Phony Form)",
    "Polteageist (Authentic Form)": "Polteageist (Antique Form)",
    "Alcremie": "Alcremie (Vanilla Cream)", // TODO: change Alcremie names to "Alcremie (Vanilla Cream - Strawberry Sweet)"
    "Eiscue": "Eiscue (Ice Face)",
    "Morpeko": "Morpeko (Full Belly Mode)",
    "Zacian": "Zacian (Hero of Many Battles)",
    "Zamazenta": "Zamazenta (Hero of Many Battles)",
    "Urshifu": "Urshifu (Single Strike Style)", //TODO: change Gigantamax Urshifu names to "Gigantamax Urshifu (Single Strike Style)" and "Gigantamax Urshifu (Rapid Strike Style)"
    "Enamorus": "Enamorus (Incarnate Forme)",
    "Maushold": "Maushold (Family of Three)",
    "Squawkabilly": "Squawkabilly (Green Plumage)",
    "Palafin": "Palafin (Zero Form)",
    "Tatsugiri": "Tatsugiri (Curly Form)",
    "Dudunsparce": "Dudunsparce (Two-Segment Form)",
    "Gimmighoul": "Gimmighoul (Chest Form)",
    "Ogerpon": "Ogerpon (Teal Mask)",
    "Poltchageist": "Poltchageist (Counterfeit Form)",
    "Sinistcha": "Sinistcha (Unremarkable Form)",
}

const gensRanges = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]]

const getGenFromNdex = (ndex: number) => {
    for (const [gen, [min, max]] of gensRanges.entries()) {
        if (ndex >= min && ndex <= max) return gen
    }
    return -1
}

const values: PokemonSerebii[] = []

async function fetchRegions(): Promise<Region[]> {
    const regionsHtml = await fetch(`${homeUrl}/pokemon.shtml`).then(res => res.text())
    const $ = cheerio.load(regionsHtml)
    const regions = $('main>div').find('a')
    return regions.map((i, el) => ({
        index: i,
        href: $(el).attr('href') ?? '',
        name: $(el).text().trim()
    })).toArray()
}

const regions = await fetchRegions()

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

async function fetchPokemons(region: Region, selector = 'table') {
    const html = await fetch(`${homeUrl}/${region.href}`).then(res => res.text())
    const $ = cheerio.load(html)
    const table = $(selector)
    const rows = table.find('tr').slice(3).filter((_i, el) => $(el).find('td').length > 1)
    rows.each((_i, row) => {
        const cols = $(row).find('td')
        const ndex = cols.eq(0).text().trim().substring(1).padStart(4, '0')
        const index = parseInt(ndex) - 1
        if (index === null || isNaN(index)) return
        const img = parse(cols.eq(1).find('img').attr('src') ?? '').name.padStart(4, '0')
        const subIndex = values.filter(p => p.ndex === ndex).length
        let name = cols.eq(2).find('a').text().trim() || cols.eq(2).text().trim()
        if (name in defaultFormsNames) name = defaultFormsNames[name as keyof typeof defaultFormsNames]
        const types = cols.eq(3).find('a').map((_i, el) =>
            parse($(el).attr('href') ?? '').name
        ).toArray()
        const depositable = !cols.eq(4).text().trim().includes('Not Depositable')
        const form = name.match(/\(([^)]+)\)/)?.[1]
            || formInName.find(f => name.startsWith(f))?.trim()
            || 'Default'
        if (form === 'Female') return
        const gen = getGenFromNdex(index)
        const item: PokemonSerebii = { index, subIndex, region: region.index, gen, depositable, ndex, name, form, types }
        values.push(item)

        const hasGenderDiff = genderDiffs.some(g => [ndex, img].includes(g))
        genderDiffs = genderDiffs.filter(g => ![ndex, img].includes(g))
        if (hasGenderDiff) values.push({ ...item, subIndex: subIndex + 1, form: 'Gender' })

        if (name in specialAbilities) {
            const newName = specialAbilities[name as keyof typeof specialAbilities]
            const form = newName.match(/\(([^)]+)\)/)?.[1] || 'Default'
            values.push({ ...item, subIndex: subIndex + 1, name: newName, form })
        }

        if (name in missingForms) {
            const newName = missingForms[name as keyof typeof missingForms]
            const form = newName.match(/\(([^)]+)\)/)?.[1] || 'Default'
            values.push({ ...item, subIndex: subIndex + 1, name: newName, form, depositable: false })
        }
    })
}

for (const region of regions) {
    await fetchPokemons(region)
    console.log(`${region.name} :`, values.filter(p => p.region === region.index).length)
}

// Sort by index and then by subIndex
values.sort((a, b) => a.index === b.index ? a.subIndex - b.subIndex : a.index - b.index)

console.log('\nTotal Pokémons :', values.length)

Bun.write('pokedex.json', JSON.stringify(values, null, 2))