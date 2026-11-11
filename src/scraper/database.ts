import { Database } from 'bun:sqlite'

const MIGRATIONS = new URL('../db/migrations/', import.meta.url)

/**
 * An in-memory SQLite database with every migration applied and `sql` loaded.
 * Foreign keys are on because D1 enforces them and SQLite does not by default -
 * a broken reference must fail here before it fails in production.
 */
export const openDatabase = async (sql: string): Promise<Database> => {
    const sqlite = new Database(':memory:')
    sqlite.run('PRAGMA foreign_keys = ON')

    const files = Array.from(new Bun.Glob('*.sql').scanSync({ cwd: MIGRATIONS.pathname })).sort()
    for (const file of files) sqlite.run(await Bun.file(new URL(file, MIGRATIONS)).text())

    sqlite.run(sql)
    return sqlite
}

const meta = () => ({ duration: 0, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 })

class Statement {
    constructor(
        private readonly sqlite: Database,
        private readonly sql: string,
        private readonly values: unknown[] = []
    ) {}

    bind(...values: unknown[]) {
        // D1's limit, which bun:sqlite does not have: without it a query that only fails in production passes here.
        if (values.length > 100) throw new Error(`D1 allows at most 100 bound parameters; got ${values.length}`)
        return new Statement(this.sqlite, this.sql, values)
    }

    async all() {
        return { results: this.sqlite.query(this.sql).all(...(this.values as never[])), success: true, meta: meta() }
    }

    /** D1 returns positional rows here; Drizzle uses it for array-mode selects. */
    async raw() {
        return this.sqlite.query(this.sql).values(...(this.values as never[]))
    }

    async run() {
        this.sqlite.query(this.sql).run(...(this.values as never[]))
        return { results: [], success: true, meta: meta() }
    }
}

/**
 * A D1 binding backed by `sqlite`, so the real `drizzle-orm/d1` driver - same
 * query builder, same generated SQL, FTS5 included - runs without workerd. Used by
 * the tests and by `bun run data:check` to drive the API over a built dataset.
 *
 * Only what our code calls is implemented: `withSession()` (src/db/client.ts) and
 * what Drizzle's driver uses, `prepare().bind().all()/run()/raw()` and `batch()`.
 * The cast is at this boundary: D1Database's other members (dump, exec) are never
 * touched, and stubbing them would be noise pretending to be coverage.
 */
export const asD1 = (sqlite: Database): D1Database => {
    const client = {
        // Sessions only matter for replicas; locally the database is the session.
        withSession: () => client,
        prepare: (sql: string) => new Statement(sqlite, sql),
        batch: async (statements: Statement[]) => {
            const results = []
            for (const statement of statements) results.push(await statement.all())
            return results
        }
    }
    return client as unknown as D1Database
}

/** Every dataset table, children first so the build's DELETEs hold foreign keys at every step. The order is in dataset.sql, so it is part of the version hash. */
export const TABLES = [
    'evolution', 'encounter', 'form_shiny', 'form_home_game', 'form_ability', 'form_type', 'form', 'pokemon_dex_number', 'availability', 'pokedex_entry', 'pokemon_origin',
    'pokemon_egg_group', 'pokemon', 'pokedex_game', 'pokedex', 'game', 'generation', 'type', 'ability', 'move', 'meta'
] as const

