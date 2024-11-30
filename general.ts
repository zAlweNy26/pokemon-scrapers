import * as cheerio from 'cheerio'
import { parse } from 'node:path'

interface Region {
    index: number
    href: string
    name: string
}

interface Pokemon {
    index: number
    subIndex: number
    region: number
    depositable: boolean
    ndex: string
    form: string
    name: string
    types: string[]
}

// Base URL for the Pokémon Home section of Serebii
const homeUrl = 'https://www.serebii.net/pokemonhome'
// They have a trailing space to avoid matching with the pokemon name
const formInName = ['Gigantamax ', 'Mega ', 'Primal ']

// Pokémon with Special Abilities not listed in the table
const specialAbilities = {
    "Darmanitan": "Darmanitan (Zen Mode Ability)",
    "Darmanitan (Galarian Form)": "Darmanitan (Galarian Zen Mode Ability)",
    "Greninja": "Greninja (Battle Bond Ability)",
    "Zygarde": "Zygarde (Power Construct Ability)",
    "Zygarde (10% Forme)": "Zygarde (10% Forme Power Construct Ability)",
    "Rockruff": "Rockruff (Own Tempo Ability)"
  }
  
// Pokémon with missing forms not listed in the table
const missingForms = {
    "Minior": "Minior (Red Core)",
    "Toxtricity (Low Key Form)": "Gigantamax Toxtricity (Low Key Form)"
  }
  

const values: Pokemon[] = []

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
        const name = cols.eq(2).find('a').text().trim() || cols.eq(2).text().trim()
        const types = cols.eq(3).find('a') .map((_i, el) => 
            parse($(el).attr('href') ?? '').name
        ).toArray()
        const depositable = !cols.eq(4).text().trim().includes('Not Depositable')
        const form = name.match(/\(([^)]+)\)/)?.[1] 
            || formInName.find(f => name.startsWith(f))?.trim() 
            || 'Default'
        if (form === 'Female') return
        const item: Pokemon = { index, subIndex, region: region.index, depositable, ndex, name, form, types }
        values.push(item)
        const hasGenderDiff = genderDiffs.some(g => [ndex, img].includes(g))
        genderDiffs = genderDiffs.filter(g => ![ndex, img].includes(g))
        if (hasGenderDiff) values.push({ ...item, subIndex: subIndex + 1, form: 'Gender' })
        const hasSpecialAbility = specialAbilities.hasOwnProperty(name)
        if (hasSpecialAbility) {
            const newName = specialAbilities[name as keyof typeof specialAbilities]
            values.push({ ...item, subIndex: subIndex + 1, name: newName, form: newName.match(/\(([^)]+)\)/)?.[1] || 'Default'})
        }
        const hasMissingForm = missingForms.hasOwnProperty(name)
        if (hasMissingForm) {
            const newName = missingForms[name as keyof typeof missingForms]
            values.push({ ...item, subIndex: subIndex + 1, name: newName, form: newName.match(/\(([^)]+)\)/)?.[1] || 'Default', depositable: !depositable })
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

Bun.write('./pokedex.json', JSON.stringify(values, null, 2))