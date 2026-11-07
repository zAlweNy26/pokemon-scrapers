import { $ } from 'bun'
import { readdir } from 'node:fs/promises'

/**
 * PokéAPI's sprite repository, read from a git checkout. Pinned so a build is
 * reproducible; bump it deliberately to take new artwork.
 */
export const SPRITES_COMMIT = '1b3b7c0a538dd2226ae08d0d2f8955125075bbd4'

const REPO = 'https://github.com/PokeAPI/sprites.git'
const DIR = new URL('../../.cache/sprites/', import.meta.url).pathname
export const ARTWORK_DIR = `${DIR}sprites/pokemon/other/official-artwork/`
// No-cone patterns: the folder's own PNGs and its shiny/ ones, not versions/ or female/.
const ARTWORK_PATTERNS = ['/sprites/pokemon/other/official-artwork/*.png', '/sprites/pokemon/other/official-artwork/shiny/*.png']

/** The repository is ~27 GB; a blobless sparse clone downloads only the official artwork (~3,070 PNGs). */
export const checkoutArtwork = async (): Promise<void> => {
    if (!(await Bun.file(`${DIR}.git/HEAD`).exists()))
        await $`git clone --quiet --depth 1 --filter=blob:none --no-checkout ${REPO} ${DIR}`

    const head = (await $`git -C ${DIR} rev-parse HEAD`.nothrow().text()).trim()
    // Re-set every run, so a checkout made before the shiny folder was added picks it up.
    await $`git -C ${DIR} sparse-checkout set --no-cone ${ARTWORK_PATTERNS}`
    if (head === SPRITES_COMMIT && (await Bun.file(`${ARTWORK_DIR}1.png`).exists())) return

    await $`git -C ${DIR} fetch --quiet --depth 1 origin ${SPRITES_COMMIT}`
    await $`git -C ${DIR} checkout --quiet ${SPRITES_COMMIT}`
}

const stems = async (dir: string) =>
    (await readdir(dir)).filter((file) => file.endsWith('.png')).map((file) => file.slice(0, -4))

/**
 * File stems of the artwork, relative to ARTWORK_DIR: `25`, `10001` (a variety),
 * `201-b` (a cosmetic form), and `shiny/25` for each shiny one.
 */
export const artworkKeys = async (): Promise<Set<string>> =>
    new Set([...(await stems(ARTWORK_DIR)), ...(await stems(`${ARTWORK_DIR}shiny/`)).map((stem) => `shiny/${stem}`)])
