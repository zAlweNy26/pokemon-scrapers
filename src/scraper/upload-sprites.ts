/**
 * `bun run data:sprites` - turns every `sprite_key` in data/dataset.sql into
 * `${key}/${size}.webp` for each of SPRITE_SIZES, from PokéAPI's official artwork.
 *
 * With R2's S3 credentials in .env (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * S3_ENDPOINT, S3_BUCKET) it uploads to the bucket; without them it writes to
 * .cache/sprites-out/ so the result can be inspected first. Every run rewrites
 * every object (~4,600 writes, well inside R2's free monthly operations).
 */
import { SPRITE_SIZES } from '@/api/sprites'
import { openDatabase } from './database'
import { ARTWORK_DIR, checkoutArtwork } from './sprites'

const DATASET = new URL('../../data/dataset.sql', import.meta.url).pathname
const OUT = new URL('../../.cache/sprites-out/', import.meta.url).pathname
const CONCURRENCY = 8

await checkoutArtwork()
const db = await openDatabase(await Bun.file(DATASET).text())
const keys = db
    .query<{ key: string }, []>('SELECT DISTINCT sprite_key AS key FROM form WHERE sprite_key IS NOT NULL')
    .all()
    .map((row) => row.key)

const remote = Boolean(process.env.S3_BUCKET)
console.log(`${keys.length} sprites × ${SPRITE_SIZES.length} sizes → ${remote ? `R2 bucket ${process.env.S3_BUCKET}` : OUT}`)

const queue = [...keys]
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
            if (++done % 100 === 0) console.log(`  ${done}/${keys.length}`)
        }
    })
)
console.log(`✓ ${done} sprites`)
