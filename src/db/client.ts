import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

/**
 * Wraps a D1 binding in Drizzle. Cheap to construct - one per request in
 * src/api/handler.ts - and the single place the driver is chosen.
 */
export const createDb = (d1: D1Database) => drizzle(d1, { schema })

export type Db = ReturnType<typeof createDb>
