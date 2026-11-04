import type { Database as Sqlite } from 'bun:sqlite'
import { openDatabase } from '@/scraper/database'

/**
 * A `bun:sqlite`-backed stand-in for a D1 binding.
 *
 * Tests drive the real `drizzle-orm/d1` driver through this, so the code under
 * test is exactly the production code path - same query builder, same driver,
 * same generated SQL - with no workerd, no wrangler and no network. Bun's SQLite
 * ships FTS5, so even the trigram search is genuine rather than stubbed.
 *
 * Only what our code actually calls is implemented: `withSession()` (src/db/client.ts)
 * and what Drizzle's D1 driver uses, `prepare().bind().all()/run()/raw()` and `batch()`.
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
     * Cast at the boundary: D1Database declares members (dump, exec) that nothing
     * here touches, and stubbing them would be noise pretending to be coverage.
     */
    binding: D1Database
    close(): void
}

/** The fixture, as a load would run it. Exported so a test can load it twice. */
export const seedSql = () => Bun.file(new URL('../../data/seed.sql', import.meta.url)).text()

/** A migrated, seeded in-memory database - the same loader the data build validates with. */
export const createSqlite = async (): Promise<Sqlite> => openDatabase(await seedSql())

export const createLocalD1 = async (): Promise<LocalD1> => {
    const sqlite = await createSqlite()

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

    return { binding: client as unknown as D1Database, close: () => sqlite.close() }
}
