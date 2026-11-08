
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

Every text the dataset ships as game content (Pokédex entries, ability and move descriptions, names, categories) must be the original games' text, word for word, as the source transcribes it. Never text a source wrote itself (summaries, explanations, translations, editorial notes like "(Version 1.0)"), and never text we compose or rewrite.

- Rendering wikitext must keep the words the game shows: a template renders what the page displays, notes in `<small>`/`<sup>` are dropped, and text that differs between versions is split per version, never merged into one string.
- Before adding a text field, or when you cannot tell whether a text is the game's own, ask Dany. Do not guess.
- Every non-game text field is listed below and says so in its API `.describe()` ("Not game text: ..."). A new one needs Dany's OK first, then goes in both places.
- Bulbapedia's dex transcriptions are checked against PokéAPI's game-extracted `pokemon_species_flavor_text`; `bun run data:check` prints how many differ (81 on 2026-11-08, all disagreements between the two sources). A higher count after touching `src/scraper/wikitext.ts` or `src/scraper/pokedex.ts` means the rendering changed the game's words.

Game text we ship but have not settled (sources disagree, Bulbapedia flags it, or a rendering gap) is listed in `GAME-TEXT-REVIEW.md`, to review with Dany later. Add what you find there; remove a row once it is settled.

Non-game text Dany approved keeping (2026-11-08):

| Field | Written by |
| --- | --- |
| `ability.effect`, `move.effect` | PokéAPI (its `*_prose` tables) |
| `pokemon_origin.note` (etymology) | Bulbapedia |
| `availability.area` | Bulbapedia's wording around the game's place names |
| `pokemon.pronunciation`, `pronunciation_ipa` | pokeos |
| `form.name_*` | PokéAPI's full names ("Active Xerneas"), or ours: "Species (form name)" from two official strings |
| `pokedex_entry.form` | Bulbapedia's form label |
| `form_shiny.games` | Bulbapedia's game abbreviations |
| `*_ja_romaji` | PokéAPI's romanisation; the games show none |
