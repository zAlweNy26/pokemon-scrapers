import { LANGUAGE_IDS, readTable } from './pokeapi'
import type { Value } from './sql'

type Row = Record<string, string>
type Language = keyof typeof LANGUAGE_IDS

export interface Table {
    columns: string[]
    rows: Value[][]
}

/** What the HOME matcher needs to know about a form. */
export interface FormInfo {
    id: number
    ndex: number
    slug: string
    isDefault: boolean
    /** English full name ("Galarian Meowth") and form name ("Galarian Form"); null when PokéAPI has none. */
    pokemonName: string | null
    formName: string | null
    speciesName: string
    /** Types in slot order and base stats: equal to the default form's means a cosmetic form. */
    signature: string
}

const LANGUAGES = Object.keys(LANGUAGE_IDS) as Language[]

/** Not in PokéAPI. The year each generation's first games released in Japan. */
const DEBUT_YEAR: Record<string, number> = {
    '1': 1996, '2': 1999, '3': 2002, '4': 2006, '5': 2010, '6': 2013, '7': 2016, '8': 2019, '9': 2022
}

/** PokéAPI `stats.id` → our column, in schema order. */
const STAT_COLUMNS = ['hp', 'atk', 'def', 'sp_atk', 'sp_def', 'spd'] as const

const int = (value: string | undefined): number | null => (value === undefined || value === '' ? null : Number(value))
const text = (value: string | undefined): string | null => (value ? value : null)

const indexBy = (rows: Row[], key: string) => new Map(rows.map((row) => [row[key]!, row]))

const groupBy = (rows: Row[], key: string) => {
    const groups = new Map<string, Row[]>()
    for (const row of rows) {
        const list = groups.get(row[key]!)
        if (list) list.push(row)
        else groups.set(row[key]!, [row])
    }
    return groups
}

/** `id → { languageId → row }` for a PokéAPI `*_names` table. */
const byLanguage = (rows: Row[], key: string) => {
    const result = new Map<string, Map<string, Row>>()
    for (const row of rows) {
        const id = row[key]!
        if (!result.has(id)) result.set(id, new Map())
        result.get(id)!.set(row.local_language_id!, row)
    }
    return result
}

/** One value per language, taking the first PokéAPI language that has a non-empty value. */
const localized = (names: Map<string, Row> | undefined, field: string): Record<Language, string | null> =>
    Object.fromEntries(
        LANGUAGES.map((language) => [
            language,
            LANGUAGE_IDS[language].map((id) => text(names?.get(id)?.[field])).find((value) => value) ?? null
        ])
    ) as Record<Language, string | null>

const languageColumns = (prefix: string) => LANGUAGES.map((language) => `${prefix}_${language}`)

