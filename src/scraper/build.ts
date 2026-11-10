import { regionOf } from './games'
import { LANGUAGE_IDS, LANGUAGES, readTable, type Language } from './pokeapi'
import type { Value } from './sql'
import type { EvolutionConditions, FormCategory } from '@/db/schema'

type Row = Record<string, string>

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

/**
 * Why a form exists, first match wins: the default, battle-only (Mega, Gigantamax,
 * Zen Mode), regional, a gender's own form (Meowstic), one the species can switch
 * into (Rotom, Furfrou), one that only looks different (Unown, Vivillon), else a
 * fixed variant with its own types or stats (Lycanroc, Urshifu).
 */
export const categoryOf = (
    form: FormInfo,
    { battleOnly, identifier, switchable }: { battleOnly: boolean; identifier: string; switchable: boolean },
    base: FormInfo | undefined
): FormCategory => {
    if (form.isDefault) return 'default'
    if (battleOnly) return 'battle-only'
    if (regionOf(form)) return 'regional'
    if (identifier === 'female' || identifier === 'male') return 'gender'
    if (switchable) return 'switchable'
    return form.signature === base?.signature ? 'cosmetic' : 'variant'
}

export const GENERATION_PAGE = 'Generation'

/**
 * Not in PokéAPI. The year each generation's first games released in Japan, keyed
 * by PokéAPI generation identifier, from Bulbapedia's Generation table: a row opens
 * with `{{color2|000|Generation IV|IV}}`, and its first "(2006/2007)" is the
 * main-series column's first release (Japan/West). Pure, for tests.
 */
