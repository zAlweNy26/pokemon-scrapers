import { relations, sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * The contract between the scraper and the API: the scraper writes it, the API
 * reads it, and nothing else reshapes it. Migrations are generated from this file
 * with `bun run db:generate`.
 *
 * Modelling note: species-level facts (names, category, breeding) live on
 * `pokemon`; anything that varies between forms (types, stats, size, HOME
 * depositability, sprites) lives on `form`. Every species has exactly one row in
 * `form` with `isDefault` set (enforced by `form_one_default_idx`).
 *
 * Localised text is one column per language (`nameEn` ... `nameZhHant`), in the
 * order src/api/names.ts lists the languages. Types, abilities, egg groups, games,
 * locations and methods are PokéAPI identifiers (`water`, `scarlet`), not labels.
 */

/** The name columns of a localised reference table, keyed like `pokemon`'s (src/api/names.ts reads them). */
const localizedNames = () => ({
    nameEn: text('name_en').notNull(),
    nameJa: text('name_ja'),
    nameJaRomaji: text('name_ja_romaji'),
    nameDe: text('name_de'),
    nameFr: text('name_fr'),
    nameIt: text('name_it'),
    nameEs: text('name_es'),
    nameKo: text('name_ko'),
    nameZhHans: text('name_zh_hans'),
    nameZhHant: text('name_zh_hant')
})

/**
 * Display names for the identifiers stored elsewhere: `form_type.type`,
 * `form_ability.ability`, and the moves and types in evolution conditions.
 * Not foreign keys, so existing tables keep their shape; `check()` in
 * src/scraper/database.ts fails a build that leaves an identifier unnamed.
 */
export const type = sqliteTable('type', { slug: text('slug').primaryKey(), ...localizedNames() })
export const ability = sqliteTable('ability', { slug: text('slug').primaryKey(), ...localizedNames() })
export const move = sqliteTable('move', { slug: text('slug').primaryKey(), ...localizedNames() })

export const generation = sqliteTable('generation', {
    id: integer('id').primaryKey(),
    region: text('region').notNull(),
    debut: integer('debut').notNull()
})

export const pokemon = sqliteTable(
    'pokemon',
    {
        ndex: integer('ndex').primaryKey(),
        slug: text('slug').notNull().unique(),
        gen: integer('gen')
            .notNull()
            .references(() => generation.id),
        catchRate: integer('catch_rate'),
        baseFriendship: integer('base_friendship'),
        /** -1 = genderless, otherwise eighths female (0 always male, 8 always female). */
        genderRate: integer('gender_rate'),
        eggCycles: integer('egg_cycles'),
        /** PokéAPI's evolution chain id: species sharing it are one family. */
        evolutionChain: integer('evolution_chain').notNull(),
        isLegendary: integer('is_legendary', { mode: 'boolean' }).notNull().default(false),
        isMythical: integer('is_mythical', { mode: 'boolean' }).notNull().default(false),
        isBaby: integer('is_baby', { mode: 'boolean' }).notNull().default(false),
        /** From pokeos: the legendaries PokéAPI's `isLegendary` does not tell apart (Articuno, the Tapus). Both are set. */
        isSubLegendary: integer('is_sub_legendary', { mode: 'boolean' }).notNull().default(false),
        isUltraBeast: integer('is_ultra_beast', { mode: 'boolean' }).notNull().default(false),
        isParadox: integer('is_paradox', { mode: 'boolean' }).notNull().default(false),
        /** English pronunciation from pokeos: a respelling ("BULL-buh-sohr") and IPA. */
        pronunciation: text('pronunciation'),
        pronunciationIpa: text('pronunciation_ipa'),
        hasGenderDifferences: integer('has_gender_differences', { mode: 'boolean' }).notNull().default(false),
        formsSwitchable: integer('forms_switchable', { mode: 'boolean' }).notNull().default(false),
        growthRate: text('growth_rate').notNull(),
        color: text('color').notNull(),
        shape: text('shape').notNull(),
        /** Only Gens 1-3 had habitats. */
        habitat: text('habitat'),
        nameEn: text('name_en').notNull(),
        nameJa: text('name_ja'),
        nameJaRomaji: text('name_ja_romaji'),
        nameDe: text('name_de'),
        nameFr: text('name_fr'),
        nameIt: text('name_it'),
        nameEs: text('name_es'),
        nameKo: text('name_ko'),
        nameZhHans: text('name_zh_hans'),
        nameZhHant: text('name_zh_hant'),
        /** The species category ("Mouse Pokémon"), per language. */
        categoryEn: text('category_en'),
        categoryJa: text('category_ja'),
        categoryJaRomaji: text('category_ja_romaji'),
        categoryDe: text('category_de'),
        categoryFr: text('category_fr'),
        categoryIt: text('category_it'),
        categoryEs: text('category_es'),
        categoryKo: text('category_ko'),
        categoryZhHans: text('category_zh_hans'),
        categoryZhHant: text('category_zh_hant')
    },
    (table) => [
        index('pokemon_gen_idx').on(table.gen),
        index('pokemon_name_idx').on(table.nameEn),
        index('pokemon_evolution_chain_idx').on(table.evolutionChain)
    ]
)

/**
 * Pokédex entries in English, from Bulbapedia. `form` is Bulbapedia's form label
 * ("Alolan Form", "Gigantamax"), '' for the species itself; `game` a PokéAPI
 * version identifier. Rows are stored in Bulbapedia's order, oldest game first.
 */
export const pokedexEntry = sqliteTable(
    'pokedex_entry',
    {
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        form: text('form').notNull().default(''),
        game: text('game').notNull(),
        text: text('text').notNull()
    },
    (table) => [primaryKey({ columns: [table.ndex, table.form, table.game] })]
)

/**
 * Where the species can be obtained in each main-series game, from Bulbapedia's
 * "Game locations", as text a reader sees (form notes included). `dlc` is ''
 * for the base game. `obtainable` is false where the game cannot get it on its
 * own; `area` then says how it gets in ("Trade, Event"), when anything.
 */
export const availability = sqliteTable(
    'availability',
    {
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        game: text('game').notNull(),
        dlc: text('dlc').notNull().default(''),
        area: text('area'),
        obtainable: integer('obtainable', { mode: 'boolean' }).notNull(),
        /** Obtainable here and in no other version of the group (Scarlet, not Violet); from `exclusivesOf`. */
        exclusive: integer('exclusive', { mode: 'boolean' }).notNull().default(false),
        /** The origin mark a Pokémon caught here carries (`galar`); null for games without one. ORIGIN_MARKS has them. */
        originMark: text('origin_mark')
    },
    (table) => [primaryKey({ columns: [table.ndex, table.game, table.dlc] })]
)

/** Regional Pokédex numbers, keyed by PokéAPI pokedex identifier (`paldea`, `kitakami`). National is `ndex`. */
export const pokemonDexNumber = sqliteTable(
    'pokemon_dex_number',
    {
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        pokedex: text('pokedex').notNull(),
        number: integer('number').notNull()
    },
    (table) => [primaryKey({ columns: [table.ndex, table.pokedex] })]
)

export const pokemonEggGroup = sqliteTable(
    'pokemon_egg_group',
    {
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        eggGroup: text('egg_group').notNull()
    },
    (table) => [primaryKey({ columns: [table.ndex, table.eggGroup] })]
)

/** Name etymology, per language. One of homedex's reasons to exist. */
export const pokemonOrigin = sqliteTable(
    'pokemon_origin',
    {
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        lang: text('lang').notNull(),
        note: text('note').notNull()
    },
    (table) => [primaryKey({ columns: [table.ndex, table.lang] })]
)

export const FORM_CATEGORIES = ['default', 'battle-only', 'regional', 'gender', 'switchable', 'cosmetic', 'variant'] as const
export type FormCategory = (typeof FORM_CATEGORIES)[number]

export const form = sqliteTable(
    'form',
    {
        /** PokéAPI's form id, so ids stay stable across rebuilds. */
        id: integer('id').primaryKey(),
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        slug: text('slug').notNull().unique(),
        nameEn: text('name_en').notNull(),
        nameJa: text('name_ja'),
        nameJaRomaji: text('name_ja_romaji'),
        nameDe: text('name_de'),
        nameFr: text('name_fr'),
        nameIt: text('name_it'),
        nameEs: text('name_es'),
        nameKo: text('name_ko'),
        nameZhHans: text('name_zh_hans'),
        nameZhHant: text('name_zh_hant'),
        isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
        /** Can this form be stored in Pokémon HOME? Which games it can then move to is `formHomeGame`. */
        depositable: integer('depositable', { mode: 'boolean' }).notNull().default(false),
        /** From pokeos: no shiny can be obtained in normal play. */
        isShinyLocked: integer('is_shiny_locked', { mode: 'boolean' }).notNull().default(false),
        heightM: real('height_m'),
        weightKg: real('weight_kg'),
        hp: integer('hp'),
        atk: integer('atk'),
        def: integer('def'),
        spAtk: integer('sp_atk'),
        spDef: integer('sp_def'),
        spd: integer('spd'),
        /** Effort values earned for defeating this form, per stat; all null when unknown. */
        evHp: integer('ev_hp'),
        evAtk: integer('ev_atk'),
        evDef: integer('ev_def'),
        evSpAtk: integer('ev_sp_atk'),
        evSpDef: integer('ev_sp_def'),
        evSpd: integer('ev_spd'),
        baseExperience: integer('base_experience'),
        /** Object prefix in the R2 image bucket; null when no artwork is published. */
        spriteKey: text('sprite_key'),
        /** The shiny artwork's prefix (`shiny/25`), from the same picture as `spriteKey`; null when there is none. */
        shinySpriteKey: text('shiny_sprite_key'),
        /** Has a Gigantamax form of its own: `venusaur-gmax`, or `alcremie-gmax` for every Alcremie. */
        canGigantamax: integer('can_gigantamax', { mode: 'boolean' }).notNull().default(false),
        /** Can appear as an alpha: in Legends: Arceus by Bulbapedia's rule, in Legends: Z-A from its table. */
        alphaLegendsArceus: integer('alpha_legends_arceus', { mode: 'boolean' }).notNull().default(false),
        alphaLegendsZa: integer('alpha_legends_za', { mode: 'boolean' }).notNull().default(false),
        /** Why the form exists; `categoryOf` in src/scraper/build.ts has the rules. */
        category: text('category', { enum: FORM_CATEGORIES }).notNull().default('default')
    },
    (table) => [
        index('form_ndex_idx').on(table.ndex),
        index('form_depositable_idx').on(table.depositable),
        index('form_category_idx').on(table.category),
        // Exactly one default per species: list and search join on it, so a second
        // default would list the species twice. Fails the load instead.
        uniqueIndex('form_one_default_idx').on(table.ndex).where(sql`is_default = 1`)
    ]
)

export const formType = sqliteTable(
    'form_type',
    {
        formId: integer('form_id')
            .notNull()
            .references(() => form.id),
        slot: integer('slot').notNull(),
        type: text('type').notNull()
    },
    (table) => [
        primaryKey({ columns: [table.formId, table.slot] }),
        index('form_type_type_idx').on(table.type)
    ]
)

export const formAbility = sqliteTable(
    'form_ability',
    {
        formId: integer('form_id')
            .notNull()
            .references(() => form.id),
        slot: integer('slot').notNull(),
        ability: text('ability').notNull(),
        isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false)
    },
    (table) => [primaryKey({ columns: [table.formId, table.slot] })]
)

