import { $ } from 'bun'
import { readdir } from 'node:fs/promises'

/**
 * PokéAPI's sprite repository, read from a git checkout. Pinned so a build is
 * reproducible; bump it deliberately to take new artwork.
 */
export const SPRITES_COMMIT = '1b3b7c0a538dd2226ae08d0d2f8955125075bbd4'

const REPO = 'https://github.com/PokeAPI/sprites.git'
const DIR = new URL('../../.cache/sprites/', import.meta.url).pathname
export const ARTWORK_DIR = `${DIR}sprites/pokemon/other/`
/** Pokémon HOME's renders, the art users see in HOME's boxes: regular, shiny, and the female looks of both. */
const FOLDERS = ['home', 'home/shiny', 'home/female', 'home/shiny/female']
// No-cone patterns: each folder's own PNGs only.
const ARTWORK_PATTERNS = FOLDERS.map((folder) => `/sprites/pokemon/other/${folder}/*.png`)

/** The repository is ~27 GB; a blobless sparse clone downloads only the HOME renders (~3,260 PNGs). */
export const checkoutArtwork = async (): Promise<void> => {
    if (!(await Bun.file(`${DIR}.git/HEAD`).exists()))
        await $`git clone --quiet --depth 1 --filter=blob:none --no-checkout ${REPO} ${DIR}`

    const head = (await $`git -C ${DIR} rev-parse HEAD`.nothrow().text()).trim()
    // Re-set every run, so a checkout made for other folders switches over.
    await $`git -C ${DIR} sparse-checkout set --no-cone ${ARTWORK_PATTERNS}`
    if (head === SPRITES_COMMIT && (await Bun.file(`${ARTWORK_DIR}home/1.png`).exists())) return

    await $`git -C ${DIR} fetch --quiet --depth 1 origin ${SPRITES_COMMIT}`
    await $`git -C ${DIR} checkout --quiet ${SPRITES_COMMIT}`
}

const stems = async (dir: string) =>
    (await readdir(dir)).filter((file) => file.endsWith('.png')).map((file) => file.slice(0, -4))

/**
 * The renders as paths relative to ARTWORK_DIR, without `.png`: `home/25`,
 * `home/10001` (a variety), `home/201-b` (a cosmetic form), `home/shiny/25`,
 * `home/female/25`, `home/shiny/female/25`.
 */
export const artworkKeys = async (): Promise<Set<string>> =>
    new Set(
        (await Promise.all(FOLDERS.map(async (folder) => (await stems(`${ARTWORK_DIR}${folder}/`)).map((stem) => `${folder}/${stem}`)))).flat()
    )
