import { describe, expect, test } from 'bun:test'
import { createDb } from '@/db/client'
import { pokemon } from '@/db/schema'
import { speciesDepositable } from '@/api/modules/pokemon/service'
import { asD1, check } from '@/scraper/database'
import { createSqlite, seedSql } from './support/d1'

/**
 * Guards on the data itself rather than the API: the scraper's load will follow
 * data/seed.sql, so what this proves about the fixture holds for real loads.
 */
describe('loading data', () => {
    test('a reload after names changed leaves the search index intact', async () => {
        // `DELETE FROM pokemon_fts` reads the current rows to find what to remove,
        // so once names had changed it removed the wrong words and corrupted the index.
        const sqlite = await createSqlite()
        sqlite.run("UPDATE pokemon SET name_de = 'Zzzzz' WHERE ndex = 658")

        sqlite.run(await seedSql())

        expect(() =>
            sqlite.run("INSERT INTO pokemon_fts(pokemon_fts, rank) VALUES('integrity-check', 1)")
        ).not.toThrow()
        expect(sqlite.query(`SELECT rowid FROM pokemon_fts WHERE pokemon_fts MATCH '"Quaj"'`).all())
            .toEqual([{ rowid: 658 }])
    })

    test('refuses a second default form for one species', async () => {
        // List and search join on the default form, so two would list the species twice.
        const sqlite = await createSqlite()

        expect(() =>
            sqlite.run(
                "INSERT INTO form (ndex, slug, name_en, is_default) VALUES (25, 'pikachu-dup', 'Dup', 1)"
            )
        ).toThrow(/UNIQUE/)
    })

    test('the build refuses a game the game table does not list', async () => {
        // /v1/games must resolve every `game` another endpoint returns.
        const sqlite = await createSqlite()
        const unlisted = () => check(sqlite).filter((problem) => problem.includes('game table'))

        expect(unlisted()).toEqual([])
        sqlite.run("UPDATE evolution SET game = 'stadium' WHERE id = (SELECT min(id) FROM evolution)")
        expect(unlisted()).toHaveLength(1)
    })

    test('refuses a row that points at a missing species', async () => {
        // D1 enforces foreign keys; the test database must fail the same way first.
        const sqlite = await createSqlite()

        expect(() =>
            sqlite.run("INSERT INTO encounter (ndex, form_id, game, location, method) VALUES (9999, 1, 'red', 'nowhere', 'walk')")
        ).toThrow(/FOREIGN KEY/)
    })
})

describe('query plans', () => {
    test('the any-form-depositable check finds forms by species', async () => {
        // With an index on `depositable` SQLite searched by that instead, visiting most
        // forms per species: ~500k rows on every `?depositable=` list, billed by D1.
        const sqlite = await createSqlite()
        const { sql, params } = createDb(asD1(sqlite)).select({ depositable: speciesDepositable }).from(pokemon).toSQL()

        const plan = (sqlite.query(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as never[])) as { detail: string }[])
            .map((row) => row.detail)
            .join('\n')

        expect(plan).toContain('form_ndex_idx (ndex=?)')
    })
})
