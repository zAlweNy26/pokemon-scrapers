
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Game text only

Every text the dataset ships as game content (Pokédex entries, ability and move descriptions, names, categories) must be the original games' text, word for word. Never text a source wrote itself (summaries, explanations, translations, editorial notes like "(Version 1.0)"), and never text we compose or rewrite.

**Text extracted from the games is the one source of truth.** That is [Poké Corpus](https://github.com/abcboy101/poke-corpus) (pinned in `src/scraper/corpus.ts`): every game's message files, in every language the game ships, each line keyed by a label in `qid_*.txt`. Dany chose it on 2026-11-10.

- Where the corpus has a text, ship the corpus's and nothing else: it replaces PokéAPI's and Bulbapedia's transcriptions, even where they disagree. Names, categories, form labels, types, abilities and moves come from HOME (Champions and Scarlet/Violet for what HOME lacks), descriptions from the latest game that has a real one, Pokédex names from each game's label, entries from each game (HOME for FireRed/LeafGreen and X/Y onwards): `src/scraper/game-text.ts` and `src/scraper/dex-entries.ts`.
- Where no game has a text (a language the game never shipped, a form or Pokédex no game names), ship null. Never fill it from a site; ask Dany if a gap looks wrong.
- Render the corpus as the screen shows it, on one line (`render` in `src/scraper/corpus.ts`): the text box's line and page breaks become a space where the language spaces its words, nothing in Chinese, and in Japanese the full-width space its kana text puts between phrases; a word split at a hyphen is whole again. The words stay as they are, capitals and typos included. Game Boy text also prints its literals ("#" is "POKé") from the lines its own file keeps them on.
- Every game names a language its own way (Generation I-IV Japanese is kana only, `ja-Hrkt`); take what that game shows.
- Before adding a text field, or when you cannot tell whether a text is the game's own, ask Dany. Do not guess.
- Every non-game text field is listed below and says so in its API `.describe()` ("Not game text: ..."). A new one needs Dany's OK first, then goes in both places.
- Rendering the wikitext Bulbapedia still supplies (etymology, game locations) must keep the words the page shows: a template renders what the page displays, notes in `<small>`/`<sup>` are dropped.
- The corpus's English entries are checked against PokéAPI's own extraction, `pokemon_species_flavor_text`; `bun run data:check` prints how many differ (52 of 14,476 on 2026-11-10, where the two extractions disagree). A higher count after touching `src/scraper/corpus.ts` or `src/scraper/dex-entries.ts` means the rendering changed the game's words.

Game text we ship but have not settled (the corpus and PokéAPI disagree, a rendering judgment, a gap the games may fill) is listed in `GAME-TEXT-REVIEW.md`, to review with Dany later. Add what you find there; remove a row once it is settled.

Non-game text Dany approved keeping (2026-11-08):

| Field | Written by |
| --- | --- |
| `ability.effect`, `move.effect` | PokéAPI (its `*_prose` tables) |
| `pokemon_origin.note` (etymology) | Bulbapedia |
| `availability.area` | Bulbapedia's wording around the game's place names |
| `pokemon.pronunciation`, `pronunciation_ipa` | pokeos |
| `game.name_*` | PokéAPI's version names ("Scarlet: The Teal Mask" for a DLC); approved 2026-11-09 |
| `pokedex.name_en` of a Pokédex no game names (Kanto, Johto, Hisui...) | PokéAPI's Pokédex name, kept because the column is required; awaiting Dany's OK (2026-11-10) |
| `form.name_*` | PokéAPI's full names ("Active Xerneas"), or ours: "Species (form label)" from two game strings, the label HOME's where it has the form |
| `form_shiny.games` | Bulbapedia's game abbreviations |
