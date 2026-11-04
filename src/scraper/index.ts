/**
 * `bun run data:build` - builds data/dataset.sql from PokéAPI's CSVs (git, no HTTP)
 * and Serebii's HOME list (one polite request), validates it in a local copy of
 * the schema, diffs it against the previous build and writes data/version.json.
 * Load it with `bun run data:load:local`, then `bun run data:load:remote`.
 *
 * Fails loudly - non-zero exit, nothing written - on any unresolved Serebii entry
 * or a dataset that does not pass `check`.
 */
import { buildFromPokeApi, type Table } from './build'
import { check, counts, diff, openDatabase } from './database'
import { fetchEtymology } from './etymology'
import { fetchGameEvidence, homeGames } from './games'
import { matchEntry } from './match'
import { POKEAPI_COMMIT, checkoutPokeApi, readTable } from './pokeapi'
import { fetchDepositable } from './serebii'
import { insert, literal } from './sql'

const DATASET = new URL('../../data/dataset.sql', import.meta.url).pathname
const VERSION = new URL('../../data/version.json', import.meta.url).pathname

/** Children first, so foreign keys hold at every step. */
const DELETE_ORDER = [
    'evolution', 'encounter', 'form_home_game', 'form_ability', 'form_type', 'form', 'pokemon_dex_number', 'pokemon_origin',
    'pokemon_egg_group', 'pokemon', 'generation', 'type', 'ability', 'move', 'meta'
]

const fail = (message: string): never => {
    console.error(`\n✗ ${message}`)
    process.exit(1)
}

await checkoutPokeApi()
const data = await buildFromPokeApi()

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

// Name etymology from Bulbapedia. Every species has a page; a missing one means a title changed.
const nameColumn = data.pokemon.columns.indexOf('name_en')
const etymology = await fetchEtymology(
    data.pokemon.rows.map((row) => ({ ndex: row[0] as number, name: row[nameColumn] as string }))
)
if (etymology.missing.length || etymology.mismatched.length)
    fail(
        `Bulbapedia pages missing: ${etymology.missing.join(', ') || 'none'}\n` +
            `  pages for a different species: ${etymology.mismatched.join(', ') || 'none'}`
    )
const bulbapediaHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(etymology.rows)).digest('hex').slice(0, 12)

const tables: [string, Table][] = [
    ['generation', data.generation],
    ['type', data.type],
    ['ability', data.ability],
    ['move', data.move],
    ['pokemon', data.pokemon],
    ['pokemon_egg_group', data.eggGroup],
    ['pokemon_origin', { columns: ['ndex', 'lang', 'note'], rows: etymology.rows }],
    ['pokemon_dex_number', data.dexNumber],
    ['form', data.form],
    ['form_type', data.formType],
    ['form_ability', data.formAbility],
    ['form_home_game', formHomeGame],
    ['encounter', data.encounter],
    ['evolution', data.evolution],
    ['meta', { columns: ['key', 'value'], rows: [['source_pokeapi', POKEAPI_COMMIT], ['source_serebii', serebiiHash], ['source_bulbapedia', bulbapediaHash]] }]
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
const version = new Bun.CryptoHasher('sha256').update(body).digest('hex').slice(0, 12)
const generatedAt = new Date().toISOString()
const sql = `${body}\nINSERT INTO meta (key, value) VALUES ('generated_at', ${literal(generatedAt)});\n`

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

const byLanguage = Object.groupBy(etymology.rows, ([, language]) => language)
console.log(
    `  etymology: ${Object.entries(byLanguage).map(([language, rows]) => `${language} ${rows!.length}`).join(', ')}`
)
if (etymology.unknownTemplates.size)
    console.log(`  ⚠ templates rendered by guess (add them to src/scraper/wikitext.ts): ${[...etymology.unknownTemplates].join(', ')}`)
