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
// No-cone pattern: the folder's own PNGs, not its shiny/ and versions/ subfolders.
const ARTWORK_PATTERN = '/sprites/pokemon/other/official-artwork/*.png'

/** The repository is ~27 GB; a blobless sparse clone downloads only the official artwork (~1,540 PNGs). */
export const checkoutArtwork = async (): Promise<void> => {
    if (!(await Bun.file(`${DIR}.git/HEAD`).exists())) {
        await $`git clone --quiet --depth 1 --filter=blob:none --no-checkout ${REPO} ${DIR}`
        await $`git -C ${DIR} sparse-checkout set --no-cone ${ARTWORK_PATTERN}`
    }

    const head = (await $`git -C ${DIR} rev-parse HEAD`.nothrow().text()).trim()
    if (head === SPRITES_COMMIT && (await Bun.file(`${ARTWORK_DIR}1.png`).exists())) return

    await $`git -C ${DIR} fetch --quiet --depth 1 origin ${SPRITES_COMMIT}`
    await $`git -C ${DIR} checkout --quiet ${SPRITES_COMMIT}`
}

/** File stems of the artwork: `25`, `10001` (a variety), `201-b` (a cosmetic form). */
export const artworkKeys = async (): Promise<Set<string>> =>
    new Set((await readdir(ARTWORK_DIR)).filter((file) => file.endsWith('.png')).map((file) => file.slice(0, -4)))
