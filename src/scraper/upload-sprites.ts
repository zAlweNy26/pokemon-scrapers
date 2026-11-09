/**
 * `bun run data:sprites` - turns every `sprite_key` in data/dataset.sql into
 * `${key}/${size}.webp` for each of SPRITE_SIZES, from PokéAPI's HOME renders, and
 * every shiny and female key (`home/shiny/25`, `home/female/25`) the same way.
 *
 * With R2's S3 credentials in .env (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * S3_ENDPOINT, S3_BUCKET) it uploads to the bucket; without them it writes to
 * .cache/sprites-out/ so the result can be inspected first.
 *
 * Only what is missing is written, so CI can run it on every data load. A key is
 * there when its largest size is: sizes are written smallest first. MARKER holds
 * the SPRITES_COMMIT the images were made from; a different commit may have new
 * art under the same keys, so then everything is rewritten (~9,800 writes, well
 * inside R2's free operations). With nothing to write it stops before the
 * ~1.2 GB artwork checkout.
 */
import { mkdir } from 'node:fs/promises'
import { SPRITE_SIZES } from '@/api/sprites'
import { openDatabase } from './database'
import { ARTWORK_DIR, SPRITES_COMMIT, checkoutArtwork } from './sprites'
import { DATASET } from './sql'

const OUT = new URL('../../.cache/sprites-out/', import.meta.url).pathname
const MARKER = 'sprites-commit.txt'
const CONCURRENCY = 8

const db = await openDatabase(await Bun.file(DATASET).text())
const keys = db
    .query<{ key: string }, []>(
        `SELECT sprite_key AS key FROM form WHERE sprite_key IS NOT NULL
         UNION SELECT shiny_sprite_key FROM form WHERE shiny_sprite_key IS NOT NULL
         UNION SELECT female_sprite_key FROM form WHERE female_sprite_key IS NOT NULL
         UNION SELECT female_shiny_sprite_key FROM form WHERE female_shiny_sprite_key IS NOT NULL`
    )
    .all()
    .map((row) => row.key)

const remote = Boolean(process.env.S3_BUCKET)
const marker = remote ? Bun.s3.file(MARKER) : Bun.file(`${OUT}${MARKER}`)

/** Every object already written, as `${key}/${size}.webp`. */
const stored = async (): Promise<Set<string>> => {
    if (!remote) {
        await mkdir(OUT, { recursive: true })
        return new Set(await Array.fromAsync(new Bun.Glob('**/*.webp').scan({ cwd: OUT })))
    }
    const paths = new Set<string>()
    let startAfter: string | undefined
    do {
        const page = await Bun.s3.list({ startAfter })
        for (const { key } of page.contents ?? []) paths.add(key)
        startAfter = page.isTruncated ? page.contents?.at(-1)?.key : undefined
    } while (startAfter)
    return paths
}

const sameArt = (await marker.exists()) && (await marker.text()).trim() === SPRITES_COMMIT
const have = sameArt ? await stored() : new Set<string>()
const todo = keys.filter((key) => !have.has(`${key}/${SPRITE_SIZES.at(-1)}.webp`))

console.log(
    `${todo.length} of ${keys.length} sprites to write × ${SPRITE_SIZES.length} sizes → ${remote ? `R2 bucket ${process.env.S3_BUCKET}` : OUT}` +
        (sameArt ? '' : ` (all: images were not made from sprites commit ${SPRITES_COMMIT.slice(0, 7)})`)
)
if (!todo.length) process.exit(0)

await checkoutArtwork()
const queue = [...todo]
let done = 0
await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
        for (let key = queue.pop(); key !== undefined; key = queue.pop()) {
            for (const size of SPRITE_SIZES) {
                const webp = await Bun.file(`${ARTWORK_DIR}${key}.png`)
                    .image()
                    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 85 })
                    .bytes()
                const path = `${key}/${size}.webp`
                if (remote) await Bun.s3.file(path).write(webp, { type: 'image/webp' })
                else await Bun.write(`${OUT}${path}`, webp)
            }
            if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`)
        }
    })
)
// Last, so an interrupted run is finished by the next one instead of being taken as complete.
await Bun.write(marker, SPRITES_COMMIT)
console.log(`✓ ${done} sprites`)
