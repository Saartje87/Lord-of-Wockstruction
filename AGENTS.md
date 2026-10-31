<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Tickets live in the Tandembike project `Lord of Wockstruction`, handled through the `tandembike` MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Checks

`npm run check` runs lint, typecheck and tests, as CI does.

### Playtesting

Before finishing a ticket that changes a panel's layout, a model's look or any on-screen criterion, see it running: `docs/agents/playtesting.md` (dev servers in worktrees, starting at a given Level or Area, screen sizes, touch screens, controllers, reading the game state, the live deploy).

### Tuning

On tuning tickets, `npm run tuning:report` prints Experience, kills per Level and each Combat Area's Monster numbers from live tuning. `npm run tuning:fight` times a Unique Monster's fight against a Hero of a given Level. See `docs/agents/tuning.md`.

### Area maps

On tickets that place spawns, Unique Monsters or Entries, and when reviewing them, `npm run area:map <area>` prints the Area as a numbered tile grid with a legend. See `docs/agents/area-map.md`.

### 3D models

When suggesting models for something in the game, browse `vendor/kaykit/` (the paid KayKit Mystery Monthly packs, gitignored) alongside the KayKit packs already listed in `CREDITS.md`. Only the packs wired into `scripts/import-kaykit/main.mts` get imported, so a suggestion from another pack also means adding that pack to the import. See README's "Art and credits".

### From grilling to tickets

When a grilling session reaches a shared understanding, stop once the glossary is updated. Ask the user to type `/mattpocock-skills:to-spec` and then `/mattpocock-skills:to-tickets`. Agents can't call these skills themselves, so never write the spec or tickets by hand instead.