export const buildFromPokeApi = async () => {
    const [
        speciesRows, speciesNames, pokemonRows, formRows, formNames, generations, regions,
        pokemonTypes, formTypes, types, pokemonAbilities, abilities, pokemonStats,
        speciesEggGroups, eggGroups, encounters, locationAreas, locations, encounterSlots,
        encounterMethods, versions
    ] = await Promise.all(
        [
            'pokemon_species', 'pokemon_species_names', 'pokemon', 'pokemon_forms', 'pokemon_form_names',
            'generations', 'regions', 'pokemon_types', 'pokemon_form_types', 'types', 'pokemon_abilities',
            'abilities', 'pokemon_stats', 'pokemon_egg_groups', 'egg_groups', 'encounters', 'location_areas',
            'locations', 'encounter_slots', 'encounter_methods', 'versions'
        ].map(readTable)
    )

    const pokemonById = indexBy(pokemonRows!, 'id')
    const regionById = indexBy(regions!, 'id')
    const typeById = indexBy(types!, 'id')
    const abilityById = indexBy(abilities!, 'id')
    const eggGroupById = indexBy(eggGroups!, 'id')
    const speciesNamesById = byLanguage(speciesNames!, 'pokemon_species_id')
    const formNamesById = byLanguage(formNames!, 'pokemon_form_id')

    const generation: Table = {
        columns: ['id', 'region', 'debut'],
        rows: generations!.map((row) => [
            Number(row.id),
            regionById.get(row.main_region_id!)!.identifier!,
            DEBUT_YEAR[row.id!] ?? null
        ])
    }

    const pokemon: Table = {
        columns: [
            'ndex', 'slug', 'gen', 'catch_rate', 'base_friendship', 'gender_rate', 'egg_cycles',
            ...languageColumns('name'), ...languageColumns('category')
        ],
        rows: speciesRows!.map((row) => {
            const names = speciesNamesById.get(row.id!)
            return [
                Number(row.id), row.identifier!, Number(row.generation_id), int(row.capture_rate),
                int(row.base_happiness), int(row.gender_rate), int(row.hatch_counter),
                ...Object.values(localized(names, 'name')), ...Object.values(localized(names, 'genus'))
            ]
        })
    }

    const eggGroup: Table = {
        columns: ['ndex', 'egg_group'],
        rows: speciesEggGroups!.map((row) => [Number(row.species_id), eggGroupById.get(row.egg_group_id!)!.identifier!])
    }

    const typesByPokemon = groupBy(pokemonTypes!, 'pokemon_id')
    const typesByForm = groupBy(formTypes!, 'pokemon_form_id')
    const abilitiesByPokemon = groupBy(pokemonAbilities!, 'pokemon_id')
    const statsByPokemon = groupBy(pokemonStats!, 'pokemon_id')

    const forms: FormInfo[] = []
    const form: Table = {
        columns: [
            'id', 'ndex', 'slug', ...languageColumns('name'), 'is_default', 'depositable',
            'height_m', 'weight_kg', ...STAT_COLUMNS, 'sprite_key'
        ],
        rows: []
    }
    const formType: Table = { columns: ['form_id', 'slot', 'type'], rows: [] }
    const formAbility: Table = { columns: ['form_id', 'slot', 'ability', 'is_hidden'], rows: [] }

    for (const row of formRows!) {
        const variety = pokemonById.get(row.pokemon_id!)!
        const ndex = Number(variety.species_id)
        const speciesNames = localized(speciesNamesById.get(variety.species_id!), 'name')
        const names = formNamesById.get(row.id!)
        const fullNames = localized(names, 'pokemon_name')
        const hasFormName = Object.values(localized(names, 'form_name')).some(Boolean)
        const isDefault = row.is_default === '1' && variety.is_default === '1'
        const id = Number(row.id)

        // A form without its own name is the species itself (Pikachu); a named form
        // missing one language stays null there rather than borrowing the species name.
        const formNames = Object.fromEntries(
            LANGUAGES.map((language) => [language, fullNames[language] ?? (hasFormName ? null : speciesNames[language])])
        ) as Record<Language, string | null>
        formNames.en ??= speciesNames.en

        const stats = new Map(statsByPokemon.get(row.pokemon_id!)?.map((stat) => [stat.stat_id, int(stat.base_stat)]))

        form.rows.push([
            id, ndex, row.identifier!, ...Object.values(formNames), isDefault, false,
            int(variety.height)! / 10, int(variety.weight)! / 10,
            ...STAT_COLUMNS.map((_, index) => stats.get(String(index + 1)) ?? null),
            null
        ])

        const typeRows = typesByForm.get(row.id!) ?? typesByPokemon.get(row.pokemon_id!) ?? []
        for (const typeRow of typeRows)
            formType.rows.push([id, Number(typeRow.slot), typeById.get(typeRow.type_id!)!.identifier!])

        for (const abilityRow of abilitiesByPokemon.get(row.pokemon_id!) ?? [])
            formAbility.rows.push([
                id, Number(abilityRow.slot), abilityById.get(abilityRow.ability_id!)!.identifier!, abilityRow.is_hidden === '1'
            ])

        const english = formNamesById.get(row.id!)?.get('9')
        forms.push({
            id, ndex, slug: row.identifier!, isDefault,
            pokemonName: text(english?.pokemon_name), formName: text(english?.form_name),
            speciesName: speciesNames.en!,
            signature: JSON.stringify([
                [...typeRows].sort((a, b) => Number(a.slot) - Number(b.slot)).map((t) => t.type_id),
                STAT_COLUMNS.map((_, index) => stats.get(String(index + 1)) ?? null)
            ])
        })
    }

    // Slot- and level-range rows collapse to one per (species, game, location, method).
    const areaById = indexBy(locationAreas!, 'id')
    const locationById = indexBy(locations!, 'id')
    const slotById = indexBy(encounterSlots!, 'id')
    const methodById = indexBy(encounterMethods!, 'id')
    const versionById = indexBy(versions!, 'id')
    const seen = new Set<string>()
    const encounter: Table = { columns: ['ndex', 'game', 'location', 'method'], rows: [] }

    for (const row of encounters!) {
        const values = [
            Number(pokemonById.get(row.pokemon_id!)!.species_id),
            versionById.get(row.version_id!)!.identifier!,
            locationById.get(areaById.get(row.location_area_id!)!.location_id!)!.identifier!,
            methodById.get(slotById.get(row.encounter_slot_id!)!.encounter_method_id!)!.identifier!
        ]
        const key = values.join('|')
        if (seen.has(key)) continue
        seen.add(key)
        encounter.rows.push(values)
    }

    return { generation, pokemon, eggGroup, form, formType, formAbility, encounter, forms }
}
