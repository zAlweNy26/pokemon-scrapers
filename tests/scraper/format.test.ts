import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { parseCsv } from '@/scraper/csv'
import { STAMP, insert, literal, versionOf } from '@/scraper/sql'

describe('parseCsv', () => {
    test('keeps commas, quotes and newlines inside quoted fields', () => {
        // PokéAPI quotes genus and flavour text; splitting on commas shifts every later column.
        const rows = parseCsv('id,genus,flag\r\n1,"Mouse, small",1\n2,"Say ""hi""\nthere",0\n')

        expect(rows).toEqual([
            { id: '1', genus: 'Mouse, small', flag: '1' },
            { id: '2', genus: 'Say "hi"\nthere', flag: '0' }
        ])
    })

    test('reads empty fields as empty strings', () => {
        expect(parseCsv('a,b,c\n1,,3')).toEqual([{ a: '1', b: '', c: '3' }])
    })
})

describe('insert', () => {
    test('writes values that round-trip through SQLite, quotes included', () => {
        const sqlite = new Database(':memory:')
        sqlite.run('CREATE TABLE t (s TEXT, n REAL, b INTEGER, z TEXT)')

        for (const statement of insert('t', ['s', 'n', 'b', 'z'], [["Farfetch'd", 1.5, true, null]]))
            sqlite.run(statement)

        expect(sqlite.query('SELECT * FROM t').get()).toEqual({ s: "Farfetch'd", n: 1.5, b: 1, z: null })
    })

    test('splits rows so no statement exceeds D1 100 KB limit', () => {
        const rows = Array.from({ length: 5_000 }, (_, i) => [i, 'x'.repeat(100)])
        const statements = insert('t', ['id', 'text'], rows)

        expect(statements.length).toBeGreaterThan(1)
        for (const statement of statements) expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
        expect(statements.join('').match(/\(\d+, 'x+'\)/g)).toHaveLength(5_000)
    })

    test('refuses values SQL cannot hold and rows of the wrong width', () => {
        expect(() => literal(Number.NaN)).toThrow()
        expect(() => insert('t', ['a', 'b'], [[1]])).toThrow(/1 values for 2 columns/)
    })
})

describe('versionOf', () => {
    test('ignores when the build ran, so the hook can recompute what data:build wrote', () => {
        const body = "INSERT INTO pokemon (ndex) VALUES (1);"
        const stamped = (at: string) => `${body}${STAMP}, '${at}'), ('data_version', 'x');\n`

        expect(versionOf(stamped('2026-11-07'))).toBe(versionOf(body))
        expect(versionOf(stamped('2026-11-08'))).toBe(versionOf(body))
        expect(versionOf(`${body} `)).not.toBe(versionOf(body))
    })
})
