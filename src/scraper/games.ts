import type { FormInfo } from './build'
import { fetchPage } from './http'

/**
 * Each HOME-connected game's Serebii folder, keyed by PokéAPI version-group
 * identifier. The availability pages are read from the folder's index (see
 * `availabilityPages`); what stays here corrects what those pages leave out.
 */
interface GameSource {
    folder: string
    /** Species up to this national dex number are in the game even when no page shows them. */
    nationalDexUpTo?: number
    /** Regional forms that the game holds whenever it holds the species' default form. */
    regionsFollowSpecies?: string[]
    /** Forms the game holds that no page shows and no rule brings in, by slug. */
    forms?: string[]
    /** Regions whose evidence also brings the species' default form. */
    speciesFollowsRegions?: string[]
}

const GAMES: Record<string, GameSource> = {
    'lets-go-pikachu-lets-go-eevee': {
        folder: 'letsgopikachueevee',
        // The game holds the Alolan forms of Kanto Pokémon (in-game trades), but its
        // Kanto Pokédex page shows only the Kanto icons.
        regionsFollowSpecies: ['alola']
    },
    'sword-shield': {
        folder: 'swordshield',
        // Its pages show only the Galarian icon for all 19 species that have one, though
        // the game holds the regular forms too (Kantonian Meowth, Unovan Yamask).
        speciesFollowsRegions: ['galar'],
        // The Alolan forms of species it holds come by trade and Diglett rewards (Bulbapedia),
        // shown only by the species' icon; its Hisuian and Paldean forms are not in the game.
        regionsFollowSpecies: ['alola']
    },
    'brilliant-diamond-shining-pearl': {
        folder: 'brilliantdiamondshiningpearl',
        // Darkrai, Shaymin and Arceus are save-data and event gifts that no list shows;
        // Serebii's National Pokédex page states it runs "from Bulbasaur up to Arceus".
        nationalDexUpTo: 493
    },
    'legends-arceus': {
        folder: 'legendsarceus',
        // Gifts in Request 83 (Bulbapedia); its pages show only the Kantonian icons. Its other
        // regional forms of Kanto species are not in the game.
        forms: ['vulpix-alola', 'ninetales-alola']
    },
    'scarlet-violet': {
        folder: 'scarletviolet',
        // Alolan Meowth and Persian, Galarian Meowth and Hisuian Growlithe and Arcanine come
        // by HOME or as gifts (Bulbapedia), shown only by the species' icon.
        regionsFollowSpecies: ['alola', 'galar', 'hisui']
    },
    'legends-za': {
        folder: 'legendsz-a',
        // Its wild zones, trades and evolutions give these forms (Bulbapedia, and its alpha
        // list), shown only by the species' icon.
        regionsFollowSpecies: ['alola', 'galar', 'hisui']
    }
}

/**
 * The pages a game's Serebii index links as its Pokémon lists: every regional and
 * DLC Pokédex ("Kitakami Pokédex"), "Other Available Pokémon", "Available Pokémon
 * not in Pokédex" and "Transfer Only Pokémon". BDSP's "National Pokédex" is not a
 * list of what the game holds. Pure, for tests.
 */
export const availabilityPages = (html: string, folder: string): string[] => {
    const links = html.matchAll(new RegExp(`href="/${folder}/([\\w-]+)\\.shtml"[^>]*>-*([^<]*)<`, 'g'))
    const lists = /^(?!National\b).*\bPok.dex$|^(Other )?Available Pok.mon\b|^Transfer Only Pok.mon$/
    return [...new Set(Array.from(links).filter(([, , text]) => lists.test(text!.trim())).map(([, page]) => page!))]
}

/**
 * `${ndex}${code}` for every Pokémon sprite on a page - the same image codes as the
 * HOME box list ("128-p" is Paldean Tauros). Sprites live under a game's folder
 * (`/scarletviolet/pokemon/new/small/`) or a Pokédex icon folder (`/pokedex-swsh/icon/`).
 */
export const parseGameCodes = (html: string): Set<string> =>
    new Set(
        Array.from(
            html.matchAll(/src="\/[a-z0-9-]+\/(?:pokemon|icon)\/(?:new\/)?(?:small\/)?(\d{3,4})(-[a-z0-9-]+)?\.png"/g),
            ([, ndex, code]) => `${Number(ndex)}${code ?? ''}`
        )
    )

export interface GameEvidence extends Omit<GameSource, 'folder'> {
    codes: Set<string>
}

const serebii = async (path: string) =>
    (await fetchPage(`https://www.serebii.net/${path}`, { charset: 'windows-1252' })).body

