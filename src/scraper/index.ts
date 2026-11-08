/**
 * `bun run data:build` - builds data/dataset.sql from PokéAPI's CSVs (git, no HTTP)
 * Serebii's HOME list (one polite request), Bulbapedia's species pages and pokeos's
 * flags, pronunciations and recent encounters (both cached), validates it in a local copy of
 * the schema, diffs it against the previous build and writes data/version.json.
 * Load it with `bun run data:load:local`, then `bun run data:load:remote`.
 *
 * Fails loudly - non-zero exit, nothing written - on any unresolved Serebii entry
 * or a dataset that does not pass `check`.
 */
import { alphaFormsOf, legendsArceusAlphas, ZA_ALPHA_PAGE, zaAlphaRowsOf } from './alpha'
import { buildFromPokeApi, type Table } from './build'
import { check, counts, diff, openDatabase } from './database'
import { fetchSpeciesPages, fetchWikitext } from './bulbapedia'
import { originsOf } from './etymology'
import { ORIGIN_MARKS, availabilityOf, dexEntriesOf, exclusivesOf } from './pokedex'
import { fetchGameEvidence, homeGames } from './games'
import { matchEntry } from './match'
import { POKEAPI_COMMIT, checkoutPokeApi, readTable } from './pokeapi'
import { fetchPokeos, formResolver, shinyLockedForms } from './pokeos'
import { fetchDepositable } from './serebii'
import { SHINY_PAGE, shinyRowsOf, shinyTableOf } from './shiny'
import { SPRITES_COMMIT, artworkKeys, checkoutArtwork } from './sprites'
import { STAMP, insert, literal, versionOf } from './sql'

const DATASET = new URL('../../data/dataset.sql', import.meta.url).pathname
const VERSION = new URL('../../data/version.json', import.meta.url).pathname

/** Children first, so foreign keys hold at every step. */
const DELETE_ORDER = [
    'evolution', 'encounter', 'form_shiny', 'form_home_game', 'form_ability', 'form_type', 'form', 'pokemon_dex_number', 'availability', 'pokedex_entry_revision', 'pokedex_entry', 'pokemon_origin',
    'pokemon_egg_group', 'pokemon', 'generation', 'type', 'ability', 'move', 'meta'
]

const fail = (message: string): never => {
    console.error(`\n✗ ${message}`)
    process.exit(1)
}

await checkoutPokeApi()
await checkoutArtwork()
const data = await buildFromPokeApi(await artworkKeys())

// HOME: which forms can be stored, from Serebii's box list.
const { entries } = await fetchDepositable()
const matches = entries.map((entry) => matchEntry(entry, data.forms))
const unresolved = matches.filter((match) => match.kind !== 'matched')

if (unresolved.length)
    fail(
        `${unresolved.length} Serebii entries need an override in src/scraper/match.ts:\n` +
            unresolved
                .map((m) => `  ${m.kind} ${m.entry.ndex}${m.entry.code} "${m.entry.label}" → ${'candidates' in m ? m.candidates.join(' ') : ''}`)
                .join('\n')
    )

const depositable = new Set(matches.flatMap((match) => (match.kind === 'matched' ? match.forms.map((form) => form.id) : [])))

// HOME cannot store battle-only forms; a match landing on one means the matcher went wrong.
const battleOnly = new Set((await readTable('pokemon_forms')).filter((row) => row.is_battle_only === '1').map((row) => Number(row.id)))
const wrong = data.forms.filter((form) => depositable.has(form.id) && battleOnly.has(form.id))
if (wrong.length) fail(`Serebii entries matched battle-only forms: ${wrong.map((form) => form.slug).join(' ')}`)

// Per game: which depositable forms can be moved in, from each game's availability pages.
const formsByCode = new Map<string, typeof data.forms>()
for (const match of matches)
    if (match.kind === 'matched') {
        const key = `${match.entry.ndex}${match.entry.code}`
        formsByCode.set(key, [...(formsByCode.get(key) ?? []), ...match.forms])
    }

const evidence = await fetchGameEvidence()
const gameRows = homeGames(data.forms, depositable, formsByCode, evidence)

// What was used, not when it was fetched: unchanged pages must not change the version.
const serebiiHash = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify([entries, [...evidence].map(([game, { codes }]) => [game, [...codes].sort()])]))
    .digest('hex')
    .slice(0, 12)

const depositableColumn = data.form.columns.indexOf('depositable')
for (const row of data.form.rows) row[depositableColumn] = depositable.has(row[0] as number)

const formHomeGame: Table = { columns: ['form_id', 'game'], rows: gameRows }

