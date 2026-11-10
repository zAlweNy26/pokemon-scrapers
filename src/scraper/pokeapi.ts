import { $ } from 'bun'
import { parseCsv } from './csv'

/**
 * PokéAPI's CSV data, read from a git checkout - zero requests to PokéAPI's servers.
 * Pinned so a build is reproducible; bump it deliberately to take new data.
 */
export const POKEAPI_COMMIT = 'e5b79b2e15d7c50735a945936afd4cd1cfd94eae'

const REPO = 'https://github.com/PokeAPI/pokeapi.git'
const DIR = new URL('../../.cache/pokeapi/', import.meta.url).pathname
const CSV_DIR = `${DIR}data/v2/csv/`

/** A shallow, sparse clone holding only data/v2/csv, checked out at POKEAPI_COMMIT. */
export const checkoutPokeApi = async (): Promise<void> => {
    if (!(await Bun.file(`${DIR}.git/HEAD`).exists())) {
        await $`git clone --quiet --depth 1 --filter=blob:none --sparse --no-checkout ${REPO} ${DIR}`
        await $`git -C ${DIR} sparse-checkout set data/v2/csv`
    }

    const head = (await $`git -C ${DIR} rev-parse HEAD`.nothrow().text()).trim()
    if (head === POKEAPI_COMMIT) return

    await $`git -C ${DIR} fetch --quiet --depth 1 origin ${POKEAPI_COMMIT}`
    await $`git -C ${DIR} checkout --quiet ${POKEAPI_COMMIT}`
}

export const readTable = async (name: string) => parseCsv(await Bun.file(`${CSV_DIR}${name}.csv`).text())

/** PokéAPI `languages.id` for each of our language keys, best source first. */
export const LANGUAGE_IDS = {
    en: ['9'],
    ja: ['11', '1'],
    de: ['6'],
    fr: ['5'],
    it: ['8'],
    es: ['7'],
    ko: ['3'],
    zh_hans: ['12'],
    zh_hant: ['4']
} as const

export type Language = keyof typeof LANGUAGE_IDS

export const LANGUAGES = Object.keys(LANGUAGE_IDS) as Language[]
