# homedex data plan — 2026-11-04

What is left from the audit, how the data layer should change, and how to collect
the data without getting blocked. Facts marked *checked* were verified on this date
against the source itself.

## Status (2026-11-04)

- **Done:** step 1 — `bun run data:build` builds the dataset from PokéAPI's CSVs at a
  pinned commit, with names, form names and categories in all nine languages,
  identifiers instead of labels, collapsed encounters (117,128 → 37,137 rows), chunked
  SQL, validation, a diff against the previous build and an automatic `DATA_VERSION`.
  HOME depositability per form comes from Serebii's box list: all 1391 entries map to
  forms (1294 of 1579 forms depositable), via a word matcher, 8 hand-written overrides
  and a rule for Alcremie's 62 cream/sweet image codes.
- **Done:** per-game HOME, option 3 below, in `src/scraper/games.ts`. 19 Serebii pages
  (the HOME list plus 18 game availability lists, fetched once a day at most) give each
  game's sprite codes, which are the same codes as the HOME list. Resulting forms per
  game: Let's Go 171, Sword/Shield 785, BDSP 535, Legends: Arceus 287, Scarlet/Violet
  911, Legends Z-A 431. The rules, each with a test in `tests/scraper/games.test.ts`:
  1. a species is in a game when its plain dex number, its default form, a number up
     to `nationalDexUpTo` (BDSP: 493, for Darkrai, Shaymin, Arceus) or a region in
     `speciesFollowsRegions` (Sword/Shield: `galar`) is shown; its default form follows;
  2. a regional form (by name: "Galarian Form", not the slug) needs evidence for its own
     region, or a game's `regionsFollowSpecies` (Let's Go: `alola`);
  3. any other form is in when shown; when not shown it is out if the game lists that
     species form by form, or if it is cosmetic and shown for another game (Cap Pikachu);
     otherwise it follows its species (Rotom, Unown, Alcremie, Zygarde 10%).
  Three depositable forms land in no game, as Serebii's pages say: Garden and Marine
  Vivillon, Pom-Pom Oricorio. The build prints them every time.
- **Not modelled:** origin restrictions (Let's Go only takes back Pokémon that came from
  Let's Go; BDSP's one-per-save limit for Special Pokémon).
