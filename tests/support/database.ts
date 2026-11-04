import { createDb, type Db } from '../../src/db/client'
import type { Env, RateLimiter } from '../../src/api/platform'
import { createLocalD1 } from './d1'

export interface TestDb {
    db: Db
    close(): void
}

/** A Drizzle client over an in-memory, migrated, seeded database. */
export const createTestDb = async (): Promise<TestDb> => {
    const { binding, close } = await createLocalD1()

    return { db: createDb(binding), close }
}

/** Allows everything. */
export const permissive: RateLimiter = { limit: async () => ({ success: true }) }

/** Allows `allowed` calls, then refuses - enough to prove the 429 path. */
export const allowing = (allowed: number): RateLimiter => {
    let seen = 0

    return {
        limit: async () => {
            seen += 1
            return { success: seen <= allowed }
        }
    }
}

/** The database is always the real in-memory one; only bindings around it vary. */
export const createTestEnv = async (
    overrides: Partial<Omit<Env, 'DB'>> = {}
): Promise<Env & { close(): void }> => {
    const { binding, close } = await createLocalD1()

    return {
        DB: binding,
        RL_GLOBAL: permissive,
        RL_SEARCH: permissive,
        DATA_VERSION: 'test-0001',
        IMAGE_BASE_URL: 'https://images.test',
        close,
        ...overrides
    }
}
