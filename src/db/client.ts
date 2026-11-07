import { drizzle } from 'drizzle-orm/d1'

/**
 * Wraps a D1 binding in Drizzle. Cheap to construct - one per request in
 * src/api/handler.ts - and the single place the driver is chosen.
 *
 * Reads go through a D1 session so a nearby read replica can answer them (Void
 * turns replication on when it creates the database); a bare binding always
 * reads from the primary. 'first-unconstrained' because the API never writes:
 * data changes only through a load, which must have reached the replicas before
 * the deploy that announces its DATA_VERSION - or the edge caches old rows under
 * the new version for a week.
 */
export const createDb = (d1: D1Database) =>
    // Drizzle's type asks for a D1Database, but it only calls prepare() and batch(), which a session has.
    drizzle(d1.withSession('first-unconstrained') as unknown as D1Database)

export type Db = ReturnType<typeof createDb>
