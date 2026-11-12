# Takedown runbook

What to do if a rights holder, or a source that gave permission (see
[`NOTICE.md`](./NOTICE.md)), asks for homedex or part of it to come down.
Step 1 takes about ten minutes and can be undone; step 2 cannot.

## What is live

| Piece | Where |
|---|---|
| API Worker `homedex` | `https://homedex.danyn.dev` (custom domain, `void.config.ts`) |
| D1 database `homedex` | id in `void.lock.json` |
| Sprites | R2 bucket `S3_BUCKET` in `.env`, served at `https://images.homedex.danyn.dev` |
| Edge cache | zone `danyn.dev` |
| Code | `github.com/zAlweNy26/pokemon-scrapers` (public); `data/seed.sql` holds a few species' game text |
| Local copies | `data/dataset.sql`, `.cache/` (scraped pages, Poké Corpus, PokéAPI, sprites) |

## Step 1 - everything offline, reversible

Run in this order: CI deploys on every push to `main`, so it is stopped first.

```bash
gh workflow disable deploy.yml          # nothing redeploys behind you
bunx wrangler delete --name homedex     # API and its domain gone; D1 untouched
```

Then in the Cloudflare dashboard:

1. **R2** → the sprite bucket → Settings → Custom Domains → remove
   `images.homedex.danyn.dev`. Leave public `r2.dev` access off.
2. **danyn.dev** → Caching → Configuration → **Purge Everything**, so no edge
   copy of a response or image outlives the step above.

Check both are gone (neither may answer 200):

```bash
curl -I https://homedex.danyn.dev/v1/meta
curl -I https://images.homedex.danyn.dev/home/25/96.webp
```

To undo: add the custom domain back, `gh workflow enable deploy.yml`, `bun run deploy`.

## Step 2 - delete, only if the request asks for it

Cannot be undone.

- Sprites: empty the R2 bucket, then `bunx wrangler r2 bucket delete <bucket>`.
- Data: `bunx wrangler d1 delete homedex`.
- Local copies: `rm data/dataset.sql && rm -r .cache`.
- Code: `gh repo edit zAlweNy26/pokemon-scrapers --visibility private --accept-visibility-change-consequences`,
  or archive or delete it. Forks are out of reach.

## Partial requests

- **Sprites only:** step 1's R2 item alone. The API keeps working with dead
  `sprites` URLs until a deploy returns `null` for them.
- **One source withdraws** (Serebii, pokeos): step 1, then rebuild the dataset
  without that source before bringing the API back.

## Answering

- Reply in writing: what was removed, and when. Keep the request and the reply.
- Do not argue the claim, admit liability or pay anything without an Italian IP
  lawyer. Step 1 meets any deadline a first notice gives.

## Keep ready

- `bunx wrangler whoami` must succeed: an expired login is what would stall step 1.
  Keep a scoped API token in a password manager as a fallback.
- Two-factor login on Cloudflare and GitHub.
- Rehearse once: remove the R2 custom domain, add it back.
