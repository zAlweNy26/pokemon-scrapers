/**
 * RFC 4180 CSV to row objects keyed by the header. PokéAPI quotes any field that
 * contains a comma, quote or newline (genus and flavour text do), so a plain
 * split on commas would shift columns.
 */
export const parseCsv = (text: string): Record<string, string>[] => {
    const records: string[][] = []
    let record: string[] = []
    let field = ''
    let quoted = false

    for (let i = 0; i < text.length; i++) {
        const char = text[i]

        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"'
                i++
            } else if (char === '"') quoted = false
            else field += char
        } else if (char === '"') quoted = true
        else if (char === ',') {
            record.push(field)
            field = ''
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i++
            record.push(field)
            records.push(record)
            record = []
            field = ''
        } else field += char
    }

    if (field !== '' || record.length) {
        record.push(field)
        records.push(record)
    }

    const [header, ...rows] = records
    if (!header) return []

    return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ''])))
}
