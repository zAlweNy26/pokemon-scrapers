/**
 * The pre-push hook (.githooks/pre-push): before `main` moves, puts the data the pushed
 * commit names into production, so CI only has to check it is there and deploy. The
 * dataset never leaves this machine for anywhere but D1: the repository is public.
 *
 * When production already holds the pushed data/version.json it costs one query.
 * Otherwise it uploads the sprites R2 lacks (new rows must not point at missing
 * images), then `data:load:remote` applies migrations and loads data/dataset.sql. Any
 * failure stops the push. `git push --no-verify` skips it, and CI then refuses to
 * deploy until the data is loaded.
 */
import { $ } from 'bun'
import lock from '../../void.lock.json'
import { DATASET, versionOf } from './sql'

const [database] = lock.resolved.d1_databases

const fail = (message: string): never => {
    console.error(`\n✗ ${message}\n  The push was stopped; \`git push --no-verify\` pushes without loading.`)
    process.exit(1)
}

// Git passes one line per ref: `<local ref> <local sha> <remote ref> <remote sha>`; deleting pushes zeros.
const pushed = (await Bun.stdin.text())
    .split('\n')
    .map((line) => line.split(' '))
    .find(([, sha, ref]) => ref === 'refs/heads/main' && sha && !/^0+$/.test(sha))?.[1]
if (!pushed || !database) process.exit(0)

$.env({ ...process.env, CLOUDFLARE_ACCOUNT_ID: lock.resolved.account_id })

const want: string = JSON.parse(await $`git show ${pushed}:data/version.json`.text()).version
const rows = await $`bunx wrangler d1 execute ${database.database_id} --remote --json --command ${"SELECT value FROM meta WHERE key = 'data_version'"}`
    .nothrow()
    .quiet()
// With --json, wrangler reports its errors on stdout, not stderr.
if (rows.exitCode !== 0) fail(`could not ask production for its dataset:\n${`${rows.stderr}${rows.stdout}`.trim()}`)
const have: string = JSON.parse(rows.stdout.toString())[0]?.results[0]?.value ?? 'none'
if (have === want) process.exit(0)

const file = Bun.file(DATASET)
if (!(await file.exists())) fail(`production holds dataset ${have}, the push names ${want}, and data/dataset.sql is missing: run \`bun run data:build\`.`)
const built = versionOf(await file.text())
if (built !== want) fail(`the push names dataset ${want}, but data/dataset.sql is ${built}: commit the data/version.json that build wrote.`)
if (!process.env.S3_BUCKET) fail('the new data needs its sprites in R2, and .env has no S3_* credentials.')

console.log(`Production holds dataset ${have}; loading ${want} before the push.`)
try {
    await $`bun run data:sprites`
    // A restore point to hand to `wrangler d1 time-travel restore` if the migration or load goes wrong.
    await $`bunx wrangler d1 time-travel info ${database.database_name}`.nothrow()
    await $`bun run data:load:remote`
} catch {
    fail('loading production failed (output above).')
}
console.log(`✓ Production holds dataset ${want}. CI deploys once the load is a minute old.\n`)
