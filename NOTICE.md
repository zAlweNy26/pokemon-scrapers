# Sources and attribution

homedex combines permissively licensed datasets with a narrowly scoped scrape.
The scrape is kept as small as possible on purpose: everything already available
under a permissive licence is taken from there instead.

## Data sources

| Source | Licence | Used for |
|---|---|---|
| [veekun/pokedex](https://github.com/veekun/pokedex) | MIT | Base dataset: species, localised names, stats, types, breeding data |
| [PokéAPI](https://github.com/PokeAPI/pokeapi) | BSD-3-Clause | Cross-checking and gap-filling on the base dataset |
| [Bulbapedia](https://bulbapedia.bulbagarden.net/) | CC BY-NC-SA 2.5 | Recent generations, forms, name etymology |
| [Serebii](https://www.serebii.net/) | Used with permission — see below | Pokémon HOME depositability |

## Serebii

Serebii's terms do not permit reproduction. The site's owner granted explicit
permission for this project, on two conditions:

1. **Do not spam the scraping routine.**
2. **Do not make money from it.**

Both are honoured. The scraper is single-flight with a fixed delay between
requests, issues conditional (`ETag` / `If-Modified-Since`) requests, keeps an
on-disk HTTP cache so re-runs do not refetch, backs off on `429`/`5xx`, and sends
an identifying User-Agent with contact details.

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