/**
 * The HOME-connected games a form can be moved into from HOME, as PokéAPI
 * version-group identifiers (`scarlet-violet`, `legends-za`).
 */
export const formHomeGame = sqliteTable(
    'form_home_game',
    {
        formId: integer('form_id')
            .notNull()
            .references(() => form.id),
        game: text('game').notNull()
    },
    (table) => [primaryKey({ columns: [table.formId, table.game] })]
)

export const SHINY_STATUSES = ['obtainable', 'event', 'unobtainable'] as const
export type ShinyStatus = (typeof SHINY_STATUSES)[number]

/**
 * Whether a form's shiny can be had, per generation, for the forms Bulbapedia's
 * "List of unobtainable Shiny Pokémon" lists: `obtainable` in game (in `games`
 * when named), `event` (distributions or transfer only), `unobtainable`. The page
 * is per generation and incomplete; a form without rows has no known restriction.
 */
export const formShiny = sqliteTable(
    'form_shiny',
    {
        formId: integer('form_id')
            .notNull()
            .references(() => form.id),
        generation: integer('generation')
            .notNull()
            .references(() => generation.id),
        status: text('status', { enum: SHINY_STATUSES }).notNull(),
        /** The games the page names ("USUM; PE"), as it abbreviates them; null for the whole generation. */
        games: text('games')
    },
    (table) => [primaryKey({ columns: [table.formId, table.generation] })]
)

