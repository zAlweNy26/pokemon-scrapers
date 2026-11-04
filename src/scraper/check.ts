/**
 * `bun run data:check` - checks a built data/dataset.sql before it is loaded:
 * structure, value ranges, text encoding, a few facts nobody disputes, and every
 * species, list page and reference endpoint through the real API, response
 * schemas included. Writes .cache/homedex.sqlite to open in any SQLite viewer.
 * Exits non-zero on any issue; gaps the sources leave are printed, not failed.
 */
import { handleRequest } from '@/api/handler'
import { setLogSink } from '@/api/log'
import type { Env, RateLimiter } from '@/api/platform'
import { asD1, check, openDatabase } from './database'

const DATASET = new URL('../../data/dataset.sql', import.meta.url).pathname
const COPY = new URL('../../.cache/homedex.sqlite', import.meta.url).pathname
const LANGUAGES = ['en', 'ja', 'ja_romaji', 'de', 'fr', 'it', 'es', 'ko', 'zh_hans', 'zh_hant']

const file = Bun.file(DATASET)
if (!(await file.exists())) {
    console.error('✗ data/dataset.sql not found - run `bun run data:build` first')
    process.exit(1)
}

const db = await openDatabase(await file.text())
await Bun.write(COPY, db.serialize())

const issues: string[] = []
const scalar = (sql: string) => Object.values(db.query(sql).get() as object)[0]
const all = <T>(sql: string) => db.query(sql).all() as T[]

/** Prints a check; a failing one is an issue. */
const expect = (label: string, ok: boolean, detail: unknown = '') => {
    console.log(`${ok ? '✓' : '✗'} ${label}${detail === '' ? '' : `: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`}`)
    if (!ok) issues.push(label)
}
const none = (label: string, sql: string) => {
    const n = scalar(sql) as number
    expect(label, n === 0, n)
}

console.log('— Structure')
for (const problem of check(db)) expect(problem, false)
expect('no broken foreign keys', all('PRAGMA foreign_key_check').length === 0)
expect('SQLite integrity', scalar('PRAGMA integrity_check') === 'ok')
none('species without exactly one default form', 'SELECT count(*) FROM pokemon p WHERE (SELECT count(*) FROM form f WHERE f.ndex = p.ndex AND f.is_default = 1) != 1')
none('gaps in the dex numbers', 'SELECT max(ndex) - min(ndex) + 1 - count(*) FROM pokemon')
const perGeneration = all<{ n: number }>('SELECT count(*) n FROM pokemon GROUP BY gen ORDER BY gen').map((row) => row.n)
expect('species per generation', JSON.stringify(perGeneration) === '[151,100,135,107,156,72,88,96,120]', perGeneration)

console.log('\n— Values')
none('stats missing or outside 1..255', 'SELECT count(*) FROM form WHERE coalesce(min(hp, atk, def, sp_atk, sp_def, spd), 0) < 1 OR max(hp, atk, def, sp_atk, sp_def, spd) > 255')
none('height or weight <= 0 (unknown is null)', 'SELECT count(*) FROM form WHERE height_m <= 0 OR weight_kg <= 0')
none('catch rate outside 0..255', 'SELECT count(*) FROM pokemon WHERE catch_rate NOT BETWEEN 0 AND 255')
none('gender rate outside -1..8', 'SELECT count(*) FROM pokemon WHERE gender_rate NOT BETWEEN -1 AND 8')
none('forms without one or two types', 'SELECT count(*) FROM form f WHERE (SELECT count(*) FROM form_type t WHERE t.form_id = f.id) NOT IN (1, 2)')
none('storable forms without abilities', 'SELECT count(*) FROM form f WHERE depositable = 1 AND NOT EXISTS (SELECT 1 FROM form_ability a WHERE a.form_id = f.id)')
none('species without egg groups', 'SELECT count(*) FROM pokemon p WHERE NOT EXISTS (SELECT 1 FROM pokemon_egg_group e WHERE e.ndex = p.ndex)')
none('species HOME cannot store at all', 'SELECT count(*) FROM pokemon p WHERE NOT EXISTS (SELECT 1 FROM form f WHERE f.ndex = p.ndex AND f.depositable = 1)')

