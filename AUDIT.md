# homedex audit — 2026-11-04

> **Status (2026-11-04):** all findings are done except 15, which was skipped on purpose:
> Workers Cache answers most revalidations before the Worker runs, so checking early
> would add a second copy of the matching rule for little gain. Also added: a test
> that a 304 has no body. (Commit `7ecdb70` says "1-6"; in this file's numbering
> it closed 1, 2, 3, 4, 8 and 10.) Some line numbers below are out of date.

**What this repo does:** homedex is a free, read-only Pokémon API on Cloudflare Workers:
Elysia for routing, Drizzle over D1 for storage, Workers Cache in front, and the
Workers rate-limit binding for abuse control. The scraper that fills the database is
not written yet; only a small fixture exists.
**Load assumed:** a public API that anyone on the internet, including abusive clients,
can hit — and it must stay inside the Workers Paid plan with no extra billing.

All 57 tests pass and `tsc` is clean. Every bug below was confirmed by sending real
requests through `handleRequest` against the in-memory test database.

## Must fix

### 1. `/health` lets anyone run up the D1 bill — `src/api/modules/health.ts:17`
- **What this is:** a monitoring endpoint that counts every row in `pokemon` on each call.
- **Problem:** it has no rate limit and no cache, and D1 bills `count(*)` as reading the
  whole table (~1,025 rows). A script calling it ~10 times a second uses up the plan's
  25 billion included reads in a month; after that, reads are billed.
- **Fix:** read one row: `.select({ ndex: pokemon.ndex }).from(pokemon).limit(1)` and
  `ok = !!row`. Drop the `pokemon` count field (`/v1/meta` has it) and update
  `tests/routes.test.ts:43`.
- **If we skip it:** one unattended loop breaks the "no spend beyond the plan" rule.

### 2. `If-None-Match` with a weak or listed ETag gets a full 200 — `src/api/plugins/cache.ts:74`
- **What this is:** the check that answers `304 Not Modified` when the client already has the latest version.
- **Problem:** it is an exact string match. `W/"…"`, `"zzz", "…"` and `*` all returned 200.
  RFC 9110 requires weak comparison here, and Cloudflare weakens strong ETags when it
  compresses, so browsers send the `W/` form back.
- **Fix:** split on commas, strip `W/`, and also accept `*`. Add one test with a `W/` tag.
- **If we skip it:** the README's "304 for free" never happens for real browsers on a cache miss.

### 3. Searching `%%` or `__` returns every species — `src/api/modules/search/service.ts:75`
- **What this is:** the `LIKE` prefix fallback for two-character queries.
- **Problem:** `%` and `_` are stripped, so `%%` becomes the pattern `%`.
  `GET /v1/search?q=%25%25` returned all 8 fixture species — the same bug the comment at
  `search/model.ts:21` says was fixed for blank input.
- **Fix:** escape instead of strip: `query.replace(/[\\%_]/g, '\\$&') + '%'` with `LIKE … ESCAPE '\'`.
- **If we skip it:** junk queries return arbitrary results.

### 4. Validation errors name the wrong field — `src/api/plugins/errors.ts:22-55`
- **What this is:** the code that turns bad query parameters into a 422 body.
- **Problem:** it parses one field name out of Elysia's message and puts it on every issue.
  `?limit=0&offset=-1` returns two errors, both labelled `"property":"limit"`.
  Each issue in `error.all` already carries its own `path`.
- **Fix:** use `issue.path` per issue; delete `propertyOf` (~17 lines).
- **If we skip it:** clients are told to fix the wrong parameter.

## Should fix

### 5. Reloading data can corrupt the search index — `data/seed.sql`
- **What this is:** `pokemon_fts` is an external-content FTS5 index: it stores words, while the names live in `pokemon`.
- **Problem:** `DELETE FROM pokemon_fts` reads the *current* `pokemon` rows to know which
  words to remove. After changing one name and re-running the seed, SQLite's
  integrity check fails with "database disk image is malformed". The scraper will copy this pattern.
- **Fix:** delete the `DELETE` and the `INSERT … SELECT` and end the load with
  `INSERT INTO pokemon_fts(pokemon_fts) VALUES('rebuild');` (tested: integrity check passes).
- **If we skip it:** one out-of-order load silently breaks search in production.