/**
 * Where a form is found: one row per (form, game, location, method), level ranges
 * and slots collapsed. `ndex` is the form's species, kept for per-species reads.
 */
export const encounter = sqliteTable(
    'encounter',
    {
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        formId: integer('form_id')
            .notNull()
            .references(() => form.id),
        game: text('game').notNull(),
        location: text('location').notNull(),
        method: text('method').notNull()
    },
    (table) => [
        primaryKey({ columns: [table.ndex, table.formId, table.game, table.location, table.method] }),
        index('encounter_form_idx').on(table.formId)
    ]
)

/** What an evolution method requires beyond its trigger; absent keys do not apply. Identifiers are PokéAPI's. */
export interface EvolutionConditions {
    minLevel?: number
    item?: string
    heldItem?: string
    knownMove?: string
    knownMoveType?: string
    usedMove?: string
    minMoveCount?: number
    gender?: 'female' | 'male'
    timeOfDay?: string
    location?: string
    region?: string
    minHappiness?: number
    minBeauty?: number
    minAffection?: number
    /** 1: Attack > Defense, 0: equal, -1: Attack < Defense (Tyrogue). */
    relativePhysicalStats?: number
    partySpecies?: string
    partyType?: string
    tradeSpecies?: string
    minSteps?: number
    minDamageTaken?: number
    natures?: string[]
    percentageChance?: number
    /** PokéAPI's raw rule on hidden values, e.g. `EC 100 % 0 ==` (Tandemaus's 1-in-100 family of three). */
    expression?: string
    overworldRain?: true
    upsideDown?: true
    multiplayer?: true
    nearSpecialRock?: true
}

