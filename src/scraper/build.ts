import { LANGUAGE_IDS, readTable } from './pokeapi'
import type { Value } from './sql'
import type { EvolutionConditions } from '@/db/schema'

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
// Trimmed: PokéAPI has stray spaces (" Stella", Stellar's Korean and romaji names).
const text = (value: string | undefined): string | null => value?.trim() || null

const indexBy = (rows: Row[], key: string) => new Map(rows.map((row) => [row[key]!, row]))

/** `id → identifier` for a PokéAPI lookup table; '' gives null. */
export const identifiers = (rows: Row[]) => {
    const byId = new Map(rows.map((row) => [row.id!, row.identifier!]))
    return (id: string | undefined) => (id ? (byId.get(id) ?? null) : null)
}

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

/** `artwork`: the official-artwork file stems in PokeAPI/sprites, from `artworkKeys()`. */
export const buildFromPokeApi = async (artwork: Set<string>) => {
    const [
        speciesRows, speciesNames, pokemonRows, formRows, formNames, generations, regions,
        pokemonTypes, formTypes, types, pokemonAbilities, abilities, pokemonStats,
        speciesEggGroups, eggGroups, encounters, locationAreas, locations, encounterSlots,
        encounterMethods, versions, evolutions, evolutionTriggers, versionGroups, items, moves, genders,
        natures, growthRates, colors, shapes, habitats, pokedexes, dexNumbers, typeNames, abilityNames, moveNames
    ] = await Promise.all(
        [
            'pokemon_species', 'pokemon_species_names', 'pokemon', 'pokemon_forms', 'pokemon_form_names',
            'generations', 'regions', 'pokemon_types', 'pokemon_form_types', 'types', 'pokemon_abilities',
            'abilities', 'pokemon_stats', 'pokemon_egg_groups', 'egg_groups', 'encounters', 'location_areas',
            'locations', 'encounter_slots', 'encounter_methods', 'versions', 'pokemon_evolution',
            'evolution_triggers', 'version_groups', 'items', 'moves', 'genders', 'natures', 'growth_rates',
            'pokemon_colors', 'pokemon_shapes', 'pokemon_habitats', 'pokedexes', 'pokemon_dex_numbers',
            'type_names', 'ability_names', 'move_names'
        ].map(readTable)
    )

    /** `slug` plus a name per language, for the rows of `table` that `keep` accepts. */
    const namesTable = (rows: Row[], names: Row[], key: string, keep: (row: Row) => boolean): Table => {
        const byId = byLanguage(names, key)
        return {
            columns: ['slug', ...languageColumns('name')],
            rows: rows.filter(keep).map((row) => [row.identifier!, ...Object.values(localized(byId.get(row.id!), 'name'))])
        }
    }
    // Every type, `unknown` included: Arceus's ??? form has it. Move ids from 10000
    // are Colosseum/XD's shadow moves, which nothing here refers to.
    const typeTable = namesTable(types!, typeNames!, 'type_id', () => true)
    const abilityTable = namesTable(abilities!, abilityNames!, 'ability_id', (row) => row.is_main_series === '1')
    const moveTable = namesTable(moves!, moveNames!, 'move_id', (row) => Number(row.id) < 10000)

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

    const growthRate = identifiers(growthRates!)
    const color = identifiers(colors!)
    const shape = identifiers(shapes!)
    const habitat = identifiers(habitats!)

    const pokemon: Table = {
        columns: [
            'ndex', 'slug', 'gen', 'catch_rate', 'base_friendship', 'gender_rate', 'egg_cycles',
            'evolution_chain', 'is_legendary', 'is_mythical', 'is_baby', 'has_gender_differences',
            'forms_switchable', 'growth_rate', 'color', 'shape', 'habitat',
            ...languageColumns('name'), ...languageColumns('category')
        ],
        rows: speciesRows!.map((row) => {
            const names = speciesNamesById.get(row.id!)
            return [
                Number(row.id), row.identifier!, Number(row.generation_id), int(row.capture_rate),
                int(row.base_happiness), int(row.gender_rate), int(row.hatch_counter),
                Number(row.evolution_chain_id), row.is_legendary === '1', row.is_mythical === '1',
                row.is_baby === '1', row.has_gender_differences === '1', row.forms_switchable === '1',
                growthRate(row.growth_rate_id), color(row.color_id), shape(row.shape_id), habitat(row.habitat_id),
                ...Object.values(localized(names, 'name')), ...Object.values(localized(names, 'genus'))
            ]
        })
    }

    // National is the species' own ndex; the Conquest gallery is a spin-off's.
    const pokedex = identifiers(pokedexes!)
    const dexNumber: Table = {
        columns: ['ndex', 'pokedex', 'number'],
        rows: dexNumbers!.flatMap((row) => {
            const name = pokedex(row.pokedex_id)!
            return name === 'national' || name === 'conquest-gallery'
                ? []
                : [[Number(row.species_id), name, Number(row.pokedex_number)]]
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
            'height_m', 'weight_kg', ...STAT_COLUMNS, ...STAT_COLUMNS.map((stat) => `ev_${stat}`),
            'base_experience', 'sprite_key'
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
        const shortNames = localized(names, 'form_name')
        const hasFormName = Object.values(shortNames).some(Boolean)
        const isDefault = row.is_default === '1' && variety.is_default === '1'
        const id = Number(row.id)

        // PokéAPI's full name ("Galarian Meowth"), else: the default form or an unnamed
        // form is the species itself (Pikachu, Rotom); else "Species (form name)" when
        // the form is named in that language ("メテノ (あかいろのコア)"); else null - never just the species name,
        // which would pass Mega Venusaur off as Venusaur.
        const nameIn = (language: Language) => {
            const species = speciesNames[language]
            if (fullNames[language]) return fullNames[language]
            if (isDefault || !hasFormName) return species
            const short = shortNames[language]
            if (!species || !short) return null
            // A Mega's form name is already its full name ("MegaVenusaur"); don't wrap it again.
            return short.includes(species) ? short : `${species} (${short})`
        }
        const formNames = Object.fromEntries(LANGUAGES.map((language) => [language, nameIn(language)])) as Record<
            Language,
            string | null
        >
        formNames.en ??= speciesNames.en

        const statRows = statsByPokemon.get(row.pokemon_id!) ?? []
        const stats = new Map(statRows.map((stat) => [stat.stat_id, int(stat.base_stat)]))
        // Every form yields at least one EV; all zeros is PokéAPI not having the
        // data yet (Legends Z-A's new Megas), so it is stored as unknown.
        const effort = new Map(statRows.map((stat) => [stat.stat_id, int(stat.effort) ?? 0]))
        const effortKnown = [...effort.values()].some(Boolean)

        // PokeAPI/sprites names a variety's own form by its pokemon id and any other form
        // `${ndex}-${form}`. A form with no artwork of its own (Scatterbug's patterns,
        // Mothim's cloaks) looks like its variety, so it falls back to that.
        const own = row.is_default === '1' ? row.pokemon_id! : `${ndex}-${row.form_identifier}`
        const spriteKey = [own, row.pokemon_id!].find((key) => artwork.has(key)) ?? null

        form.rows.push([
            id, ndex, row.identifier!, ...Object.values(formNames), isDefault, false,
            // 0 is PokéAPI's "unknown" (Eternamax Eternatus weighs "???"), not a weight.
            int(variety.height) ? int(variety.height)! / 10 : null,
            int(variety.weight) ? int(variety.weight)! / 10 : null,
            ...STAT_COLUMNS.map((_, index) => stats.get(String(index + 1)) ?? null),
            ...STAT_COLUMNS.map((_, index) => (effortKnown ? (effort.get(String(index + 1)) ?? 0) : null)),
            int(variety.base_experience),
            spriteKey
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

    const speciesById = indexBy(speciesRows!, 'id')
    const trigger = identifiers(evolutionTriggers!)
    const game = identifiers(versionGroups!)
    const lookups: ConditionLookups = {
        item: identifiers(items!), move: identifiers(moves!), type: identifiers(types!),
        gender: identifiers(genders!), location: identifiers(locations!), region: identifiers(regions!),
        species: identifiers(speciesRows!), natures: natures!
    }
    const evolution: Table = {
        columns: ['id', 'from_ndex', 'ndex', 'from_form_id', 'into_form_id', 'trigger', 'game', 'is_default', 'conditions'],
        rows: evolutions!.map((row) => [
            Number(row.id),
            Number(speciesById.get(row.evolved_species_id!)!.evolves_from_species_id),
            Number(row.evolved_species_id),
            int(row.required_pokemon_form_id),
            int(row.evolved_pokemon_form_id),
            trigger(row.evolution_trigger_id)!,
            game(row.version_group_id)!,
            row.is_default === '1',
            JSON.stringify(evolutionConditions(row, lookups))
        ])
    }

    return {
        generation, pokemon, eggGroup, dexNumber, form, formType, formAbility, encounter, evolution, forms,
        type: typeTable, ability: abilityTable, move: moveTable
    }
}

type Lookup = (id: string | undefined) => string | null

export interface ConditionLookups {
    item: Lookup
    move: Lookup
    type: Lookup
    gender: Lookup
    location: Lookup
    region: Lookup
    species: Lookup
    /** PokéAPI's `natures` rows. */
    natures: Row[]
}

/**
 * The conditions PokéAPI sets on one `pokemon_evolution` row, with ids turned
 * into identifiers. Unset conditions are left out; flags appear only when true.
 */
export const evolutionConditions = (row: Row, lookup: ConditionLookups): EvolutionConditions => {
    // Bit n is the nature with PokéAPI id n + 1 (checked: Amped Toxtricity's 13 natures).
    const mask = int(row.nature_bitmask)
    const conditions: EvolutionConditions = {
        minLevel: int(row.minimum_level) ?? undefined,
        item: lookup.item(row.trigger_item_id) ?? undefined,
        heldItem: lookup.item(row.held_item_id) ?? undefined,
        knownMove: lookup.move(row.known_move_id) ?? undefined,
        knownMoveType: lookup.type(row.known_move_type_id) ?? undefined,
        usedMove: lookup.move(row.used_move_id) ?? undefined,
        minMoveCount: int(row.minimum_move_count) ?? undefined,
        gender: (lookup.gender(row.gender_id) as EvolutionConditions['gender'] | null) ?? undefined,
        timeOfDay: text(row.time_of_day) ?? undefined,
        location: lookup.location(row.location_id) ?? undefined,
        region: lookup.region(row.region_id) ?? undefined,
        minHappiness: int(row.minimum_happiness) ?? undefined,
        minBeauty: int(row.minimum_beauty) ?? undefined,
        minAffection: int(row.minimum_affection) ?? undefined,
        relativePhysicalStats: int(row.relative_physical_stats) ?? undefined,
        partySpecies: lookup.species(row.party_species_id) ?? undefined,
        partyType: lookup.type(row.party_type_id) ?? undefined,
        tradeSpecies: lookup.species(row.trade_species_id) ?? undefined,
        minSteps: int(row.minimum_steps) ?? undefined,
        minDamageTaken: int(row.minimum_damage_taken) ?? undefined,
        natures:
            mask === null
                ? undefined
                : lookup.natures.filter((nature) => mask & (1 << (Number(nature.id) - 1))).map((nature) => nature.identifier!),
        percentageChance: int(row.percentage_chance) ?? undefined,
        expression: text(row.condition_expression) ?? undefined,
        overworldRain: row.needs_overworld_rain === '1' || undefined,
        upsideDown: row.turn_upside_down === '1' || undefined,
        multiplayer: row.needs_multiplayer === '1' || undefined,
        nearSpecialRock: row.near_special_rock === '1' || undefined
    }
    return Object.fromEntries(Object.entries(conditions).filter(([, value]) => value !== undefined))
}