- **Done:** step 3, etymology from Bulbapedia (`src/scraper/etymology.ts`). English from each
  species page's "Name origin" section, the other languages from its `{{Other languages}}`
  table (Mandarin's meaning serves both Chinese scripts; romaji has none). 9,225 notes:
  every species in all nine languages. 21 requests of 50 pages, cached 30 days. The build
  fails on a missing page or a page for another species, and lists any wiki template it
  had to render by guess.

- **Done:** evolutions, regional dex numbers, EV yield, base experience and species flags
  from PokéAPI. What else a full view would need, and where it is: `DATA-GAPS.md`.

## Left over from the 2026-11-04 audit (`AUDIT.md`, removed in git history)

Everything is closed except **15** (answer 304 before the database runs), skipped on
purpose: Workers Cache answers most revalidations first. Follow-ups found on the way:

1. **The real data load must end like `data/seed.sql`:** write the three `count_*`
   rows to `meta` and run the FTS5 `rebuild`. Without the counts `/v1/meta` reports 0;
   without the rebuild, search is wrong.
2. ~~`HEAD` returns 404~~ — done: `src/api/handler.ts` answers HEAD as the GET it mirrors, without a body.
3. ~~D1 read replicas are unused~~ — done: `src/db/client.ts` reads through a `'first-unconstrained'`
   D1 session (Drizzle only calls `prepare()` and `batch()`, which a session has). Load data a
   minute before deploying, so no replica serves old rows under the new `DATA_VERSION`: CI
   enforces it from the `data_version` and `loaded_at` rows the load writes to `meta`.
4. **Not deployed yet:** `bun run deploy`, commit `void.lock.json`, attach the domain with `void domain`.

## Replace veekun with PokéAPI's CSV files

- **veekun is dead** — last commit 2021-06-22 (*checked*).
- **PokéAPI's `data/v2/csv`** in `PokeAPI/pokeapi` is BSD-3, last updated
  2026-10-20, has all 1025 species, names and categories in all ten of our
  languages, games up to Legends Z-A, form names and 117,128 encounter rows (*checked*).
- **Zero HTTP requests:** clone the repository at a pinned commit instead of calling
  the PokéAPI website. Record the commit in `meta` so every build is reproducible.

veekun is PokéAPI's ancestor, so nothing is lost. `NOTICE.md` needs updating.

## Data-layer improvements

5. **Scraper as its own pipeline:** fetch → raw cache on disk → parse → validate → emit
   SQL. Parsers are pure functions tested on saved pages, so they can be fixed without
   re-downloading. Runs with Bun on your machine, never inside the Worker.
6. **Emit SQL within D1's limits:** at most 100 KB per statement and 100 bound
   parameters per query (*checked*, D1 limits page). Chunk multi-row `INSERT`s. Load with
   `void db execute --remote --file data/dataset.sql`.
7. **Treat a load as not atomic** (unverified either way). Load the same file locally
   first (`void db seed --file …`) and run `bun test` on it; compare `/v1/meta` counts
   after the real load; `void db restore --timestamp` rolls back (30 days of history on Workers Paid).
8. **Derive `DATA_VERSION`** from a hash of the generated dataset, written to a file that
   `void.config.ts` imports, so ETags cannot serve stale data.
9. **Stable identifiers** (`water`, `scarlet`) instead of English labels for types,
   games, egg groups and abilities: filters stop depending on spelling and case.
10. **Collapse encounters** from PokéAPI's slot-level rows to (species, game, location, method).
11. **Validate before loading:** 1025 species, no missing names where PokéAPI has them,
    and a diff against the previous dataset (added / removed / changed) for review.
    The database already refuses a second default form or a broken reference.
12. **Gaps:** form names and categories were English-only (PokéAPI has all languages);
    HOME depositability was one boolean, but it really varies by game.
13. **Images are a legal risk:** the R2 sprites are © Nintendo and covered by none of the
    data licences. A separate decision from the data.

## Collecting data without getting blocked

The main protection is needing very few requests:

| Source | Used for | Requests per full run |
|---|---|---|
| PokéAPI | almost everything | **0** (git clone) |
| Serebii | HOME depositability | **19 pages**: the HOME box list plus each HOME-connected game's availability lists (`NOTICE.md`) |
| Bulbapedia | name etymology | **~21**: the MediaWiki API returns 50 pages per request |
| pokeos.com | Scarlet/Violet + Z-A encounters, sub-legendary/Ultra Beast/Paradox/shiny-locked flags, pronunciations | **~95**: one bulk species list, one pronunciation list, then one request per location (owner's permission: don't spam it). Cached 30 days |

About 110 requests, under 10 minutes at Bulbapedia's 5-second delay (one delay for every site). Rules:

- **One request at a time**, at least 5 s apart (Bulbapedia's robots.txt: `Crawl-delay: 5`, *checked*).
- **Identifying User-Agent** with the project URL and a contact address.
- **Bulbapedia through its API** (MediaWiki 1.43, *checked*), with `maxlag=5`. `mwn`
  (3.0.3, updated 2026-06, LGPL-3.0, *checked*) handles batching, continuation, `maxlag` and retries.
- **On-disk cache + conditional requests** (`ETag` / `If-Modified-Since`): re-runs are mostly 304s.
- **Back off on `429`/`5xx`**, honour `Retry-After`, and **stop** after a few failures in a row.
- **Run by hand from your own connection** when a game or DLC ships. Bulbapedia is
  behind Cloudflare (`server: cloudflare`, *checked*); cloud, CI and Worker IPs are more
  likely to be challenged.
- **Never work around a block** — no proxies, rotating IPs or headless browsers. That
  would break Serebii's "don't spam" condition. If challenged, slow down or ask.
- **Serebii is ISO-8859-1**, not UTF-8 (*checked*): `response.text()` would garble names
  like Flabébé. Decode with `new TextDecoder('windows-1252')`.

## Order

1. Base data from PokéAPI's CSVs, all languages for names, form names and categories (5, 6, 8–11).
2. Per-game HOME depositability from the two Serebii pages.
3. Etymology from Bulbapedia.