// Name etymology, Pokédex entries and game locations from Bulbapedia's species
// pages. Every species has one; a missing page means a title changed.
const nameColumn = data.pokemon.columns.indexOf('name_en')
const bulbapedia = await fetchSpeciesPages(
    data.pokemon.rows.map((row) => ({ ndex: row[0] as number, name: row[nameColumn] as string }))
)
if (bulbapedia.missing.length || bulbapedia.mismatched.length)
    fail(
        `Bulbapedia pages missing: ${bulbapedia.missing.join(', ') || 'none'}\n` +
            `  pages for a different species: ${bulbapedia.mismatched.join(', ') || 'none'}`
    )

const versionRows = await readTable('versions')
const versions = new Set(versionRows.map((row) => row.identifier!))
const siblings = new Map(
    versionRows.map((row) => [
        row.identifier!,
        versionRows.filter((other) => other.version_group_id === row.version_group_id && other.id !== row.id).map((other) => other.identifier!)
    ])
)
// The forms an entry printing the form's type stands for (Silvally's "This is its <Type>-type form."):
// every form but the default, with its form name and its first type's English name.
const typeNames = new Map(data.type.rows.map((row) => [row[0] as string, row[1] as string]))
const firstTypes = new Map(data.formType.rows.filter((row) => row[1] === 1).map((row) => [row[0] as number, row[2] as string]))
const typeFormsOf = (ndex: number) =>
    data.forms
        .filter((form) => form.ndex === ndex && !form.isDefault && form.formName)
        .map((form): [string, string] => [form.formName!, typeNames.get(firstTypes.get(form.id)!)!])
const unknownTemplates = new Set<string>()
const skippedGames = new Set<string>()
const origins: Table = { columns: ['ndex', 'lang', 'note'], rows: [] }
const pokedexEntry: Table = { columns: ['ndex', 'form', 'game', 'text'], rows: [] }
const pokedexRevision: Table = { columns: ['ndex', 'form', 'game', 'revision', 'text'], rows: [] }
const availability: Table = { columns: ['ndex', 'game', 'dlc', 'area', 'obtainable'], rows: [] }
for (const [ndex, wikitext] of bulbapedia.pages) {
    for (const row of originsOf(wikitext, unknownTemplates)) origins.rows.push([ndex, ...row])
    const dex = dexEntriesOf(wikitext, versions, unknownTemplates, typeFormsOf(ndex))
    for (const row of dex.revisions) pokedexRevision.rows.push([ndex, ...row])
    for (const [table, { rows, skipped }] of [
        [pokedexEntry, dex],
        [availability, availabilityOf(wikitext, versions, unknownTemplates)]
    ] as const) {
        for (const row of rows) table.rows.push([ndex, ...row])
        for (const label of skipped) skippedGames.add(label)
    }
}
// Shiny availability per generation for the forms Bulbapedia lists as hard to get shiny.
const shiny = shinyRowsOf(shinyTableOf(await fetchWikitext(SHINY_PAGE)), data.forms)
if (shiny.unresolved.length)
    fail(`"${SHINY_PAGE}" rows that match no form - add them to GROUPS in src/scraper/shiny.ts: ${shiny.unresolved.join(', ')}`)
const formShiny: Table = { columns: ['form_id', 'generation', 'status', 'games'], rows: shiny.rows }

const exclusive = exclusivesOf(availability.rows as [number, string, string, string | null, boolean][], siblings)
availability.columns.push('exclusive')
availability.columns.push('origin_mark')
for (const row of availability.rows) row.push(row[4] === true && exclusive.has(`${row[0]}|${row[1]}`), ORIGIN_MARKS[row[1] as string] ?? null)

// Which forms can be alphas: Legends: Arceus by Bulbapedia's rule, Legends: Z-A from its table.
const inGame = (game: string) => new Set(gameRows.filter(([, g]) => g === game).map(([id]) => id))
const legendaryColumns = ['is_legendary', 'is_mythical'].map((column) => data.pokemon.columns.indexOf(column))
const legendary = new Set(data.pokemon.rows.filter((row) => legendaryColumns.some((column) => row[column])).map((row) => row[0] as number))
const alphasLA = legendsArceusAlphas(data.forms, inGame('legends-arceus'), legendary)
const alphasZA = alphaFormsOf(zaAlphaRowsOf(await fetchWikitext(ZA_ALPHA_PAGE)), data.forms, inGame('legends-za'))
data.form.columns.push('alpha_legends_arceus', 'alpha_legends_za')
for (const row of data.form.rows) row.push(alphasLA.has(row[0] as number), alphasZA.has(row[0] as number))
const bulbapediaHash = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify([origins.rows, pokedexEntry.rows, pokedexRevision.rows, availability.rows, formShiny.rows, [...alphasZA]]))
    .digest('hex')
    .slice(0, 12)

