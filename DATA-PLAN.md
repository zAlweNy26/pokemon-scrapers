# homedex data plan — 2026-11-04

What is left from the audit, how the data layer should change, and how to collect
the data without getting blocked. Facts marked *checked* were verified on this date
against the source itself.

## Status (2026-11-04)

- **Done:** step 1 — `bun run data:build` builds the dataset from PokéAPI's CSVs at a
  pinned commit, with names, form names and categories in all ten languages,
  identifiers instead of labels, collapsed encounters (117,128 → 37,137 rows), chunked
  SQL, validation, a diff against the previous build and an automatic `DATA_VERSION`.
  HOME depositability per form comes from Serebii's box list: all 1391 entries map to
  forms (1294 of 1579 forms depositable), via a word matcher, 8 hand-written overrides
  and a rule for Alcremie's 62 cream/sweet image codes.
- **Schema ready, data not collected:** per-game HOME (`form_home_game`, `homeGames` in
  the API). Serebii's per-game Pokédex pages use the same image codes as the HOME list,
  so species map cleanly, but each row shows one icon per species: they cannot say which
  *forms* a game accepts (all Vivillon patterns appear as one). Needs a decision — see below.
- **Not started:** step 3, etymology from Bulbapedia.

### Per-game HOME: the open decision

About 14 Serebii pages cover the six HOME-connected Switch games (SV: Paldea, Kitakami,
Blueberry, "not in Pokédex"; SwSh: Galar, Isle of Armor, Crown Tundra, "other available";
BDSP: National, "transfer only"; Legends: Arceus: Hisui; Let's Go: Kanto; Legends Z-A:
Lumiose, Hyperspace, "transfer only"). Options:

1. **Species-level:** a form can enter a game when its species is listed there and the
   form is depositable. Simple, but over-claims (e.g. a Galarian form in Legends: Arceus).
2. **Evidence-only:** list a form only when that game's pages show its exact image code
   (the default form when the species is listed). Never wrong, but under-claims cosmetic forms.
3. **Evidence plus rules:** option 2, plus cosmetic forms (same types and stats as the
   default) follow their species. Closest to reality; a few more lines of rules.

Some games also restrict by *origin* (Let's Go only takes back Pokémon that came from
Let's Go); that cannot be expressed per form and would be documented, not modelled.

## Left over from the audit (`AUDIT.md`)

Everything is closed except **15** (answer 304 before the database runs), skipped on
purpose: Workers Cache answers most revalidations first. Follow-ups found on the way:

1. **The real data load must end like `data/seed.sql`:** write the three `count_*`
   rows to `meta` and run the FTS5 `rebuild`. Without the counts `/v1/meta` reports 0;
   without the rebuild, search is wrong.
2. **`HEAD` returns 404** (it did before Void too). About 3 lines in `src/routes/[...path].ts`.
3. **D1 read replicas are unused.** Our Drizzle client reads from the primary; a
   `withSession()` client could read nearby. Unverified that Drizzle's D1 driver accepts a session.
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
| Serebii | HOME depositability | **2 pages**: `pokemonhome/depositablepokemon.shtml`, `nondepositablepokemon.shtml` (*checked*) |
| Bulbapedia | name etymology | **~21**: the MediaWiki API returns 50 pages per request |

About 25 requests, under 2 minutes at Bulbapedia's 5-second delay. Rules:

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
