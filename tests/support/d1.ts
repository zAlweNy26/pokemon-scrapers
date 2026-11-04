import { Database as Sqlite } from 'bun:sqlite'

/**
 * A `bun:sqlite`-backed stand-in for a D1 binding.
 *
 * Tests drive the real `drizzle-orm/d1` driver through this, so the code under
 * test is exactly the production code path - same query builder, same driver,
 * same generated SQL - with no workerd, no wrangler and no network. Bun's SQLite
 * ships FTS5, so even the trigram search is genuine rather than stubbed.
 *
 * Only the four members Drizzle's D1 driver actually calls are implemented:
 * `prepare().bind().all()/run()/raw()` and `batch()`.
 */
const meta = () => ({ duration: 0, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 })

class Statement {
    constructor(
        private readonly sqlite: Sqlite,
        private readonly sql: string,
        private readonly values: unknown[] = []
    ) {}

    bind(...values: unknown[]) {
        return new Statement(this.sqlite, this.sql, values)
    }

    async all() {
        const results = this.sqlite.query(this.sql).all(...(this.values as never[]))
        return { results, success: true, meta: meta() }
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

export interface LocalD1 {
    /**
     * Cast at the boundary: D1Database declares members (dump, exec, withSession)
     * that Drizzle never touches, and stubbing them would be noise pretending to
     * be coverage.
     */
    binding: D1Database
    close(): void
}

/** The fixture, as a load would run it. Exported so a test can load it twice. */
export const seedSql = () => Bun.file(new URL('../../data/seed.sql', import.meta.url)).text()

/**
 * A migrated, seeded in-memory database. Foreign keys are on because D1 enforces
 * them and SQLite does not by default - a broken reference must fail here first.
 */
export const createSqlite = async (): Promise<Sqlite> => {
    const sqlite = new Sqlite(':memory:')
    sqlite.run('PRAGMA foreign_keys = ON')

    const migrations = new URL('../../src/db/migrations/', import.meta.url)
    const files = Array.from(new Bun.Glob('*.sql').scanSync({ cwd: migrations.pathname })).sort()

    for (const file of files) sqlite.run(await Bun.file(new URL(file, migrations)).text())

    sqlite.run(await seedSql())

    return sqlite
}

export const createLocalD1 = async (): Promise<LocalD1> => {
    const sqlite = await createSqlite()

    const client = {
        prepare: (sql: string) => new Statement(sqlite, sql),
        batch: async (statements: Statement[]) => {
            const results = []
            for (const statement of statements) results.push(await statement.all())

            return results
        }
    }

    return { binding: client as unknown as D1Database, close: () => sqlite.close() }
}
