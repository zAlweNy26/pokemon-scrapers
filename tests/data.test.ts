import { describe, expect, test } from 'bun:test'
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

    test('refuses a row that points at a missing species', async () => {
        // D1 enforces foreign keys; the test database must fail the same way first.
        const sqlite = await createSqlite()

        expect(() =>
            sqlite.run("INSERT INTO encounter (ndex, form_id, game, location, method) VALUES (9999, 1, 'red', 'nowhere', 'walk')")
        ).toThrow(/FOREIGN KEY/)
    })
})
