import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { z } from 'zod'
import { RATE_LIMITS } from '@/api/platform'

// Inline so the Worker serves no static asset. A house, not a Poke Ball: the API
// is unaffiliated. The red is the theme's light-mode accent below.
const favicon = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="8" fill="#c92f36"/>' +
        '<path d="M16 6 5 15h3v11h6v-7h4v7h6V15h3z" fill="#fff"/>' +
        '</svg>'
)}`

/** The public API, for the copy-paste examples in the introduction. */
const API_URL = 'https://homedex.danyalwe.me'

// Replaces Elysia's Scalar theme whole: graphite with one red accent, DM Sans and DM Mono.
const customCss = `
@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400..700&display=swap");
.scalar-app, .light-mode, .dark-mode {
  --scalar-font: "DM Sans", system-ui, sans-serif;
  --scalar-font-code: "DM Mono", ui-monospace, monospace;
  --scalar-radius: 6px; --scalar-radius-lg: 10px; --scalar-radius-xl: 12px;
}
.light-mode {
  --scalar-background-1: #fafaf9; --scalar-background-2: #f1f0ee; --scalar-background-3: #e6e5e2; --scalar-background-accent: #c92f3612;
  --scalar-border-color: #e1e0dc;
  --scalar-color-1: #1c1b1a; --scalar-color-2: #55514c; --scalar-color-3: #85807a;
  --scalar-color-accent: #c92f36;
  --scalar-sidebar-item-active-background: #c92f3614;
  --scalar-button-1: #1c1b1a; --scalar-button-1-color: #fff; --scalar-button-1-hover: #000;
}
.dark-mode {
  --scalar-background-1: #151515; --scalar-background-2: #1d1d1d; --scalar-background-3: #292929; --scalar-background-accent: #ff6b6b14;
  --scalar-border-color: #2e2e2e;
  --scalar-color-1: #f2f0ee; --scalar-color-2: #b3aea8; --scalar-color-3: #7f7a74;
  --scalar-color-accent: #ff6b6b;
  --scalar-sidebar-item-active-background: #ff6b6b1a;
  --scalar-button-1: #f2f0ee; --scalar-button-1-color: #151515; --scalar-button-1-hover: #fff;
}
.light-mode, .dark-mode {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: var(--scalar-color-1);
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  --scalar-color-blue: var(--scalar-color-accent);
}
/* Pinned over the top edge rather than a border: it stays on scroll and shifts nothing. */
body::before {
  content: ""; position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 1000;
  background: var(--scalar-color-accent); pointer-events: none;
}
.scalar-app h1 { font-weight: 700; letter-spacing: -0.03em; }
/* Wordmark atop the desktop sidebar: the favicon's house and the name. */
.t-doc__sidebar::before {
  content: "homedex"; display: flex; align-items: center; gap: 10px; flex: none;
  padding: 14px 12px 4px 12px; font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: var(--scalar-color-1);
  background: url("${favicon}") no-repeat 12px 13px / 22px; text-indent: 32px;
}
.scalar-app h2 { letter-spacing: -0.02em; text-wrap: balance; }
.scalar-app * { scrollbar-color: var(--scalar-border-color) transparent; }
.scalar-app :focus-visible { outline-color: var(--scalar-color-accent); }
::selection { background: var(--scalar-sidebar-item-active-background); color: var(--scalar-color-1); }
`

/**
 * Scalar UI at /docs, machine-readable spec at /openapi.json.
 *
 * The spec is generated from the same zod schemas that validate requests and
 * serialise responses, so documentation cannot drift from behaviour - a wrong
 * doc would be a failing request.
 */
export const documentation = new Elysia({ name: 'documentation' }).use(
    openapi({
        path: '/docs',
        // The plugin knows TypeBox natively and needs an explicit converter for
        // any Standard Schema validator.
        //
        // Both options are load-bearing. Bare `z.toJSONSchema` throws on a schema
        // containing a transform (the boolean query parameter), and the plugin
        // swallows that - silently emitting an endpoint with no parameters at all.
        // `io: 'input'` is also the correct view for documentation: it describes
        // what a client sends ("true"/"false", defaults optional) rather than what
        // the handler receives after parsing.
        mapJsonSchema: {
            zod: (schema: z.ZodType) =>
                z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
        },
        specPath: '/openapi.json',
        // The <title> comes from info.title ("homedex"), which also names the spec;
        // metaData overrides only the browser tab once Scalar loads.
        scalar: {
            // Pinned: the theme above styles Scalar's own classes and variables, which a release may rename.
            version: '1.78.0',
            favicon,
            customCss,
            theme: 'none',
            withDefaultFonts: false,
            darkMode: true,
            // Scalar shows its toolbar on any local host by default; off, `bun run dev` looks like production.
            showDeveloperTools: 'never',
            metaData: { title: 'homedex · API reference' }
        },
        exclude: { paths: ['/health'] },
        documentation: {
            info: {
                title: 'homedex',
                version: '1.0.0',
                description: [
                    'Pokemon data focused on what general-purpose APIs cover poorly:',
                    'Pokemon HOME depositability, names in all nine game languages,',
                    'real form handling, per-game encounter locations and name etymology.',
                    '',
                    '## Getting started',
                    '',
                    'No key and no sign-up: every endpoint is a `GET` that returns JSON.',
                    '',
                    '```sh',
                    `curl ${API_URL}/v1/pokemon/pikachu`,
                    '```',
                    '',
                    '```js',
                    `const response = await fetch('${API_URL}/v1/pokemon/25')`,
                    'const pikachu = await response.json()',
                    '// The forms Pokémon HOME can store',
                    'pikachu.forms.filter((form) => form.depositable).map((form) => form.slug)',
                    '```',
                    '',
                    '- **HOME depositability per form.** Every form says whether HOME can store it and which games it can move into; `/v1/pokemon` and `/v1/forms` filter on both.',
                    '- **Nine languages.** Names come in all nine languages the games ship in, wherever the games have them, and `/v1/search` finds a species by any of them.',
                    '- **Forms are first-class.** Each form has its own types, stats, abilities and sprites, and a `category` saying why it exists; `/v1/forms` lists them all.',
                    "- **The games' own words.** Pokédex entries (per game) and ability and move descriptions are the games' text, in every language they shipped in.",
                    '',
                    '## Good to know',
                    '',
                    `**Rate limits.** ${RATE_LIMITS.global} requests per ${RATE_LIMITS.windowSeconds}s per IP overall, ${RATE_LIMITS.search} per ${RATE_LIMITS.windowSeconds}s for`,
                    '`/v1/search`. Limits are enforced per Cloudflare location.',
                    '',
                    '**Caching.** Responses carry strong ETags derived from the dataset',
                    'version. Send `If-None-Match` and you will get a 304 for free.',
                    '',
                    '**Licence.** Data is CC BY-NC-SA 2.5, inherited from Bulbapedia.',
                    'Non-commercial use only. Not affiliated with Nintendo, Game Freak',
                    'or The Pokemon Company.'
                ].join('\n'),
                contact: { name: 'Source and issues', url: 'https://github.com/zAlweNy26/pokemon-scrapers' },
                license: {
                    name: 'CC BY-NC-SA 2.5',
                    url: 'https://creativecommons.org/licenses/by-nc-sa/2.5/'
                }
            },
            // This order is the sidebar's.
            tags: [
                {
                    name: 'Pokémon',
                    description: [
                        'Species, their forms and evolution chains, and name search.',
                        '',
                        'A **species** (`/v1/pokemon/{idOrName}`) is one National Dex number and holds everything about it,',
                        'its forms included. A **form** (`/v1/forms/{slug}`) is one look of a species, with its own types,',
                        'stats, abilities, sprites and HOME depositability; every species has exactly one default form.',
                        'List endpoints return slim records: follow the slug or `uri` for the full document.'
                    ].join('\n')
                },
                {
                    name: 'Traits',
                    description: [
                        'Types, abilities, moves and egg groups.',
                        '',
                        'Each list gives the identifiers the `/v1/pokemon` filters take and their names in every language.',
                        'A type or ability page also lists, page by page, the species that filter returns.'
                    ].join('\n')
                },
                {
                    name: 'Games',
                    description: [
                        'Generations, games, the games HOME connects to, and regional Pokédexes.',
                        '',
                        'Games are named two ways: a **version** (`scarlet`) for Pokédex entries, locations and encounters,',
                        'and a **version group** (`scarlet-violet`) for evolutions and HOME games. `/v1/games` gives both for each game.'
                    ].join('\n')
                },
                {
                    name: 'Meta',
                    description: [
                        'Dataset version, provenance and counts.',
                        '',
                        '`dataVersion` changes exactly when the data does and seeds every ETag: compare it to know when to refresh a copy.'
                    ].join('\n')
                }
            ]
        }
    })
)
