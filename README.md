# Lord of Wockstruction

A single-player, browser-based hack and slash action RPG inspired by Diablo 1 and 2.

**Play it at [lord-of-wockstruction.vercel.app](https://lord-of-wockstruction.vercel.app).**

## How to play

Lead your Hero out of Town, through Combat Areas full of Monsters, to the Act Boss. Town is safe, and it's where the Hero returns after Death. The game runs in the browser on desktop and on touch screens.

## Development

You need Node 24, the version CI uses.

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # lint, typecheck and tests, as CI runs them
```

The other scripts:

- `npm run build` and `npm start`: build the production app and serve it.
- `npm run format`: format the code with Biome.
- `npm run import:kaykit`: re-import the KayKit models (see [Art and credits](#art-and-credits)).
- `npm run thumbnails:kaykit`: render the KayKit tileset's thumbnails after an import. It needs Google Chrome.
- `npm run tuning:report`: print Experience, kills per Level and each Combat Area's Monster numbers from the live tuning.

The stack is Next.js and React for the app shell, three.js for the 3D world, Pixi.js for the HUD and panels drawn over it, Vitest for tests and Biome for lint and formatting.

### Layout

- `src/game`: the game: the fixed-step simulation, input, rendering, the 3D world, tuning and the Save.
- `src/app`: the Next.js app shell that loads the game.
- `content/`: the Areas, as Tiled files, plus the tilesets and branding.
- `scripts/`: the KayKit import and the tuning report.
- `vendor/`: the paid KayKit packs the import reads. They're gitignored, so a fresh clone has none, and the import keeps the committed models.

### Docs

- [GLOSSARY.md](GLOSSARY.md): the game's vocabulary. Code, comments and on-screen text use its terms.
- [CODING_STANDARDS.md](CODING_STANDARDS.md): the judgement rules for review.
- [docs/adr/](docs/adr/): architecture decisions.
- [docs/agents/](docs/agents/) and [AGENTS.md](AGENTS.md): how agents work on this repo (tickets, playtesting, tuning).

### Deploys

`main` deploys to production through Vercel's GitHub integration. Each pull request gets its own preview deploy.

## Art and credits

The 3D models are by Kay Lousberg ([KayKit](https://www.kaylousberg.com)), under CC0. See [CREDITS.md](CREDITS.md) for the full list.

`npm run import:kaykit` re-imports them from pinned KayKit commits (see `scripts/import-kaykit/main.mts`). Run it by hand and commit what it writes: `public/assets/models/`, `content/tilesets/kaykit.tsj` and `CREDITS.md`. The build never runs it.