### 6. Nothing stops a species from having two default forms — `src/db/schema.ts:96-99`
- **Problem:** two `is_default = 1` rows make the list/search joins return the species twice and inflate `total`.
- **Fix:** partial unique index `uniqueIndex('form_one_default').on(table.ndex).where(sql\`${table.isDefault} = 1\`)`, then regenerate migrations.
- **If we skip it:** a scraper bug ships as duplicate results instead of failing at load.

### 7. `depositable` means two different things — `pokemon/service.ts:97`, `search/service.ts:64`
- **Problem:** the `?depositable=` filter and the detail endpoint mean "any form can enter
  HOME"; list items and search results mean "the default form can". A species whose
  default form can't but another form can is returned by `?depositable=true` with `depositable: false`.
- **Fix:** select the existing `anyDepositable` subquery as the column in both places.
- **If we skip it:** results contradict the filter that produced them.

### 8. `/v1/meta` does three full table counts on every cache miss — `src/api/modules/meta.ts:9-21`
- **Problem:** unknown query parameters aren't rejected, so `/v1/meta?r=1`, `?r=2`, …
  each miss the cache and count all of `pokemon`, `form` and `encounter`. With a real
  encounter table of tens of thousands of rows, one IP at the 120/min limit reads billions of rows a day.
- **Fix:** have the loader write the counts into the `meta` table, so the route reads only `meta`.
- **If we skip it:** this is the cheapest way to push D1 usage past the plan.

### 9. Tests don't enforce foreign keys; D1 does — `tests/support/d1.ts:55`
- **Problem:** `bun:sqlite` has foreign keys off by default and D1 has them on, so a
  fixture or migration that breaks a reference passes `bun test` and fails in D1.
- **Fix:** `sqlite.run('PRAGMA foreign_keys = ON')` after opening (the current seed still loads twice with it on).

### 10. `?gen=10` is rejected — `src/api/modules/pokemon/model.ts:43`
- **Problem:** `.max(9)` makes the next generation a 422 as soon as the data has it.
- **Fix:** drop `.max(9)`; an unknown generation just returns an empty list.

### 11. `elysia-rate-limit` is a dependency we work around — `src/api/plugins/rate-limit.ts:17-64`
- **Problem:** ~30 lines fake its counter store with no-op functions so the Cloudflare binding can decide.
- **Fix:** a plain `onBeforeHandle` hook that calls the binding and throws `rateLimited(60)`.

### 12. `elysiajs-cdn-cache` only builds two constant strings — `src/api/plugins/cache.ts:2-39`
- **Problem:** a 0.0.x package, deep-imported from its `dist/`, rebuilt per request, for two fixed headers.
- **Fix:** two string constants; remove the package.

### 13. Dead code in error handling — `errors.ts:100-108`, `problem.ts:32-36`, `app.ts:43`
- **Problem:** the API is GET-only, so the `PARSE` branch can't run (POST/PUT/PATCH/DELETE
  with broken JSON all return 404). `badRequest`, `unprocessable` and `export type App` have no callers.
- **Fix:** delete them (~15 lines).

### 14. Error bodies written twice — `errors.ts:72-119` vs `problem.ts`
- **Problem:** the plugin types out 404/422/500 bodies by hand although `Problem` already defines the shape.
- **Fix:** build a `Problem` in each branch and render it through the one existing path.

## Nice to have

15. **Answer 304 before querying** (`cache.ts:66-75`): the ETag depends only on version,
    path and query, so the `If-None-Match` check can run in `onBeforeHandle` and skip D1.
16. **Comments that say false things:** `pokemon/service.ts:55` says `COLLATE NOCASE` uses
    the index and `search/service.ts:22` says "indexed prefix scan"; `EXPLAIN QUERY PLAN`
    shows `SCAN pokemon` for both (harmless at ~1,000 rows). `openapi.ts:8` and `errors.ts:12`
    still say "TypeBox"; the schemas are zod.
17. **`@types/node` is redundant** (`package.json`): `bun-types` already depends on it.

**Verdict:** careful, well-tested code. Fix 1 and 8 first — the only ways a stranger can
break the no-extra-cost rule — then 2–4, which are quick and visible to clients.

**Lean:** -85 lines, -3 dependencies possible.

**Not checked:** nothing was run on real workerd or D1. D1 billing `count(*)` as a full
read and Cloudflare weakening ETags on compression come from Cloudflare's docs, not tests.
The real encounter-table size is a guess until the scraper exists. Not read: `.vscode`,
`LICENSE`, `NOTICE.md`, `DATA-LICENSE.md`.
