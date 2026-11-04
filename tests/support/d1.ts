import type { Database as Sqlite } from 'bun:sqlite'
import { asD1, openDatabase } from '@/scraper/database'

export interface LocalD1 {
    binding: D1Database
    close(): void
}

/** The fixture, as a load would run it. Exported so a test can load it twice. */
export const seedSql = () => Bun.file(new URL('../../data/seed.sql', import.meta.url)).text()

/** A migrated, seeded in-memory database - the same loader the data build validates with. */
export const createSqlite = async (): Promise<Sqlite> => openDatabase(await seedSql())

/** The fixture behind a D1 binding, driven through the real Drizzle D1 driver. */
export const createLocalD1 = async (): Promise<LocalD1> => {
    const sqlite = await createSqlite()
    return { binding: asD1(sqlite), close: () => sqlite.close() }
}