export const debutYearsOf = (wikitext: string): Map<string, number> => {
    const rows = [...wikitext.matchAll(/\{\{color2\|[^|]*\|Generation ([IVX]+)\|/g)]
    const years = new Map<string, number>()
    rows.forEach((row, i) => {
        const year = /\((\d{4})/.exec(wikitext.slice(row.index, rows[i + 1]?.index))?.[1]
        if (year) years.set(`generation-${row[1]!.toLowerCase()}`, Number(year))
    })
    return years
}

/**
 * Not in PokéAPI, which lists DLCs as versions of their own. The version each
 * extends. shortcut: hand-kept, so a DLC a PokéAPI bump adds has no base game until listed here.
 */
const DLC_BASE: Record<string, string> = {
    'the-isle-of-armor-sword': 'sword', 'the-isle-of-armor-shield': 'shield',
    'the-crown-tundra-sword': 'sword', 'the-crown-tundra-shield': 'shield',
    'the-teal-mask-scarlet': 'scarlet', 'the-teal-mask-violet': 'violet',
    'the-indigo-disk-scarlet': 'scarlet', 'the-indigo-disk-violet': 'violet',
    'mega-dimension': 'legends-za'
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

/** Game text joined back into one paragraph: it wraps at the text box, and a line ending in "Fire-" or a soft hyphen continues the word. */
export const unwrap = (value: string) =>
    value.replace(/\u00ad\n/g, '').replace(/-\n/g, '-').replace(/\n/g, ' ').replace(/\u00ad/g, '')

/** What Sword/Shield onwards say for a move they dropped: not a description, so an older game's text is used. */
export const DROPPED_MOVE = /^This move can.t be used\. It.s recommended that this move is forgotten\./

const languageColumns = (prefix: string) => LANGUAGES.map((language) => `${prefix}_${language}`)

/** `artwork`: the HOME renders in PokeAPI/sprites, from `artworkKeys()`. */
/** The shiny render of the same picture (`home/25` → `home/shiny/25`), or null. */
const shinyOf = (key: string | null, artwork: Set<string>) => {
    const shiny = key?.replace(/^home\//, 'home/shiny/')
    return shiny && artwork.has(shiny) ? shiny : null
}

export const buildFromPokeApi = async (artwork: Set<string>, debutYears: Map<string, number>) => {
    const [
        speciesRows, speciesNames, pokemonRows, formRows, formNames, generations, regions,
        pokemonTypes, formTypes, types, pokemonAbilities, abilities, pokemonStats,
        speciesEggGroups, eggGroups, encounters, locationAreas, locations, encounterSlots,
        encounterMethods, versions, evolutions, evolutionTriggers, versionGroups, items, moves, genders,
        natures, growthRates, colors, shapes, habitats, pokedexes, dexNumbers, typeNames, abilityNames, moveNames,
        abilityProse, abilityFlavor, moveProse, moveFlavor, versionNames, pokedexProse, pokedexVersionGroups
    ] = await Promise.all(
        [
            'pokemon_species', 'pokemon_species_names', 'pokemon', 'pokemon_forms', 'pokemon_form_names',
            'generations', 'regions', 'pokemon_types', 'pokemon_form_types', 'types', 'pokemon_abilities',
            'abilities', 'pokemon_stats', 'pokemon_egg_groups', 'egg_groups', 'encounters', 'location_areas',
            'locations', 'encounter_slots', 'encounter_methods', 'versions', 'pokemon_evolution',
            'evolution_triggers', 'version_groups', 'items', 'moves', 'genders', 'natures', 'growth_rates',
            'pokemon_colors', 'pokemon_shapes', 'pokemon_habitats', 'pokedexes', 'pokemon_dex_numbers',
            'type_names', 'ability_names', 'move_names', 'ability_prose', 'ability_flavor_text', 'move_effect_prose',
            'move_flavor_text', 'version_names', 'pokedex_prose', 'pokedex_version_groups'
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
    const mainAbilities = abilities!.filter((row) => row.is_main_series === '1')
    const gameMoves = moves!.filter((row) => Number(row.id) < 10000)
    const abilityTable = namesTable(mainAbilities, abilityNames!, 'ability_id', () => true)
    const moveTable = namesTable(gameMoves, moveNames!, 'move_id', () => true)

    const groupOrder = new Map(versionGroups!.map((row) => [row.id!, Number(row.order)]))

    const groupById = indexBy(versionGroups!, 'id')
    const versionNamesById = byLanguage(versionNames!, 'version_id')
    const gameTable: Table = {
        columns: ['slug', 'version_group', 'generation', 'base_game', 'sort', ...languageColumns('name')],
        rows: versions!
            .toSorted(
                (a, b) =>
                    groupOrder.get(a.version_group_id!)! - groupOrder.get(b.version_group_id!)! || Number(a.id) - Number(b.id)
            )
            .map((row, sort) => {
                const group = groupById.get(row.version_group_id!)!
                return [
                    row.identifier!, group.identifier!, Number(group.generation_id), DLC_BASE[row.identifier!] ?? null, sort,
                    ...Object.values(localized(versionNamesById.get(row.id!), 'name'))
                ]
            })
    }
    /** `prose` in English, keyed by `key`. */
    const englishEffects = (prose: Row[], key: string) =>
        new Map(prose.filter((row) => row.local_language_id === '9').map((row) => [row[key]!, text(row.effect)]))
    /**
     * Adds `description` and `effect` in English to `table`, whose rows are `rows` in order.
     * Oldest game first, so the map keeps the latest game's text.
     */
    const withTexts = (table: Table, rows: Row[], flavor: Row[], key: string, effectOf: (row: Row) => string | null | undefined) => {
        const descriptions = new Map(
            flavor
                .filter((row) => row.language_id === '9')
                .toSorted((a, b) => groupOrder.get(a.version_group_id!)! - groupOrder.get(b.version_group_id!)!)
                .map((row) => [row[key]!, text(unwrap(row.flavor_text!))] as const)
                .filter(([, description]) => description && !DROPPED_MOVE.test(description))
        )
        table.columns.push('description', 'effect')
        rows.forEach((row, i) => table.rows[i]!.push(descriptions.get(row.id!) ?? null, effectOf(row) ?? null))
    }
    const abilityEffects = englishEffects(abilityProse!, 'ability_id')
    const moveEffects = englishEffects(moveProse!, 'move_effect_id')
    withTexts(abilityTable, mainAbilities, abilityFlavor!, 'ability_id', (row) => abilityEffects.get(row.id!))
    withTexts(moveTable, gameMoves, moveFlavor!, 'move_id', (row) => moveEffects.get(row.effect_id!))

    const pokemonById = indexBy(pokemonRows!, 'id')
    const regionById = indexBy(regions!, 'id')
    const typeById = indexBy(types!, 'id')
    const abilityById = indexBy(abilities!, 'id')
    const eggGroupById = indexBy(eggGroups!, 'id')
    const speciesNamesById = byLanguage(speciesNames!, 'pokemon_species_id')
    const formNamesById = byLanguage(formNames!, 'pokemon_form_id')

    const generation: Table = {
        columns: ['id', 'region', 'debut'],
        rows: generations!.map((row) => {
            const debut = debutYears.get(row.identifier!)
            if (!debut) throw new Error(`Bulbapedia's "${GENERATION_PAGE}" page gives no debut year for ${row.identifier} - layout changed?`)
            return [Number(row.id), regionById.get(row.main_region_id!)!.identifier!, debut]
        })
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
    const regional = (slug: string) => slug !== 'national' && slug !== 'conquest-gallery'
    const pokedex = identifiers(pokedexes!)
    const pokedexNames = byLanguage(pokedexProse!, 'pokedex_id')
    const pokedexTable: Table = {
        columns: ['slug', 'region', 'main_series', ...languageColumns('name')],
        rows: pokedexes!
            .filter((row) => regional(row.identifier!))
            .map((row) => [
                row.identifier!, regionById.get(row.region_id!)?.identifier ?? null, row.is_main_series === '1',
                ...Object.values(localized(pokedexNames.get(row.id!), 'name'))
            ])
    }
    const pokedexGame: Table = {
        columns: ['pokedex', 'version_group'],
        rows: pokedexVersionGroups!.flatMap((row) => {
            const slug = pokedex(row.pokedex_id)!
            return regional(slug) ? [[slug, groupById.get(row.version_group_id!)!.identifier!]] : []
        })
    }
    const dexNumber: Table = {
        columns: ['ndex', 'pokedex', 'number'],
        rows: dexNumbers!.flatMap((row) => {
            const name = pokedex(row.pokedex_id)!
            return regional(name) ? [[Number(row.species_id), name, Number(row.pokedex_number)]] : []
        })
    }

    const eggGroup: Table = {
        columns: ['ndex', 'egg_group'],
        rows: speciesEggGroups!.map((row) => [Number(row.species_id), eggGroupById.get(row.egg_group_id!)!.identifier!])
    }

    const typesByPokemon = Map.groupBy(pokemonTypes!, (row) => row.pokemon_id!)
    const typesByForm = Map.groupBy(formTypes!, (row) => row.pokemon_form_id!)
    const abilitiesByPokemon = Map.groupBy(pokemonAbilities!, (row) => row.pokemon_id!)
    const statsByPokemon = Map.groupBy(pokemonStats!, (row) => row.pokemon_id!)

    const forms: FormInfo[] = []
    const formFacts: Parameters<typeof categoryOf>[1][] = []
    /** PokéAPI `pokemon.id` → its own default form's id: encounters are recorded per variety. */
    const varietyForm = new Map<string, number>()
    const switchable = new Set(speciesRows!.filter((row) => row.forms_switchable === '1').map((row) => Number(row.id)))
    const form: Table = {
        columns: [
            'id', 'ndex', 'slug', ...languageColumns('name'), 'is_default', 'depositable',
            'height_m', 'weight_kg', ...STAT_COLUMNS, ...STAT_COLUMNS.map((stat) => `ev_${stat}`),
            'base_experience', 'sprite_key', 'shiny_sprite_key', 'category'
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
        // A female form PokéAPI keeps apart within its variety (Frillish) is the variety's female render, never its male one.
        const fallback = row.form_identifier === 'female' ? `female/${row.pokemon_id}` : row.pokemon_id!
        const spriteKey = [`home/${own}`, `home/${fallback}`].find((key) => artwork.has(key)) ?? null
        // The shiny of the same picture, never another form's: Mothim's cloaks share one.
        const shinySpriteKey = shinyOf(spriteKey, artwork)

        form.rows.push([
            id, ndex, row.identifier!, ...Object.values(formNames), isDefault, false,
            // 0 is PokéAPI's "unknown" (Eternamax Eternatus weighs "???"), not a weight.
            int(variety.height) ? int(variety.height)! / 10 : null,
            int(variety.weight) ? int(variety.weight)! / 10 : null,
            ...STAT_COLUMNS.map((_, index) => stats.get(String(index + 1)) ?? null),
            ...STAT_COLUMNS.map((_, index) => (effortKnown ? (effort.get(String(index + 1)) ?? 0) : null)),
            int(variety.base_experience),
            spriteKey,
            shinySpriteKey
        ])

        const typeRows = typesByForm.get(row.id!) ?? typesByPokemon.get(row.pokemon_id!) ?? []
        for (const typeRow of typeRows)
            formType.rows.push([id, Number(typeRow.slot), typeById.get(typeRow.type_id!)!.identifier!])

        for (const abilityRow of abilitiesByPokemon.get(row.pokemon_id!) ?? [])
            formAbility.rows.push([
                id, Number(abilityRow.slot), abilityById.get(abilityRow.ability_id!)!.identifier!, abilityRow.is_hidden === '1'
            ])

        const english = formNamesById.get(row.id!)?.get('9')
        if (row.is_default === '1') varietyForm.set(row.pokemon_id!, id)
        formFacts.push({ battleOnly: row.is_battle_only === '1', identifier: row.form_identifier ?? '', switchable: switchable.has(ndex) })
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

    // Rows and `forms` run in step; the default form's signature is only known once all are read.
    const defaults = new Map(forms.filter((entry) => entry.isDefault).map((entry) => [entry.ndex, entry]))
    form.rows.forEach((row, index) => row.push(categoryOf(forms[index]!, formFacts[index]!, defaults.get(forms[index]!.ndex))))

    // `venusaur-gmax` is Venusaur's; a Gigantamax form named after the species
    // (`alcremie-gmax`) serves every form of it that is not battle-only.
    const canGigantamax = new Set<number>()
    for (const gmax of forms.filter((entry) => entry.slug.endsWith('-gmax'))) {
        const base = forms.find((entry) => entry.slug === gmax.slug.slice(0, -'-gmax'.length))
        if (base) canGigantamax.add(base.id)
        else
            forms.forEach((entry, index) => {
                if (entry.ndex === gmax.ndex && !formFacts[index]!.battleOnly) canGigantamax.add(entry.id)
            })
    }
    // Female looks for forms whose females differ without being a form of their own: HOME's
    // female render of the same picture. A species PokéAPI splits by gender (Meowstic) gets
    // none: its female is already a form, and would be counted twice.
    const categoryColumn = form.columns.indexOf('category')
    const splitByGender = new Set(forms.filter((_, index) => form.rows[index]![categoryColumn] === 'gender').map((entry) => entry.ndex))
    const spriteColumn = form.columns.indexOf('sprite_key')
    form.columns.push('female_sprite_key', 'female_shiny_sprite_key')
    form.rows.forEach((row, index) => {
        const key = row[spriteColumn] as string | null
        const female = key && !key.startsWith('home/female/') ? key.replace(/^home\//, 'home/female/') : null
        const own = female && artwork.has(female) && !splitByGender.has(forms[index]!.ndex) ? female : null
        row.push(own, shinyOf(own, artwork))
    })

    form.columns.push('can_gigantamax')
    form.rows.forEach((row, index) => row.push(canGigantamax.has(forms[index]!.id)))

    // Slot- and level-range rows collapse to one per (form, game, location, method).
    const areaById = indexBy(locationAreas!, 'id')
    const locationById = indexBy(locations!, 'id')
    const slotById = indexBy(encounterSlots!, 'id')
    const methodById = indexBy(encounterMethods!, 'id')
    const versionById = indexBy(versions!, 'id')
    const seen = new Set<string>()
    const encounter: Table = { columns: ['ndex', 'form_id', 'game', 'location', 'method'], rows: [] }

    for (const row of encounters!) {
        const values = [
            Number(pokemonById.get(row.pokemon_id!)!.species_id),
            varietyForm.get(row.pokemon_id!)!,
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
        type: typeTable, ability: abilityTable, move: moveTable, game: gameTable, pokedex: pokedexTable, pokedexGame
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
