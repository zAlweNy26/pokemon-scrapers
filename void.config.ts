import { defineConfig } from 'void/config'

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
            // The dataset build id. Set on every deploy that ships new data, since it
            // seeds every ETag and is reported by /v1/meta - leaving it unchanged
            // across a data change would serve stale bodies against valid ETags.
            DATA_VERSION: 'dev',
            // Public base URL of the R2 image bucket. Point at its custom domain when you create it.
            IMAGE_BASE_URL: 'https://images.homedex.danyalwe.me'
        }
    },
    cloudflare: {
        name: 'homedex',
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
        // `period` may only be 10 or 60. Limits are enforced per Cloudflare location,
        // not globally - this is abuse control, not a hard quota.
        ratelimits: [
            { name: 'RL_GLOBAL', namespace_id: '1001', simple: { limit: 120, period: 60 } },
            { name: 'RL_SEARCH', namespace_id: '1002', simple: { limit: 20, period: 60 } }
        ]
    }
})