/** One polite request per page; ~24 pages with the indexes, reused from the cache for 24 hours. */
export const fetchGameEvidence = async (): Promise<Map<string, GameEvidence>> => {
    const evidence = new Map<string, GameEvidence>()

    for (const [game, { folder, ...rules }] of Object.entries(GAMES)) {
        const pages = availabilityPages(await serebii(`${folder}/`), folder)
        if (!pages.length) throw new Error(`Serebii ${folder}/: no Pokémon list linked - layout changed?`)
        const codes = new Set<string>()
        for (const page of pages) {
            const found = parseGameCodes(await serebii(`${folder}/${page}.shtml`))
            if (!found.size) throw new Error(`Serebii ${folder}/${page}: no Pokémon found - layout changed?`)
            for (const code of found) codes.add(code)
        }
        evidence.set(game, { codes, ...rules })
    }

    return evidence
}

/** The region of a regional variant ("Galarian Form" → galar), or null. Not the slug: `pikachu-alola-cap` is no regional form. */
export const regionOf = (form: Pick<FormInfo, 'formName' | 'pokemonName'>) => {
    const word = /^(Alolan|Galarian|Hisuian|Paldean)\b/.exec(form.formName ?? form.pokemonName ?? '')?.[1]
    return word ? { Alolan: 'alola', Galarian: 'galar', Hisuian: 'hisui', Paldean: 'paldea' }[word]! : null
}

/**
 * Which games each depositable form can be moved into (option 3 in DATA-PLAN.md).
 * Serebii's pages show one icon per species unless a game supports notable forms,
 * which it then lists one by one (Cap Pikachu in Sword/Shield, not in BDSP). So:
 *
 * 1. A species is in a game when its pages show the plain dex number (even for a
 *    form HOME cannot store, like Minior's Meteor Form), its default form, a
 *    number within `nationalDexUpTo`, or a region in `speciesFollowsRegions`.
 *    Its default form goes with it.
 * 2. A regional form needs evidence for its own region within the species: Combat
 *    Breed Paldean Tauros brings the other breeds, Hisuian Growlithe does not bring
 *    Kantonian Growlithe into Legends: Arceus. `regionsFollowSpecies` widens this,
 *    and `forms` names single forms no page or rule brings in.
 * 3. Any other form is in the game when shown; when not shown, it is out if this
 *    game lists the species form by form (Vivillon patterns in Scarlet/Violet), or
 *    if it is cosmetic and shown for some other game (Cap Pikachu appears for
 *    Sword/Shield but not BDSP). Otherwise it follows its species: Rotom, Unown,
 *    Alcremie, and alternates no page lists (Blue-Striped Basculin, Zygarde 10%).
 *
 * `formsByCode` maps `${ndex}${code}` to the depositable forms Serebii's HOME list
 * resolved it to; codes it does not know are forms HOME cannot store.
 */
export const homeGames = (
    forms: FormInfo[],
    depositable: Set<number>,
    formsByCode: Map<string, FormInfo[]>,
    evidence: Map<string, GameEvidence>
): [number, string][] => {
    const defaults = new Map(forms.filter((form) => form.isDefault).map((form) => [form.ndex, form]))
    const shownIn = (codes: Set<string>) => new Set([...codes].flatMap((code) => formsByCode.get(code) ?? []))

    const isListed = (form: FormInfo) => !form.isDefault && !regionOf(form)
    const shownAnywhere = new Set([...evidence.values()].flatMap(({ codes }) => [...shownIn(codes)].map((form) => form.id)))
    const isCosmetic = (form: FormInfo) => form.signature === defaults.get(form.ndex)?.signature

    const rows: [number, string][] = []

    for (const [game, { codes, nationalDexUpTo, regionsFollowSpecies = [], speciesFollowsRegions = [], forms: alsoHeld = [] }] of evidence) {
        const shown = new Set([...shownIn(codes)].map((form) => form.id))
        // Species this game lists form by form - by a form's own code ("718-10"), not the
        // plain number, which Serebii also uses for "Zygarde Power Construct".
        const listedHere = new Set(
            [...shownIn(new Set([...codes].filter((code) => code.includes('-'))))].filter(isListed).map((form) => form.ndex)
        )
        const shownRegions = new Set(
            forms.filter((form) => shown.has(form.id) && regionOf(form)).map((form) => `${form.ndex}:${regionOf(form)}`)
        )

        const species = new Set<number>()
        for (const [ndex, form] of defaults)
            if (
                shown.has(form.id) ||
                codes.has(String(ndex)) ||
                (nationalDexUpTo !== undefined && ndex <= nationalDexUpTo) ||
                speciesFollowsRegions.some((region) => shownRegions.has(`${ndex}:${region}`))
            )
                species.add(ndex)

        for (const form of forms) {
            if (!depositable.has(form.id)) continue

            const region = regionOf(form)
            const inGame = alsoHeld.includes(form.slug) || (form.isDefault
                ? species.has(form.ndex)
                : region
                  ? shownRegions.has(`${form.ndex}:${region}`) ||
                    (regionsFollowSpecies.includes(region) && species.has(form.ndex))
                  : shown.has(form.id) ||
                    (species.has(form.ndex) &&
                        !listedHere.has(form.ndex) &&
                        !(isCosmetic(form) && shownAnywhere.has(form.id))))

            if (inGame) rows.push([form.id, game])
        }
    }

    return rows
}