console.log('\n— Text')
const texts = [
    ...LANGUAGES.flatMap((language) => [`pokemon.name_${language}`, `pokemon.category_${language}`, `form.name_${language}`]),
    'pokemon_origin.note'
].flatMap((column) => {
    const [table, name] = column.split('.')
    return all<{ value: string }>(`SELECT ${name} AS value FROM ${table} WHERE ${name} IS NOT NULL`).map(({ value }) => ({ column, value }))
})
for (const [label, pattern] of [
    ['mojibake', /Ã[\u0080-¿]|Â[\u0080-¿]|â€|�/],
    ['wiki markup or HTML entities', /\{\{|\}\}|\[\[|\]\]|''|<\/?[a-z]|&[a-z#0-9]+;/i],
    ['control characters', /[\u0000-\u0008\u000B-\u001F\u007F]/],
    ['leading or trailing spaces', /^\s|\s$/]
] as const) {
    const hits = texts.filter(({ value }) => pattern.test(value))
    expect(
        `no ${label} in ${texts.length} texts`,
        hits.length === 0,
        hits.length ? hits.slice(0, 3).map(({ column, value }) => `${column}: ${value.slice(0, 50)}`) : ''
    )
}

console.log('\n— Facts')
const fact = (label: string, sql: string, want: unknown) => {
    const got = db.query(sql).get()
    expect(label, JSON.stringify(got) === JSON.stringify(want), got)
}
fact('Pikachu base stats', "SELECT hp, atk, def, sp_atk, sp_def, spd FROM form WHERE slug = 'pikachu'", { hp: 35, atk: 55, def: 40, sp_atk: 50, sp_def: 50, spd: 90 })
fact('Charizard is fire/flying', "SELECT group_concat(type) types FROM (SELECT type FROM form_type t JOIN form f ON f.id = t.form_id WHERE f.slug = 'charizard' ORDER BY slot)", { types: 'fire,flying' })
fact('Bulbasaur in four languages', 'SELECT name_ja, name_de, name_fr, name_ko FROM pokemon WHERE ndex = 1', { name_ja: 'フシギダネ', name_de: 'Bisasam', name_fr: 'Bulbizarre', name_ko: '이상해씨' })
fact('accents survive (Flabébé)', 'SELECT name_en FROM pokemon WHERE ndex = 669', { name_en: 'Flabébé' })
fact('Snorlax weighs 460 kg', "SELECT weight_kg FROM form WHERE slug = 'snorlax'", { weight_kg: 460 })
fact('Mega Charizard X is not storable in HOME', "SELECT depositable FROM form WHERE slug = 'charizard-mega-x'", { depositable: 0 })
fact('a Mega keeps its own name', "SELECT name_en, name_ja FROM form WHERE slug = 'venusaur-mega'", { name_en: 'Mega Venusaur', name_ja: 'メガフシギバナ' })

console.log('\n— Through the API, response schemas included')
setLogSink(() => {})
const allow: RateLimiter = { limit: async () => ({ success: true }) }
const env: Env = { DB: asD1(db), RL_GLOBAL: allow, RL_SEARCH: allow, DATA_VERSION: 'check', IMAGE_BASE_URL: 'https://images.test' }
const paths = [
    ...Array.from({ length: scalar('SELECT count(*) FROM pokemon') as number }, (_, i) => `/v1/pokemon/${i + 1}`),
    ...Array.from({ length: 11 }, (_, i) => `/v1/pokemon?limit=100&offset=${i * 100}`),
    ...['pika', 'Quaj', 'ゲンガ', '皮卡', 'Mr. M', 'farfetch', 'flabé', 'nidoran', 'ピカ', '이상'].map((q) => `/v1/search?q=${encodeURIComponent(q)}`),
    '/v1/types', '/v1/generations', '/v1/meta', '/openapi.json'
]
const failed: string[] = []
for (const path of paths) {
    const response = await handleRequest(new Request(`http://homedex.test${path}`), env)
    if (response.status !== 200) failed.push(`${path} → ${response.status} ${(await response.text()).slice(0, 100)}`)
}
expect(`${paths.length} requests answered 200`, failed.length === 0, failed.length ? failed.slice(0, 3) : '')

console.log('\n— Gaps the sources leave (not failures)')
const missing = (column: string, table: string) =>
    Object.fromEntries(LANGUAGES.map((l) => [l, scalar(`SELECT count(*) FROM ${table} WHERE ${column}_${l} IS NULL`)]).filter(([, n]) => n))
console.log('  categories missing:', missing('category', 'pokemon'))
console.log('  form names missing:', missing('name', 'form'))
console.log('  unknown size:', all<{ slug: string }>('SELECT slug FROM form WHERE height_m IS NULL OR weight_kg IS NULL').map((r) => r.slug).join(' ') || 'none')
console.log('  forms without abilities (none storable):', scalar('SELECT count(*) FROM form f WHERE NOT EXISTS (SELECT 1 FROM form_ability a WHERE a.form_id = f.id)'))
console.log('  storable but in no game:', all<{ slug: string }>('SELECT slug FROM form f WHERE depositable = 1 AND NOT EXISTS (SELECT 1 FROM form_home_game g WHERE g.form_id = f.id)').map((r) => r.slug).join(' ') || 'none')

console.log(`\nLocal copy: .cache/homedex.sqlite`)
if (issues.length) {
    console.error(`✗ ${issues.length} issue(s): ${issues.join('; ')}`)
    process.exit(1)
}
console.log('✓ no issues')