/**
 * One way `fromNdex` evolves into `ndex`, as PokéAPI lists it: a species can
 * have several (Leafeon: a Moss Rock, later a Leaf Stone). `game` is the
 * version group the method was recorded for; `isDefault` marks the usual one.
 */
export const evolution = sqliteTable(
    'evolution',
    {
        /** PokéAPI's evolution id, so ids stay stable across rebuilds. */
        id: integer('id').primaryKey(),
        fromNdex: integer('from_ndex')
            .notNull()
            .references(() => pokemon.ndex),
        ndex: integer('ndex')
            .notNull()
            .references(() => pokemon.ndex),
        /** Set when only one form evolves (Galarian Linoone → Obstagoon). */
        fromFormId: integer('from_form_id').references(() => form.id),
        /** Set when the result is a specific form (Pikachu → Alolan Raichu in Sun/Moon). */
        intoFormId: integer('into_form_id').references(() => form.id),
        trigger: text('trigger').notNull(),
        game: text('game').notNull(),
        isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
        conditions: text('conditions', { mode: 'json' }).$type<EvolutionConditions>().notNull()
    },
    (table) => [index('evolution_from_idx').on(table.fromNdex), index('evolution_ndex_idx').on(table.ndex)]
)

/** Free-form provenance written by the scraper and surfaced at /v1/meta. */
export const meta = sqliteTable('meta', {
    key: text('key').primaryKey(),
    value: text('value').notNull()
})

export const generationRelations = relations(generation, ({ many }) => ({
    pokemon: many(pokemon)
}))

export const pokemonRelations = relations(pokemon, ({ one, many }) => ({
    generation: one(generation, { fields: [pokemon.gen], references: [generation.id] }),
    forms: many(form),
    eggGroups: many(pokemonEggGroup),
    origins: many(pokemonOrigin),
    dexNumbers: many(pokemonDexNumber),
    encounters: many(encounter)
}))

export const formRelations = relations(form, ({ one, many }) => ({
    pokemon: one(pokemon, { fields: [form.ndex], references: [pokemon.ndex] }),
    types: many(formType),
    abilities: many(formAbility),
    homeGames: many(formHomeGame),
    shiny: many(formShiny)
}))

export const formHomeGameRelations = relations(formHomeGame, ({ one }) => ({
    form: one(form, { fields: [formHomeGame.formId], references: [form.id] })
}))

export const formTypeRelations = relations(formType, ({ one }) => ({
    form: one(form, { fields: [formType.formId], references: [form.id] })
}))

export const formAbilityRelations = relations(formAbility, ({ one }) => ({
    form: one(form, { fields: [formAbility.formId], references: [form.id] })
}))

export type Pokemon = typeof pokemon.$inferSelect
export type Form = typeof form.$inferSelect
export type Generation = typeof generation.$inferSelect
