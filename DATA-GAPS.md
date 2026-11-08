# homedex data gaps — 2026-11-04

What a "full view" of every Pokémon would still need, measured against the sources
homedex already has on disk: PokéAPI's CSVs at the pinned commit (`data/version.json`),
the cached Serebii pages and the cached Bulbapedia species pages (`.cache/http`).
Numbers were counted on this date at PokéAPI commit `e5b79b2e`; re-count them before
acting on an old row (see *Re-checking* at the end).

## Status

- **Done:** section 1's evolutions, EV yield, base experience, species flags and regional
  dex numbers (see the commit that added this file); then names for types, abilities and moves;
  then section 2: Bulbapedia's Pokédex entries (17,909) and game locations (26,791), every
  main-series game and DLC. Left as they are: entries are English only; form labels
  ("Alolan Form") are Bulbapedia's text, not linked to form slugs; locations are a readable
  sentence per game, not structured (location, method) rows; side games (Stadium, Pal Park,
  Pokéwalker, Dream World, Pokopia) are left out.
- **Done (2026-11-07), from pokeos.com** (`src/scraper/pokeos.ts`, owner's permission):
  structured encounters for Scarlet/Violet + DLC (1,726 / 1,728) and Legends Z-A (489),
  as (location, method) with no levels; sub-legendary (44), Ultra Beast (11) and Paradox (20)
  flags; shiny-locked forms (51); English pronunciations (all 1,025). Its Legends Z-A
  learnsets were left out: they mix another species' moves into each list.
- Everything else below is open.

## 1. Free — already in PokéAPI's CSVs, not read yet

The build reads 21 of PokéAPI's 188 CSVs. No new requests are needed for any of these.

| Data | Files | Coverage |
|---|---|---|
| ~~Evolutions~~ (methods, chains) | `pokemon_evolution`, `pokemon_species.evolution_chain_id` | 676 method rows for 484 evolved species; all 1025 species have a chain |
| ~~Regional dex numbers~~ | `pokemon_dex_numbers`, `pokedexes` | 35 dexes, incl. Paldea, Kitakami, Blueberry, Hisui, Lumiose |
| ~~EV yield~~ | `pokemon_stats.effort` (the build read the file and dropped the column) | 1,436 non-zero values; all zero (stored as unknown) for 49 forms: Legends Z-A's new Megas. Bulbapedia's infobox (`evhp=`, `evde2=`…) could fill them |
| ~~Species flags~~: legendary, mythical, baby, gender differences, forms switchable, growth rate, colour, shape, habitat | `pokemon_species` | complete; habitat is null for 639 species (Gen 4+ has none) |
| ~~Base experience~~ | `pokemon.base_experience` | null for 49 of 1351 varieties |
| Form flags: battle-only, Mega, introducing game | `pokemon_forms` | complete; `src/scraper/index.ts` reads `is_battle_only` only to validate. 97 Megas, 34 Gigantamax |
| ~~Localized names for types, abilities, moves~~ | `type_names`, `ability_names`, `move_names` | done: `/v1/types`, `/v1/abilities`, `/v1/moves`, and named abilities in the detail. No romaji anywhere; Eelevate, Fire Mane and Aura Guard (Z-A) are English-only |
| Localized labels for natures, egg groups, versions, items, growth rates | `*_names`, `*_prose` | all our languages; still returned as slugs |
| Localized location names | `location_names` | only partial: en/ja/fr ~1,070; de/es/it/ko/zh 286; zh-Hans/ja-Hrkt 89 |
| ~~Ability descriptions~~ | `ability_prose` (en effect), `ability_flavor_text` (per game, all languages) | English done: `description` and `effect` on `/v1/abilities/:slug`, all 314. Other languages left out for now: flavor text covers ja 311, fr 307, the rest 267 (nothing after Gen 8); prose only fr and de, partially |
| Earlier-generation stats, types, abilities | `pokemon_stats_past`, `pokemon_types_past`, `pokemon_abilities_past` | 235 / 36 / 569 rows (e.g. Clefairy was Normal before Gen 6) |
| Type chart, for per-form weaknesses | `type_efficacy`, `type_efficacy_past` | complete |
| Learnsets | `pokemon_moves`, `moves`, `move_names`, `machines` | 638k rows (142k collapsed across games). Up to Scarlet/Violet, Legends Arceus, Champions. **No Legends Z-A or Mega Dimension.** Several times today's 3.5 MB dataset: decide the shape (latest game only? per game?) before adding |
| Held items in the wild | `pokemon_items` | stops at Ultra Sun/Moon — weak |
| Natures, characteristics | `natures`, `characteristics` | reference data, low value |

Not worth it: `conquest_*`, contests, Pokéathlon, Pal Park, berries — spin-off or legacy.

## 2. Free — already in the cached Bulbapedia pages

`etymology.ts` fetches each species page's full wikitext (`rvprop=content`), and the
cache holds it. Besides the name origin it carries what PokéAPI lacks for recent games:

| Data | Template | Recent coverage (entries) | PokéAPI for comparison |
|---|---|---|---|
| Pokédex entries (English) | `{{Dex/Entry1\|v=…}}`, `{{Dex/Entry2\|…}}` | Scarlet 783, Sword 738, Legends Z-A 543, BDSP 338 | Scarlet/Violet 120 species, Z-A 0, BDSP 0 (other languages up to Sword/Shield) |
| Game availability | `{{Availability/Entry1\|2[/None]\|v=…\|area=…}}` | BDSP, Legends Arceus, Scarlet/Violet + DLC, Legends Z-A | **no encounters at all** for those four games (Scarlet/Violet and Z-A now come from pokeos; BDSP and Legends Arceus are still missing) |

The `/None` variants record unobtainable-in-the-wild cases (`Trade`, `Event`, …), which
also covers part of origin restrictions. Cost: parsing. `area=` is free text with wiki
links, `<br>`, `{{t|Ice}}`-style templates and version notes; `src/scraper/wikitext.ts`
is the starting point. Licence is unchanged (Bulbapedia is already CC BY-NC-SA 2.5 here).

## 3. Needs new Serebii requests (keep each to a handful of pages)

- **Legends Z-A / Mega Dimension learnsets** — first bump the pinned PokéAPI commit and
  re-count; scrape only if PokéAPI still lacks them.
- ~~**Shiny-locked Pokémon per game**~~ — done from pokeos, per form but not per game.
- **Origin restrictions** (Let's Go only takes back its own; BDSP's one-per-save limit) —
  listed as "not modelled" in `DATA-PLAN.md`.
- **Pokémon Champions** — PokéAPI already has it (`champions` version group: 319 learnsets,
  a 231-entry dex) but `form_home_game` does not. Check whether it is released and
  HOME-connected, then add it to `src/scraper/games.ts`.

## 4. Known, out of scope here

- `form.sprite_key` is null on all 1,579 forms: the image decision in `DATA-PLAN.md` item 13.

## Re-checking

Coverage per game, from the repo root (PokéAPI must be checked out by `data:build` first):

```ts
// bun -e '…' or a scratch file
import { readTable } from './src/scraper/pokeapi'
const versionGroups = new Map((await readTable('version_groups')).map((r) => [r.id, r.identifier]))
const perGame = Map.groupBy(await readTable('pokemon_moves'), (r) => versionGroups.get(r.version_group_id))
console.log([...perGame].map(([game, rows]) => `${game}: ${new Set(rows.map((r) => r.pokemon_id)).size}`))
```

Swap the table for `encounters` (by `version_id`), `pokemon_species_flavor_text`
(`version_id`) or `pokemon_dex_numbers` (`pokedex_id`). For Bulbapedia, count templates
in the cache:

```sh
cat .cache/http/*.body | grep -o "{{\(Dex/Entry[0-9]*\|Availability/Entry[0-9]*\(/None\)\?\)|v=[^|}]*" \
  | sed 's/|v=/ /' | sort | uniq -c | sort -rn
```