export const counts = (sqlite: Database) =>
    Object.fromEntries(
        TABLES.map((table) => [table, (sqlite.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n])
    )

/** Problems a loaded dataset must not have; empty when it is fit to ship. */
export const check = (sqlite: Database): string[] => {
    const problems: string[] = []
    const scalar = (sql: string) => Object.values(sqlite.query(sql).get() as object)[0] as number

    try {
        sqlite.run("INSERT INTO pokemon_fts(pokemon_fts, rank) VALUES('integrity-check', 1)")
    } catch (error) {
        problems.push(`search index does not match pokemon: ${error}`)
    }

    const withoutDefault = scalar(
        'SELECT count(*) FROM pokemon p WHERE NOT EXISTS (SELECT 1 FROM form f WHERE f.ndex = p.ndex AND f.is_default = 1)'
    )
    if (withoutDefault) problems.push(`${withoutDefault} species have no default form`)

    const homeless = scalar(
        'SELECT count(*) FROM form_home_game g JOIN form f ON f.id = g.form_id WHERE f.depositable = 0'
    )
    if (homeless) problems.push(`${homeless} HOME game rows belong to forms HOME cannot store`)

    // Not a foreign key: the API would list another species' form among this one's encounters.
    const strayEncounters = scalar('SELECT count(*) FROM encounter e JOIN form f ON f.id = e.form_id WHERE f.ndex != e.ndex')
    if (strayEncounters) problems.push(`${strayEncounters} encounters name a form of another species`)

    // Every form HOME can store has artwork today; a sprites bump that loses some should stop the build.
    const unpictured = scalar('SELECT count(*) FROM form WHERE depositable = 1 AND sprite_key IS NULL')
    if (unpictured) problems.push(`${unpictured} depositable forms have no artwork in PokeAPI/sprites`)

    // The name tables are not foreign keys; an identifier without a name would vanish from the API's joins.
    const unnamed = scalar(`SELECT
        (SELECT count(*) FROM form_type WHERE type NOT IN (SELECT slug FROM type)) +
        (SELECT count(*) FROM form_ability WHERE ability NOT IN (SELECT slug FROM ability)) +
        (SELECT count(*) FROM evolution, json_each(evolution.conditions) c
            WHERE (c.key IN ('knownMove', 'usedMove') AND c.value NOT IN (SELECT slug FROM move))
               OR (c.key IN ('knownMoveType', 'partyType') AND c.value NOT IN (SELECT slug FROM type)))`)
    if (unnamed) problems.push(`${unnamed} type, ability or move identifiers have no name row`)

    // /v1/games promises to resolve every game another endpoint returns.
    const unlisted = scalar(`SELECT
        (SELECT count(*) FROM pokedex_entry WHERE game NOT IN (SELECT slug FROM game)) +
        (SELECT count(*) FROM availability WHERE game NOT IN (SELECT slug FROM game)) +
        (SELECT count(*) FROM encounter WHERE game NOT IN (SELECT slug FROM game)) +
        (SELECT count(*) FROM evolution WHERE game NOT IN (SELECT version_group FROM game)) +
        (SELECT count(*) FROM form_home_game WHERE game NOT IN (SELECT version_group FROM game)) +
        (SELECT count(*) FROM pokedex_game WHERE version_group NOT IN (SELECT version_group FROM game)) +
        (SELECT count(*) FROM game WHERE base_game NOT IN (SELECT slug FROM game))`)
    if (unlisted) problems.push(`${unlisted} rows name a game or version group the game table does not list`)

    // Not a foreign key, like the name tables: /v1/pokedexes lists only the pokedex table.
    const undescribed = scalar('SELECT count(DISTINCT pokedex) FROM pokemon_dex_number WHERE pokedex NOT IN (SELECT slug FROM pokedex)')
    if (undescribed) problems.push(`${undescribed} Pokédexes have dex numbers but no pokedex row`)

    if (!scalar("SELECT count(*) FROM meta WHERE key = 'count_pokemon'"))
        problems.push('meta has no stored counts; /v1/meta would report 0')

    return problems
}

/** Primary-key column names of `table`, in key order. */
const keyOf = (sqlite: Database, table: string) =>
    (sqlite.query(`PRAGMA table_info(${table})`).all() as { name: string; pk: number }[])
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name)

const rowsByKey = (sqlite: Database, table: string) => {
    const key = keyOf(sqlite, table)
    return new Map(
        (sqlite.query(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]).map((row) => [
            key.map((column) => row[column]).join('|'),
            JSON.stringify(row)
        ])
    )
}

/** Per table: rows added, removed and changed, with a few example keys of each. */
export const diff = (before: Database, after: Database) =>
    TABLES.filter((table) => table !== 'meta').map((table) => {
        const old = rowsByKey(before, table)
        const now = rowsByKey(after, table)
        const added = [...now.keys()].filter((key) => !old.has(key))
        const removed = [...old.keys()].filter((key) => !now.has(key))
        const changed = [...now.keys()].filter((key) => old.has(key) && old.get(key) !== now.get(key))
        return { table, added, removed, changed }
    })
