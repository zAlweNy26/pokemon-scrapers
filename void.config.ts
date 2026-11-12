import { defineConfig } from 'void/config'
import dataset from './data/version.json'
import { RATE_LIMITS } from './src/api/platform'

export default defineConfig({
    // Void's conventions live under src/: routes in src/routes, the Drizzle schema
    // in src/db/schema.ts and migrations in src/db/migrations.
    sourceDir: 'src',
    worker: {
        compatibility_date: '2026-08-24',
        // AsyncLocalStorage: Elysia's Cloudflare adapter does not forward `env`
        // into handler context, so bindings are carried per-request via ALS.
        compatibility_flags: ['nodejs_als'],
        vars: {
            // A hash of data/dataset.sql, written by `bun run data:build`. It seeds every
            // ETag, so it changes exactly when the data does. Load the data before
            // deploying, or the new version would vouch for the old rows.
            DATA_VERSION: dataset.version,
            // Public base URL of the R2 image bucket: its custom domain.
            IMAGE_BASE_URL: 'https://images.homedex.danyn.dev'
        }
    },
    cloudflare: {
        name: 'homedex',
        // Set here, it overrides the route the first deploy recorded in void.lock.json.
        // The zone must be in this Cloudflare account.
        routes: [{ pattern: 'homedex.danyn.dev', custom_domain: true }],
        // Workers Cache: checked BEFORE the Worker runs, tiered, and request-collapsing.
        cache: {
            enabled: true,
            // The cache key includes the Worker version, so a deploy invalidates the
            // whole edge. That is what lets responses be held for a week - a dataset
            // change always ships as a deploy.
            cross_version_cache: false
        },
        // Keeps the per-request line from src/api/log.ts. Sampling stays at 1: a
        // sampled access log cannot answer "what happened to that request?".
        observability: { enabled: true, head_sampling_rate: 1 },
        d1_databases: [
            {
                binding: 'DB',
                database_name: 'homedex',
                // Void's placeholder: the first `void deploy` creates the database and records its id in void.lock.json.
                database_id: 'local',
                migrations_dir: 'src/db/migrations'
            }
        ],
        // Limits are enforced per Cloudflare location, not globally - this is abuse
        // control, not a hard quota.
        ratelimits: [
            { name: 'RL_GLOBAL', namespace_id: '1001', simple: { limit: RATE_LIMITS.global, period: RATE_LIMITS.windowSeconds } },
            { name: 'RL_SEARCH', namespace_id: '1002', simple: { limit: RATE_LIMITS.search, period: RATE_LIMITS.windowSeconds } }
        ]
    }
})
