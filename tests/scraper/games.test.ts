import { describe, expect, test } from 'bun:test'
import type { FormInfo } from '@/scraper/build'
import { availabilityPages, homeGames, parseGameCodes, type GameEvidence } from '@/scraper/games'
import { colorTemplateOf } from '@/scraper/bulbapedia'

const SAME = 'same-types-and-stats'

let nextId = 1
const form = (slug: string, ndex: number, options: Partial<FormInfo> = {}): FormInfo => ({
    id: nextId++,
    ndex,
    slug,
    isDefault: false,
    pokemonName: null,
    formName: null,
    speciesName: slug.split('-')[0]!,
    signature: SAME,
    ...options
})

const F = {
    growlithe: form('growlithe', 58, { isDefault: true }),
    growlitheHisui: form('growlithe-hisui', 58, { formName: 'Hisuian Form', signature: 'fire-rock' }),
    meowth: form('meowth', 52, { isDefault: true }),
    meowthGalar: form('meowth-galar', 52, { formName: 'Galarian Form', signature: 'steel' }),
    meowthAlola: form('meowth-alola', 52, { formName: 'Alolan Form', signature: 'dark' }),
    pikachu: form('pikachu', 25, { isDefault: true }),
    pikachuAlolaCap: form('pikachu-alola-cap', 25, { formName: 'Alola Cap' }),
    rotom: form('rotom', 479, { isDefault: true }),
    rotomWash: form('rotom-wash', 479, { formName: 'Wash Rotom', signature: 'electric-water' }),
    miniorMeteor: form('minior-red-meteor', 774, { isDefault: true }),
    miniorRed: form('minior-red', 774, { formName: 'Red Core', signature: 'core' }),
    zygarde: form('zygarde-50', 718, { isDefault: true }),
    zygardePc: form('zygarde-50-power-construct', 718),
    zygarde10: form('zygarde-10', 718, { signature: 'ten-percent' }),
    darkrai: form('darkrai', 491, { isDefault: true }),
    mew: form('mew', 151, { isDefault: true })
}
const FORMS = Object.values(F)
const DEPOSITABLE = new Set(FORMS.filter((f) => f !== F.miniorMeteor).map((f) => f.id))
const BY_CODE = new Map<string, FormInfo[]>([
    ['58', [F.growlithe]], ['58-h', [F.growlitheHisui]],
    ['52', [F.meowth]], ['52-g', [F.meowthGalar]], ['52-a', [F.meowthAlola]],
    ['25', [F.pikachu]], ['25-a', [F.pikachuAlolaCap]],
    ['479', [F.rotom]],
    ['774-r', [F.miniorRed]], // '774' (Meteor Form) is not storable, so unknown
    ['718', [F.zygarde, F.zygardePc]], ['718-10', [F.zygarde10]],
    ['491', [F.darkrai]], ['151', [F.mew]]
])

const gamesOf = (evidence: Record<string, GameEvidence>) => {
    const rows = homeGames(FORMS, DEPOSITABLE, BY_CODE, new Map(Object.entries(evidence)))
    return (f: FormInfo) => rows.filter(([id]) => id === f.id).map(([, game]) => game).sort()
}

const codes = (...list: string[]) => new Set(list)