// Species flags, pronunciations, shiny locks, and encounters for the games
// PokéAPI has none for, from pokeos.com.
const pokeos = await fetchPokeos()
const speciesSlug = new Map(data.pokemon.rows.map((row) => [row[0] as number, row[1] as string]))
data.pokemon.columns.push('is_sub_legendary', 'is_ultra_beast', 'is_paradox', 'pronunciation', 'pronunciation_ipa')
for (const row of data.pokemon.rows) {
    const flags = pokeos.flags.get(row[0] as number)
    const said = pokeos.pronunciations.get(row[0] as number)
    row.push(flags?.subLegendary ?? false, flags?.ultraBeast ?? false, flags?.paradox ?? false, said?.respelling ?? null, said?.ipa ?? null)
}
const shinyLocked = shinyLockedForms(pokeos.rows, data.forms, speciesSlug)
data.form.columns.push('is_shiny_locked')
for (const row of data.form.rows) row.push(shinyLocked.ids.has(row[0] as number))
// Only games PokéAPI has no encounters for, so its rows take over once it has some.
const pokeApiGames = new Set(data.encounter.rows.map((row) => row[2]))
const pokeosForm = formResolver(data.forms, speciesSlug)
const pokeosRowById = new Map(pokeos.rows.map((row) => [row.id, row]))
// A form homedex lacks is left out rather than filed under the species' default form, which would be wrong.
const unplacedForms = new Set<string>()
const pokeosEncounters = pokeos.encounters.flatMap(([ndex, pokeosId, game, location, method]) => {
    if (!speciesSlug.has(ndex) || !versions.has(game) || pokeApiGames.has(game)) return []
    const row = pokeosRowById.get(pokeosId)!
    const formId = pokeosForm(row)
    if (formId === undefined) {
        unplacedForms.add(row.identifier)
        return []
    }
    return [[ndex, formId, game, location, method]]
})
data.encounter.rows.push(...pokeosEncounters)
const pokeosHash = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify([[...pokeos.flags], [...pokeos.pronunciations], [...shinyLocked.ids], pokeosEncounters]))
    .digest('hex')
    .slice(0, 12)

const tables: [string, Table][] = [
    ['generation', data.generation],
    ['type', data.type],
    ['ability', data.ability],
    ['move', data.move],
    ['pokemon', data.pokemon],
    ['pokemon_egg_group', data.eggGroup],
    ['pokemon_origin', origins],
    ['pokedex_entry', pokedexEntry],
    ['pokedex_entry_revision', pokedexRevision],
    ['availability', availability],
    ['pokemon_dex_number', data.dexNumber],
    ['form', data.form],
    ['form_type', data.formType],
    ['form_ability', data.formAbility],
    ['form_home_game', formHomeGame],
    ['form_shiny', formShiny],
    ['encounter', data.encounter],
    ['evolution', data.evolution],
    ['meta', { columns: ['key', 'value'], rows: [['source_pokeapi', POKEAPI_COMMIT], ['source_sprites', SPRITES_COMMIT], ['source_serebii', serebiiHash], ['source_bulbapedia', bulbapediaHash], ['source_pokeos', pokeosHash]] }]
]

const body = [
    '-- Generated by `bun run data:build`. Do not edit; rebuild instead.',
    ...DELETE_ORDER.map((table) => `DELETE FROM ${table};`),
    ...tables.flatMap(([table, { columns, rows }]) => insert(table, columns, rows)),
    `INSERT INTO meta (key, value)
    SELECT 'count_pokemon', count(*) FROM pokemon
    UNION ALL SELECT 'count_forms', count(*) FROM form
    UNION ALL SELECT 'count_encounters', count(*) FROM encounter;`,
    "INSERT INTO pokemon_fts(pokemon_fts) VALUES('rebuild');"
].join('\n')

// The version hashes the data, not the time it was built, so an unchanged rebuild keeps every ETag valid.
const version = versionOf(body)
const generatedAt = new Date().toISOString()
// data_version and loaded_at (the database's clock, at load time) let CI deploy only once these rows are in.
const sql = `${body}${STAMP}, ${literal(generatedAt)}), ('data_version', ${literal(version)}),
    ('loaded_at', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
`

