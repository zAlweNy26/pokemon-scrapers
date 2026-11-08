# homedex

A free, read-only Pokémon API focused on what general-purpose APIs cover poorly:
**Pokémon HOME depositability**, names in **all nine game languages**, real
**form** handling, **per-game encounter locations**, and **name etymology**.

Runs entirely on Cloudflare Workers: Elysia on the edge, Drizzle over D1 for
storage with an FTS5 index for cross-language search, and Workers Cache in front.
[Void](https://void.cloud) builds, provisions and deploys it.

## Quick start

Needs Node.js 24.22+ (Void's requirement) alongside Bun. Nothing here touches a
Cloudflare account — the dev server runs D1 locally.

```bash
bun install
bun run db:seed      # reset local D1, apply migrations, load the fixture
bun run dev          # http://localhost:5173
bun test             # no server and no workerd needed
bun run typecheck
```

```bash
curl 'http://localhost:5173/v1/pokemon/pikachu'
curl 'http://localhost:5173/v1/search?q=Quaj'      # → Greninja, matched via German "Quajutsu"
open  http://localhost:5173/docs                   # Scalar UI
```

`bun run build && bun run preview` runs the production bundle in workerd.

## Deploy

```bash
bun run deploy       # void deploy --platform cloudflare (skips the "link existing Worker" prompt)
```

The first run signs in to Cloudflare in the browser, creates the D1 database and
records its id in `void.lock.json` (commit it), applies pending migrations, and
uploads the Worker. Data is loaded from this machine, **before** deploying — see below.

After that first deploy, `.github/workflows/deploy.yml` tests and deploys every push
to `main`. Set the repository secret `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit,
D1: Edit). Before deploying, it checks that the production database holds the
dataset `data/version.json` names (a load records its version and time in `meta`),
and waits out the rest of the minute after the load. The dataset itself is never
committed — the repository is public — so a pre-push hook loads it from here:
`bun install` turns it on (`core.hooksPath` = `.githooks`). When a push to `main`
names another dataset than production holds, the hook uploads the sprites R2 lacks,
applies migrations and loads `data/dataset.sql` before git pushes; any failure stops
the push. Pushed with `--no-verify`, new data fails the deploy: run
`bun run data:load:remote`, then re-run it (Actions → Deploy → Re-run).

## Data

```bash
bun run data:build         # → data/dataset.sql + data/version.json, validated and diffed
bun run data:check         # quality checks + every species through the API; writes .cache/homedex.sqlite
bun run data:sprites       # artwork → R2 as {key}/{96,256,512}.webp; without S3_* in .env, to .cache/sprites-out/
bun run data:load:local    # reset local D1 and load it; run `bun test` and try the API
git commit -m 'chore: ship dataset' data/version.json
git push                   # the hook: sprites, migrations, the load into production; then CI deploys
```

The hook (`src/scraper/publish.ts`) loads through `data:load:remote`, which also works alone: pending
migrations (the new rows may need new columns), then the file into the real database
(wrangler: `void db execute` passes the 9.6 MB file as one argument and hits E2BIG;
the id is `void.lock.json`'s D1). It prints a D1 Time Travel bookmark first, for
`wrangler d1 time-travel restore` if a migration or load goes wrong.

Reads are served by D1 read replicas near the caller. CI waits a minute after the
load before deploying: the deploy announces the new `DATA_VERSION`, and a replica
still holding old rows at that moment would have them cached at the edge, under
the new version, for a week.

The build reads PokéAPI's CSV files from a pinned git checkout in `.cache/` (no
requests to PokéAPI), 19 Serebii pages — the HOME box list plus each
HOME-connected game's availability lists — reused for 24 hours, and Bulbapedia's
species pages (~21 API requests of 50 pages each) plus two list pages (unobtainable
shinies, Legends: Z-A alphas), reused for 30 days. Requests go
one at a time, at least 5 s apart. It
stops with a non-zero exit and writes nothing if a Serebii entry cannot be matched
to a form — add an override in `src/scraper/match.ts` — likewise a Bulbapedia shiny
row (`src/scraper/shiny.ts`), or if the dataset fails a
check (search index, one default form per species, stored counts). `DATA_VERSION`
is a hash of the dataset, so ETags change exactly when the data does.

Sprites are Pokémon HOME's renders, from a sparse checkout of
[PokeAPI/sprites](https://github.com/PokeAPI/sprites) pinned in
`src/scraper/sprites.ts`. The build stores each form's render as `sprite_key`
(`home/25`; a form without one of its own uses its variety's), the same picture's
shiny as `shiny_sprite_key` (`home/shiny/25`), and, where HOME draws females
differently, `female_sprite_key` and its shiny; the API publishes the male and female pair per form as
`variants`, empty when the sexes look alike. `data:sprites` resizes
each one to WebP with `Bun.Image` and uploads it with `Bun.s3` to the bucket behind
`IMAGE_BASE_URL`. It needs an R2 API token's S3 credentials in `.env`:
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_ENDPOINT=https://<account id>.r2.cloudflarestorage.com` and `S3_BUCKET`.
It writes only the sprites the bucket lacks, and all of them when `SPRITES_COMMIT`
differs from the one the bucket's `sprites-commit.txt` records; the pre-push hook runs it
before every data load.

`data:check` exits non-zero on malformed data: broken references, values out of
range, mojibake or leftover wiki markup in any of ~42,000 texts, a handful of
known facts, or any API response its schema rejects. Gaps the sources leave
(names PokéAPI lacks in some languages) are listed, not failed. Open
`.cache/homedex.sqlite` in any SQLite viewer to browse the result.

## Endpoints

| Endpoint | Notes |
|---|---|
| `GET /v1/pokemon` | `?gen &type &region &depositable &homeGame &ability &eggGroup &obtainableIn &exclusiveTo &habitat &sort &limit &offset`. `homeGame` takes a version group (`scarlet-violet`), `obtainableIn` and `exclusiveTo` a version (`scarlet`). `sort` is `ndex` (default), `name`, `bst`, `hp`, `atk`, `def`, `spAtk`, `spDef`, `spd`, `height` or `weight` of the default form, `-` prefixed for descending (`-bst`); unknown values last, ties by dex number |
| `GET /v1/pokemon/:idOrName` | Accepts `25`, `pikachu` or `Pikachu`; returns every form |
| `GET /v1/evolution-chains/:ndex` | The chain of the species with that national dex number: references to its species (`ndex`, `slug`, `uri`) in `members`, and `steps` exactly as `/v1/pokemon/:idOrName` has them in `evolutionChain` |
| `GET /v1/forms` | `?gen &type &depositable &homeGame &isDefault &category &limit &offset`. Every form, where HOME depositability lives: `depositable` is the form's own, so it tells Pikachu apart from Partner Pikachu |
| `GET /v1/forms/:slug` | One form as `/v1/pokemon/:idOrName` lists it in `forms`, plus its `species` and its own `encounters` |
| `GET /v1/search?q=` | Cross-language name search; reports which language matched |
| `GET /v1/generations`, `GET /v1/types` | Reference data with counts; types carry their names in every language |
| `GET /v1/abilities`, `GET /v1/moves` | Every main-series ability and move, with its name in every language |
| `GET /v1/moves/:slug` | One move with its names, `description` (in-game text from the latest game that has a real one) and `effect` (the mechanics); both in English only for now |
| `GET /v1/types/:slug`, `GET /v1/abilities/:slug` | `?limit &offset`. One type or ability with its names, and a page of references (`ndex`, `slug`, `uri`) to what `/v1/pokemon?type=` or `?ability=` returns for it. An ability also has `description`, its in-game text from the latest game that has one, and `effect`, the mechanics; both in English only for now |
| `GET /v1/egg-groups`, `GET /v1/home-games`, `GET /v1/pokedexes` | The values `eggGroup`, `homeGame` and `/v1/pokedexes/:slug` accept, each with its species count |
| `GET /v1/pokedexes/:slug` | `?limit &offset`. Species in a regional Pokédex, in its order: references (`ndex`, `slug`, `uri`) plus their regional `number` |
| `GET /v1/meta` | Dataset version, counts and provenance |
| `GET /health` | Reads from D1; never cached |
| `GET /docs`, `GET /openapi.json` | Scalar UI and the OpenAPI 3.0.3 document |

Every `GET` also answers `HEAD`. Single resources are returned bare; collections are wrapped in `{ data, meta }`.
Every failure is [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json`
— note that the generated spec documents those bodies as `application/json`, because
`@elysiajs/openapi` hard-codes that media type and exposes no document transform.
`/v1/search` reports `meta.count` (rows returned) rather than a `total`: it is not
paginated, so there is no unpaginated total to give.

**Rate limits.** 120 requests/minute per IP overall, 20/minute on `/v1/search`.
Enforced per Cloudflare location, so they are abuse control rather than a quota.

**Caching.** Responses carry a strong `ETag` derived from the dataset version.
Send `If-None-Match` and you get a `304`. A dataset change always ships as a
deploy (`DATA_VERSION` comes from `data/version.json`), and Workers Cache keys on
the Worker version, so a release invalidates the edge on its own.

## Database

Drizzle owns the schema. `src/db/schema.ts` is the contract between the scraper
and the API; Void generates migrations from it and applies them.

```bash
bun run db:generate        # schema.ts → src/db/migrations/NNNN_*.sql
bun run db:migrate         # apply to local D1
bun run db:migrate:remote  # apply to the real database (deploy and data:load:remote also do this)
bun run db:seed            # reset local D1 and load data/seed.sql
```

Two things Drizzle deliberately does not cover:

- **`pokemon_fts`** is an FTS5 virtual table, which Drizzle's DSL cannot express.
  It is hand-appended to the end of the initial migration
  (`src/db/migrations/*_initial_schema.sql`), below a marked comment — keep that
  block if the migrations are ever regenerated.
- **Search `MATCH`/`rank`** has no query-builder equivalent, so that one query is
  raw `sql` (still fully parameterised). Everything else is the query builder.

## Layout

```
src/
  routes/      [...path].ts — the one Void route; hands every request to Elysia
  db/          schema.ts (the scraper↔API contract), client.ts (Drizzle over D1),
               migrations/ (generated, plus the hand-appended FTS5 table)
  api/
    handler.ts   bindings + Drizzle client → app → access log; what the Worker runs
    app.ts       composition root
    names.ts     the nine game languages, listed once; every projection, type
                 and alias list is derived from it
    sprites.ts   R2 image URLs
    plugins/     cors, openapi, cache, rate-limit, errors
    modules/     one file per resource, or a folder splitting index (routes) /
                 model (zod) / service (Drizzle) once it earns one
  scraper/     `bun run data:build`: PokéAPI CSVs + Serebii → data/dataset.sql
    http.ts      the only network access: one request at a time, 5 s apart, cached
    build.ts     PokéAPI tables → our rows; match.ts maps Serebii's HOME list to forms
data/          seed.sql (hand-written fixture), version.json; dataset.sql is built, not committed
tests/         service · routes (full request path) · contract (OpenAPI) · data · scraper
  support/     bun:sqlite stand-in for a D1 binding
```

Tests drive the real `drizzle-orm/d1` driver through a `bun:sqlite`-backed D1
stand-in, so the code under test is the production path — same query builder,
same driver, same SQL, FTS5 included — with no workerd, Vite or network.

## Status

The API is complete. The dataset builds from PokéAPI (1025 species, 1579 forms,
names and categories in all languages), HOME depositability and per-game
availability (`homeGames`) from Serebii — `src/scraper/games.ts` documents how the
per-game rules fill in what Serebii's pages show — and name etymology in every
language from Bulbapedia. No Cloudflare resources have been created.

## Licence and attribution

Code is MIT. **Data is [CC BY-NC-SA 2.5](https://creativecommons.org/licenses/by-nc-sa/2.5/)**,
inherited from Bulbapedia — non-commercial use only, share-alike. See
[`NOTICE.md`](./NOTICE.md) for sources and [`DATA-LICENSE.md`](./DATA-LICENSE.md)
for what that means for you.

Not affiliated with Nintendo, Game Freak, Creatures Inc. or The Pokémon Company.
Pokémon and all related names are their trademarks.
