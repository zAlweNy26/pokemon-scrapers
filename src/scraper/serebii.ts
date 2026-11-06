import { fetchPage } from './http'

/** One Pokémon or form as Serebii lists it: dex number, the image-code suffix and its label. */
export interface SerebiiEntry {
    ndex: number
    /** Serebii's image suffix ("-g" for Galarian Meowth); empty for the base form. */
    code: string
    label: string
}

const BASE = 'https://www.serebii.net'

/** The HTML entities Serebii uses in labels; anything else is left for the match report to flag. */
const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", eacute: 'é', lt: '<', gt: '>', nbsp: ' ' }

export const decodeEntities = (value: string) =>
    value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
        if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match
        const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
        return Number.isFinite(code) ? String.fromCodePoint(code) : match
    })

/**
 * The HOME box list: every Pokémon and form HOME can store. Only the standard
 * boxes are read - the shiny boxes repeat the same entries.
 */
export const parseDepositable = (html: string): SerebiiEntry[] => {
    const start = html.indexOf('id="normal"')
    const end = html.indexOf('id="shiny"')
    if (start < 0) throw new Error('Serebii depositable page: no standard boxes found - layout changed?')

    const boxes = html.slice(start, end > start ? end : undefined)
    const entries: SerebiiEntry[] = []

    for (const [, ndex, code, label] of boxes.matchAll(
        /<img src="\/pokemonhome\/pokemon\/80\/(\d+)(-[a-z0-9-]+)?\.png"[^>]*\balt="([^"]*)"/g
    ))
        entries.push({ ndex: Number(ndex), code: code ?? '', label: decodeEntities(label!) })

    if (!entries.length) throw new Error('Serebii depositable page: no entries parsed - layout changed?')

    return entries
}

export const fetchDepositable = async () => {
    const { body, fetchedAt } = await fetchPage(`${BASE}/pokemonhome/depositablepokemon.shtml`, { charset: 'windows-1252' })
    return { entries: parseDepositable(body), fetchedAt }
}
