# Sources and attribution

homedex combines a permissively licensed dataset with narrowly scoped scrapes.
The scrapes are kept as small as possible on purpose: everything already available
under a permissive licence is taken from there instead.

## Data sources

| Source | Licence | Used for |
|---|---|---|
| [PokéAPI](https://github.com/PokeAPI/pokeapi) | BSD-3-Clause | Base dataset: species, forms, stats, EVs, types, abilities, moves, breeding data, regional dex numbers, evolutions, encounters, and the names the games' text lacks (game versions, some forms). Read from the repository's CSV files at a pinned commit — no requests to PokéAPI's servers |
| [Poké Corpus](https://github.com/abcboy101/poke-corpus) | Repository GPL-3.0; the text is © Nintendo, Creatures Inc., GAME FREAK inc. | The games' own text in every language they ship: species, form, type, ability and move names, categories, ability and move descriptions, regional Pokédex names, and every game's Pokédex entries. Read from a git checkout at a pinned commit |
| [Bulbapedia](https://bulbapedia.bulbagarden.net/) | CC BY-NC-SA 2.5 | From each species' page: name etymology in every language and game locations. From two list pages: shiny availability per generation ("List of unobtainable Shiny Pokémon") and Legends: Z-A alphas. Type index numbers and origin marks are transcribed from its pages into the code. Read through its MediaWiki API, 50 pages per request (~21 requests, plus one per list page) with `maxlag=5`, at most once a month |
| [Serebii](https://www.serebii.net/) | Used with permission — see below | Pokémon HOME depositability, and which HOME-connected games each form can move into |
| [pokeos](https://pokeos.com/) | Used with permission — see below | Sub-legendary, Ultra Beast and Paradox flags, English pronunciations (respelling and IPA), shiny locks, and encounters for the games PokéAPI has none for (Scarlet/Violet with DLC, Legends: Z-A) |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites) | Repository CC0; images © The Pokémon Company | Pokémon HOME renders (regular, shiny and female), resized to WebP and served from the image bucket. Read from a git checkout at a pinned commit |

The renders are not licensed by anyone who can license them: they are The Pokémon
Company's, and served here on the same non-commercial fan-use basis as PokéAPI
serves them. They are not part of the CC BY-NC-SA dataset.

## Serebii

Serebii's terms do not permit reproduction. The site's owner granted explicit
permission for this project, on two conditions:

1. **Do not spam the scraping routine.**
2. **Do not make money from it.**

Both are honoured. A full build reads 19 Serebii pages — the HOME box list and each
HOME-connected game's availability lists — and at most once a day. The scraper is
single-flight with at least 5 seconds between requests, keeps an on-disk cache it
reuses for 24 hours (Serebii sends no `ETag`/`Last-Modified`, so conditional
requests cannot help), sends conditional requests where a site supports them,
backs off on `429`/`5xx` honouring `Retry-After`, stops after three failures, and
sends an identifying User-Agent with the project's URL.

If you fork this project, that permission **does not transfer to you**. Ask them
yourself, or drop Serebii as a source.

## pokeos

pokeos publishes no open licence. Its owner allowed this project to read its API
on one condition: **do not spam it**.

A full build makes about 95 requests to `api.pokeos.com` — the species list the
site itself boots from, the pronunciation list, and encounters per location for two
games — through the same single-flight client as Serebii (5 seconds apart, backoff,
identifying User-Agent), with every response cached for 30 days.

As with Serebii, that permission **does not transfer** to forks.

## Non-commercial

This API can never carry advertising or a paid tier. Two independent obligations
require it, either one sufficient:

- Bulbapedia's CC BY-NC-SA 2.5 licence prohibits commercial use, and the
  share-alike term extends to derived datasets.
- The Serebii permission above was granted on a no-profit basis.

## Trademarks

Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc. Pokémon and Pokémon
character names are trademarks of Nintendo. This project is not affiliated with,
endorsed by, or sponsored by any of them.