const next = await openDatabase(sql).catch((error) => fail(`the dataset does not load: ${error}`))
const problems = check(next)
if (problems.length) fail(`the dataset is not fit to ship:\n  ${problems.join('\n  ')}`)

const previous = Bun.file(DATASET)
if (await previous.exists()) {
    const before = await openDatabase(await previous.text()).catch(() => null)
    console.log(before ? '\nChanges since the previous build:' : '\nPrevious build does not load against this schema; skipping the diff.')
    if (before)
        for (const { table, added, removed, changed } of diff(before, next))
            if (added.length || removed.length || changed.length)
                console.log(
                    `  ${table}: +${added.length} -${removed.length} ~${changed.length}`,
                    [...added.slice(0, 3).map((k) => `+${k}`), ...removed.slice(0, 3).map((k) => `-${k}`), ...changed.slice(0, 3).map((k) => `~${k}`)].join(' ')
                )
}

await Bun.write(DATASET, sql)
await Bun.write(VERSION, `${JSON.stringify({ version, pokeapi: POKEAPI_COMMIT }, null, 4)}\n`)

console.log(`\n✓ data/dataset.sql (${(Buffer.byteLength(sql) / 1e6).toFixed(1)} MB), version ${version}`)
console.log('  rows:', counts(next))
console.log(`  HOME: ${depositable.size} of ${data.forms.length} forms depositable`)
for (const [game, { codes }] of evidence) {
    const unknown = [...codes].filter((code) => !formsByCode.has(code))
    console.log(
        `    ${game}: ${gameRows.filter(([, g]) => g === game).length} forms`,
        unknown.length ? `(page codes for forms HOME cannot store: ${unknown.join(' ')})` : ''
    )
}
const placed = new Set(gameRows.map(([id]) => id))
const nowhere = data.forms.filter((form) => depositable.has(form.id) && !placed.has(form.id))
console.log(`    depositable but in no game: ${nowhere.length}`, nowhere.map((form) => form.slug).join(' '))
const spriteColumn = data.form.columns.indexOf('sprite_key')
const noArtwork = data.form.rows.filter((row) => row[spriteColumn] === null).map((row) => row[2])
console.log(`  artwork: ${data.form.rows.length - noArtwork.length} of ${data.form.rows.length} forms`, noArtwork.join(' '))
const shinyColumn = data.form.columns.indexOf('shiny_sprite_key')
const noShiny = data.form.rows.filter((row) => row[spriteColumn] !== null && row[shinyColumn] === null).map((row) => row[2])
console.log(`    with artwork but no shiny: ${noShiny.length}`, noShiny.join(' '))

const byLanguage = Object.groupBy(origins.rows, ([, language]) => language as string)
console.log(
    `  etymology: ${Object.entries(byLanguage).map(([language, rows]) => `${language} ${rows!.length}`).join(', ')}`
)
console.log(`  Pokédex entries: ${pokedexEntry.rows.length} (${pokedexRevision.rows.length} earlier revisions), game locations: ${availability.rows.length}`)
console.log(`  alphas: Legends: Arceus ${alphasLA.size} forms, Legends: Z-A ${alphasZA.size} forms`)
console.log(`  shiny availability: ${new Set(formShiny.rows.map(([id]) => id)).size} forms, ${formShiny.rows.length} generation rows`)
console.log(`    labels that are not a main-series game, left out: ${[...skippedGames].join(', ')}`)
console.log(
    `  pokeos: ${pokeos.pronunciations.size} pronunciations, ${shinyLocked.ids.size} shiny-locked forms,`,
    `${pokeosEncounters.length} encounters (${Object.entries(Object.groupBy(pokeosEncounters, ([, , game]) => game as string)).map(([game, rows]) => `${game} ${rows!.length}`).join(', ')})`
)
console.log(`    shiny-locked forms homedex does not have: ${shinyLocked.unmatched.join(' ') || 'none'}`)
if (unplacedForms.size) console.log(`  ⚠ pokeos encounters for forms homedex does not have, left out: ${[...unplacedForms].join(' ')}`)
const pokeosDropped = pokeos.encounters.filter(([ndex, , game]) => !speciesSlug.has(ndex) || !versions.has(game))
if (pokeosDropped.length)
    console.log(`  ⚠ pokeos encounters for an unknown species or game, left out: ${pokeosDropped.length}`, pokeosDropped.slice(0, 5).map((row) => row.join('/')).join(' '))
if (unknownTemplates.size)
    console.log(`  ⚠ templates rendered by guess (add them to src/scraper/wikitext.ts): ${[...unknownTemplates].join(', ')}`)