describe('homeGames', () => {
    test('a regional form needs evidence for its own region, and does not bring the default', () => {
        // Legends: Arceus holds Hisuian Growlithe only.
        const games = gamesOf({ 'legends-arceus': { codes: codes('58-h') } })

        expect(games(F.growlitheHisui)).toEqual(['legends-arceus'])
        expect(games(F.growlithe)).toEqual([])
    })

    test('speciesFollowsRegions: regional evidence also brings the default form', () => {
        // Sword/Shield's pages show only the Galarian icon, but the game holds Kantonian Meowth too.
        const games = gamesOf({ 'sword-shield': { codes: codes('52-g'), speciesFollowsRegions: ['galar'] } })

        expect(games(F.meowth)).toEqual(['sword-shield'])
        expect(games(F.meowthGalar)).toEqual(['sword-shield'])
        expect(games(F.meowthAlola)).toEqual([])
    })

    test('regionsFollowSpecies: regional forms follow the species', () => {
        const games = gamesOf({ 'lets-go': { codes: codes('52'), regionsFollowSpecies: ['alola'] } })

        expect(games(F.meowthAlola)).toEqual(['lets-go'])
        expect(games(F.meowthGalar)).toEqual([])
    })

    test('forms: a form named by slug is in the game though no page or rule brings it', () => {
        // Legends: Arceus gives Alolan Vulpix and Ninetales as gifts; its pages show only Kantonian icons.
        const games = gamesOf({ 'legends-arceus': { codes: codes('52'), forms: ['meowth-alola'] } })

        expect(games(F.meowthAlola)).toEqual(['legends-arceus'])
        expect(games(F.meowthGalar)).toEqual([])
    })

    test('a form is regional by name, not slug: Alola Cap Pikachu is cosmetic', () => {
        // Shown for one game, absent from another: the absent game does not support it.
        const games = gamesOf({ 'sword-shield': { codes: codes('25', '25-a') }, bdsp: { codes: codes('25') } })

        expect(games(F.pikachuAlolaCap)).toEqual(['sword-shield'])
        expect(games(F.pikachu)).toEqual(['bdsp', 'sword-shield'])
    })

    test('an alternate form no page lists follows its species', () => {
        expect(gamesOf({ sv: { codes: codes('479') } })(F.rotomWash)).toEqual(['sv'])
    })

    test('a plain dex number puts the species in the game even when HOME cannot store that form', () => {
        // Scarlet/Violet shows Minior's Meteor Form icon; its cores still follow.
        expect(gamesOf({ sv: { codes: codes('774') } })(F.miniorRed)).toEqual(['sv'])
    })

    test('a plain code shared by two entries is not form-by-form listing', () => {
        // Serebii uses "718" for both Zygarde and Zygarde Power Construct.
        const games = gamesOf({ swsh: { codes: codes('718') } })

        expect(games(F.zygarde10)).toEqual(['swsh'])
        expect(games(F.zygardePc)).toEqual(['swsh'])
    })

    test('a game that lists a species form by form keeps only what it shows', () => {
        const games = gamesOf({ za: { codes: codes('718', '718-10') }, sv: { codes: codes('774', '774-r') } })

        expect(games(F.zygarde10)).toEqual(['za'])
        expect(games(F.zygardePc)).toEqual(['za'])
        expect(games(F.miniorRed)).toEqual(['sv'])
    })

    test('nationalDexUpTo covers species no page shows; forms HOME cannot store never get a game', () => {
        const games = gamesOf({ bdsp: { codes: codes('151'), nationalDexUpTo: 493 } })

        expect(games(F.darkrai)).toEqual(['bdsp'])
        expect(games(F.miniorMeteor)).toEqual([])
    })
})

describe('parseGameCodes', () => {
    test('reads sprites from game folders and Pokédex icons, ignoring everything else', () => {
        const html = `
            <img src="/scarletviolet/pokemon/new/small/128-p.png">
            <img src="/swordshield/pokemon/small/052.png">
            <img src="/pokedex-swsh/icon/251.png">
            <img src="/pokedex-bw/type/fire.png"><img src="/scarletviolet/items/potion.png">`

        expect([...parseGameCodes(html)].sort()).toEqual(['128-p', '251', '52'])
    })
})

describe('availabilityPages', () => {
    // Link texts as Serebii's game indexes print them.
    test('takes the Pokédex, available and transfer lists of its own folder', () => {
        const html = `
            <a href="/swordshield/pokemon.shtml">New Pokémon</a>
            <a href="/swordshield/galarpokedex.shtml">Available Pokémon</a>
            <a href="/swordshield/galarpokedex.shtml">-Galar Pokédex</a>
            <a href="/swordshield/isleofarmordex.shtml">-Isle of Armor Pokédex</a>
            <a href="/swordshield/pokemonnotindex.shtml">-Other Available Pokémon</a>
            <a href="/swordshield/transferonly.shtml">Transfer Only Pokémon</a>
            <a href="/swordshield/unobtainable.shtml">Unavailable Pokémon</a>
            <a href="/swordshield/expansionreturning.shtml">Expansion Pass Returning Pokémon</a>
            <a href="/scarletviolet/paldeapokedex.shtml">Paldea Pokédex</a>`

        expect(availabilityPages(html, 'swordshield')).toEqual(['galarpokedex', 'isleofarmordex', 'pokemonnotindex', 'transferonly'])
    })

    test('skips the National Pokédex and Pokédex rank pages', () => {
        const html = `
            <a href="/brilliantdiamondshiningpearl/sinnohpokedex.shtml">Sinnoh Pokédex</a>
            <a href="/brilliantdiamondshiningpearl/nationalpokedex.shtml">National Pokédex</a>
            <a href="/brilliantdiamondshiningpearl/pokedexrank.shtml">Pokédex Ranks</a>
            <a href="/brilliantdiamondshiningpearl/otherpokemon.shtml">Other Available Pokémon</a>`

        expect(availabilityPages(html, 'brilliantdiamondshiningpearl')).toEqual(['sinnohpokedex', 'otherpokemon'])
    })
})

describe('colorTemplateOf', () => {
    test("names a game's Bulbapedia colour template, a DLC's by the DLC alone", () => {
        expect(['Scarlet', 'Scarlet: The Teal Mask', 'Let’s Go, Pikachu!', 'Black 2'].map(colorTemplateOf)).toEqual([
            'Scarlet color',
            'Teal Mask color',
            "Let's Go Pikachu color",
            'Black 2 color'
        ])
    })
})
