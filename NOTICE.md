# Sources and attribution

homedex combines a permissively licensed dataset with a narrowly scoped scrape.
The scrape is kept as small as possible on purpose: everything already available
under a permissive licence is taken from there instead.

## Data sources

| Source | Licence | Used for |
|---|---|---|
| [PokéAPI](https://github.com/PokeAPI/pokeapi) | BSD-3-Clause | Base dataset: species, forms, localised names and categories, stats, types, abilities, breeding data, encounters. Read from the repository's CSV files at a pinned commit — no requests to PokéAPI's servers |
| [Bulbapedia](https://bulbapedia.bulbagarden.net/) | CC BY-NC-SA 2.5 | Name etymology in every language, from each species' page. Read through its MediaWiki API, 50 pages per request (~21 requests) with `maxlag=5`, at most once a month |
| [Serebii](https://www.serebii.net/) | Used with permission — see below | Pokémon HOME depositability, and which HOME-connected games each form can move into |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites) | Repository CC0; artwork © The Pokémon Company | Official artwork, resized to WebP and served from the image bucket. Read from a git checkout at a pinned commit |

The artwork is not licensed by anyone who can license it: it is The Pokémon
Company's, and served here on the same non-commercial fan-use basis as PokéAPI
serves it. It is not part of the CC BY-NC-SA dataset.

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
