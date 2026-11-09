export type Value = string | number | boolean | null

/** The built dataset: written by `data:build`, read by check, sprite upload and publish. */
export const DATASET = new URL('../../data/dataset.sql', import.meta.url).pathname

/** Where a dataset stops being data: the build stamps the time it ran from here on. */
export const STAMP = "\nINSERT INTO meta (key, value) VALUES ('generated_at'"

/**
 * A dataset's version: a hash of everything before STAMP, so an unchanged rebuild keeps
 * every ETag valid. Takes the data alone or the whole file, giving the same answer.
 */
export const versionOf = (sql: string) => {
    const end = sql.indexOf(STAMP)
    return new Bun.CryptoHasher('sha256').update(end < 0 ? sql : sql.slice(0, end)).digest('hex').slice(0, 12)
}

/** D1 rejects a statement over 100 KB; leave room for the INSERT prefix and multi-byte text. */
const MAX_STATEMENT_BYTES = 90_000

export const literal = (value: Value): string => {
    if (value === null) return 'NULL'
    if (typeof value === 'boolean') return value ? '1' : '0'
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error(`Cannot write ${value} as SQL`)
        return String(value)
    }
    return `'${value.replaceAll("'", "''")}'`
}

/**
 * Multi-row INSERTs, split so that no statement exceeds D1's limit. Values are
 * written inline because a file load has no bound parameters - which is why
 * `literal` doubles every quote.
 */
export const insert = (table: string, columns: string[], rows: Value[][]): string[] => {
    const prefix = `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n`
    const statements: string[] = []
    let chunk: string[] = []
    let size = 0

    for (const row of rows) {
        if (row.length !== columns.length)
            throw new Error(`${table}: row has ${row.length} values for ${columns.length} columns`)

        const tuple = `(${row.map(literal).join(', ')})`
        const bytes = Buffer.byteLength(tuple) + 2

        if (chunk.length && size + bytes > MAX_STATEMENT_BYTES) {
            statements.push(`${prefix}${chunk.join(',\n')};`)
            chunk = []
            size = 0
        }

        chunk.push(tuple)
        size += bytes
    }

    if (chunk.length) statements.push(`${prefix}${chunk.join(',\n')};`)

    return statements
}
