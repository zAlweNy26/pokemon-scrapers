import { fetchPage } from './http'

const API = 'https://api.pokeos.com/api'

/**
 * pokeos's own version-group ids (they part from PokéAPI's after Sword/Shield) for
 * the games PokéAPI has no encounters for: Scarlet/Violet with DLC, Legends Z-A.
 */
const ENCOUNTER_GROUPS = [25, 42]

/** pokeos names whose PokéAPI form slug is spelled differently. */
const FORM_OVERRIDES: Record<string, string> = {
    'terapagos-tera': 'terapagos-terastal',
    'eteral-floette-mega': 'floette-mega'
}

/** One row of pokeos's `pokemon_data`: a species (`id` = `number`) or one of its forms. */
export interface PokeosRow {
    id: number
    number: number
    identifier: string
    form_identifier: string
    is_sublegendary: number
    is_ub: number
    is_paradox: number | null
    is_shiny_locked: number
}

/**
 * pokeos "locations" that record how a Pokémon is obtained, not where, all tagged
 * `walk`: Pokémon GO, Poké Portal events, Union Circle, breeding Manaphy, Oricorio's
 * nectars, evolving Quaxwell. Any `anywhere-*` one is skipped too.
 */
const NOT_PLACES = new Set([
    'pokemon-go', 'poke-portal-news', 'union-circle', 'manaphy', 'pink-nectar', 'purple-nectar', 'quaxwell'
])

interface EncounterRow {
    pokemon_id: number
    version_identifier: string
    location_identifier: string
    method_identifier: string
    description: string | null
}

/** The place a pokeos encounter row stands for, or null when it is not one. */
export const placeOf = ({ location_identifier: location, description }: EncounterRow) => {
    if (location.startsWith('anywhere-') || NOT_PLACES.has(location)) return null
    // "after boosting biodiversity in the Coastal Biome (DLC)": a condition on that biome.
    if (location === 'boosting-biodiversity')
        return /in the (\w+) Biome/.exec(description ?? '')?.[1]?.toLowerCase().concat('-biome') ?? null
    return location
}

const get = async (path: string) => JSON.parse((await fetchPage(`${API}/${path}`, { maxAgeDays: 30 })).body)

/**
 * Homedex form ids of the forms pokeos marks shiny-locked. A species row maps to
 * its default form; a form row by name, since pokeos's form ids are not PokéAPI's.
 * `unmatched` lists pokeos forms homedex does not have (Ogerpon's Tera states).
 */
export const shinyLockedForms = (
    rows: PokeosRow[],
    forms: { id: number; ndex: number; slug: string; isDefault: boolean }[],
    speciesSlug: Map<number, string>
) => {
    const bySlug = new Map(forms.map((form) => [form.slug, form.id]))
    const defaultOf = new Map(forms.filter((form) => form.isDefault).map((form) => [form.ndex, form.id]))
    const ids = new Set<number>()
    const unmatched: string[] = []

    for (const row of rows.filter((row) => row.is_shiny_locked === 1)) {
        const name = row.identifier.toLowerCase().replaceAll(' ', '-')
        const id =
            row.id === row.number
                ? defaultOf.get(row.number)
                : (bySlug.get(FORM_OVERRIDES[name] ?? name) ?? bySlug.get(`${speciesSlug.get(row.number)}-${row.form_identifier}`))
        if (id === undefined) unmatched.push(name)
        else ids.add(id)
    }

    return { ids, unmatched }
}

/**
 * Everything homedex takes from pokeos.com, whose owner allowed scraping as long
 * as it is not spammed: ~95 requests, cached for 30 days. Species flags come from
 * the one bulk list the site itself boots from, and encounters per location
 * rather than per species. Its learnsets are left out: they mix species.
 */
export const fetchPokeos = async () => {
    const { data: rows }: { data: PokeosRow[] } = await get('general/data/pokemon_data')
    const ndexOf = new Map(rows.map((row) => [row.id, row.number]))

    const flags = new Map(
        rows
            .filter((row) => row.id === row.number)
            .map((row) => [
                row.number,
                { subLegendary: row.is_sublegendary === 1, ultraBeast: row.is_ub === 1, paradox: row.is_paradox === 1 }
            ])
    )

    const pronunciations = new Map<number, { respelling: string; ipa: string | null }>()
    // One row per species, filed under its base form where it has forms (Unown `a`, Urshifu `single-strike`).
    for (const row of await get('poke/pokemon/pronunciations'))
        if (row.pronunciation)
            pronunciations.set(row.number, { respelling: row.pronunciation, ipa: row.ipa })

    // [ndex, game, location, method], deduplicated like PokéAPI's rows in build.ts.
    const encounters = new Map<string, [number, string, string, string]>()
    for (const group of ENCOUNTER_GROUPS)
        for (const location of await get(`poke/encounters/locations?version_group_id=${group}&lang=en`)) {
            // Skipped before fetching: `anywhere-trade`, `-evolve`, `-breed`, `-event` are ways in, which availability covers.
            if (location.location_identifier.startsWith('anywhere-') || NOT_PLACES.has(location.location_identifier)) continue
            const found: EncounterRow[] = await get(
                `poke/encounters/location?location_id=${location.location_id}&version_group_id=${group}&lang=en`
            )
            for (const row of found) {
                const ndex = ndexOf.get(row.pokemon_id)
                const place = placeOf(row)
                if (ndex === undefined || place === null) continue
                const values: [number, string, string, string] = [ndex, row.version_identifier, place, row.method_identifier]
                encounters.set(values.join('|'), values)
            }
        }

    return { rows, flags, pronunciations, encounters: [...encounters.values()] }
}
