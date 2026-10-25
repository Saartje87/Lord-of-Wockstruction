# PixiJS v8 in Next 16, and which helper libraries to use

Research for ticket #75 (child of map Epic #74). Researched 2026-10-25 against the versions in this repo and on npm that day:

- `next@16.4.3`, `react@19.3.0`, with `cacheComponents: true` in `next.config.ts`
- `pixi.js@8.22.0` (latest, published 2026-10-01)

Next.js facts come from the docs shipped in `node_modules/next/dist/docs/`, not from memory. PixiJS facts come from pixijs.com, the published `pixi.js@8.22.0` source on unpkg, and the GitHub repos.

## TL;DR (decisions)

| Concern | Recommendation |
| --- | --- |
| Mounting Pixi | Plain `useEffect` mount inside a `'use client'` component, loaded with `next/dynamic` and `{ ssr: false }`. **Do not adopt `@pixi/react`.** |
| StrictMode / cleanup | Hold on to the `init()` promise and destroy only after it settles. `app.destroy()` throws if called before `init()` resolves. |
| Resize | `resizeTo: window` plus `autoDensity: true` and a capped `resolution`. Nothing else needed. |
| Game state vs React | The game (world, entities, loop) lives in plain TS modules that receive an `Application`. React owns only the mount point and, later, the HUD overlay. |
| Iso tilemap rendering | **Write it ourselves.** Hand-rolled iso projection, Sprites from one spritesheet, depth sort by `zIndex`. `@pixi/tilemap` is optional, for the flat floor layer only, and only if profiling shows a need. |
| A* pathfinding | **Write it ourselves.** About 100 lines: 8-direction A* on a grid with a binary heap and no corner-cutting. Both npm candidates are unmaintained. |
| Tiled map loading | **Write a small TMJ (Tiled JSON) reader ourselves** for the subset we use. Revisit `pixi-tiledmap` only if we need many Tiled features. This also depends on whether we author maps in Tiled at all (open question). |
| Input | Pixi's federated pointer events on the stage for click-to-move; plain `window` key listeners for hotkeys. No library. |
| Camera | Hand-rolled (move a world `Container`). `pixi-viewport` is v8-compatible but built for pan and zoom, not for a camera that follows the player. |

## 1. Mounting a Pixi v8 Application in Next 16

### 1.1 Client-only, no SSR

- In the App Router, Client Components are still **prerendered (SSR) during `next build`** by default. To skip that, use `next/dynamic` with `{ ssr: false }`. This is meant for "third-party libraries that rely on browser APIs like `window` or `document`." (`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`, section "Rendering components only in the browser")
- `ssr: false` **only works when it is called from a Client Component.** Next errors if it is used in a Server Component: "`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component." (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`, section "Skipping SSR")
- Alternatives the docs mention, which we don't need here:
  - Guard browser APIs inside `useEffect` (`static-exports.md`, section "Browser APIs").
  - React 19.3's new `use(browser())` from `react-dom`, which suspends to the nearest `<Suspense>` during prerender (`single-page-applications.md`). It is aimed at components whose *first render* reads browser state. A canvas mount only touches the browser in an effect, so `dynamic(..., { ssr: false })` is the simpler fit. It also code-splits Pixi out of the initial bundle.

So the shape is: `src/app/page.tsx` (Server Component) renders a small `'use client'` wrapper, and that wrapper does `dynamic(() => import('./game-canvas'), { ssr: false })`.

### 1.2 Async `init()` and StrictMode double-mount

- In v8, setup takes two steps: `new Application()`, then `await app.init({...})`. The canvas is `app.canvas`. ([Application guide](https://pixijs.com/8.x/guides/components/application), [API: Application](https://pixijs.download/release/docs/app.Application.html))
- In the App Router, Strict Mode is **on by default** (since 13.5.1). In dev, effects mount, clean up and mount again. (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactStrictMode.md`)
- **Key source finding:** in `pixi.js@8.22.0`, `Application.init()` assigns `this.renderer` only after `await autoDetectRenderer(...)` resolves. Plugins such as `ResizePlugin` are initialised after that. `destroy()` calls each plugin's `destroy`, then `this.renderer.destroy(...)`, with no guard. So **calling `destroy()` while `init()` is still pending throws.** The renderer is undefined, and `ResizePlugin.destroy` calls an `_cancelResize` that hasn't been created yet. ([`lib/app/Application.mjs`](https://unpkg.com/pixi.js@8.22.0/lib/app/Application.mjs), [`lib/app/ResizePlugin.mjs`](https://unpkg.com/pixi.js@8.22.0/lib/app/ResizePlugin.mjs))
  StrictMode creates exactly this case: the first effect's cleanup runs before its `init()` has resolved.
- `destroy(rendererDestroyOptions, options)`:
  - `rendererDestroyOptions`: `true` or `{ removeView: true }` removes the canvas from the DOM. `{ releaseGlobalResources: true }` also releases the global resource registry, as `AbstractRenderer.destroy` shows in source. Use it because we create and destroy apps repeatedly in dev.
  - `options`: `true` or `{ children, texture, textureSource, context }` destroys the stage tree.
  - After destroy, the instance is unusable. ([API: Application.destroy](https://pixijs.download/release/docs/app.Application.html), [`AbstractRenderer.mjs`](https://unpkg.com/pixi.js@8.22.0/lib/rendering/renderers/shared/system/AbstractRenderer.mjs))

Recommended mount (sketch):

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'
import { startGame } from '@/game/start' // plain TS; returns a stop() function

export default function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current!
    const app = new Application()
    let cancelled = false
    let stopGame: (() => void) | undefined

    const ready = app
      .init({
        resizeTo: window,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        background: '#000',
        antialias: false,
      })
      .then(() => {
        if (cancelled) return // StrictMode's first mount: already unmounted
        host.appendChild(app.canvas)
        stopGame = startGame(app)
      })

    return () => {
      cancelled = true
      // Never destroy before init has settled: destroy() throws on a half-initialised app.
      ready.finally(() => {
        stopGame?.()
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true })
      })
    }
  }, [])

  return <div ref={hostRef} style={{ position: 'fixed', inset: 0 }} />
}
```

Plus `html, body { margin: 0; height: 100%; overflow: hidden }` in `globals.css`, so the canvas never causes scrollbars. Not yet tested in this repo. Verify the double-mount in dev when the first slice ticket lands.

### 1.3 Resizing to the viewport

`ResizePlugin` is installed by default. With `resizeTo: window`, it listens to `window` `resize`, debounces to one `requestAnimationFrame`, then calls `renderer.resize(innerWidth, innerHeight)` and renders. Its `destroy` removes the listener. Nothing else is needed for full-screen. ([`ResizePlugin.mjs`](https://unpkg.com/pixi.js@8.22.0/lib/app/ResizePlugin.mjs), [API: `resizeTo`, `queueResize`](https://pixijs.download/release/docs/app.Application.html))

Caveat: even when `resizeTo` is an `HTMLElement`, the plugin only listens to **window** resize, not a `ResizeObserver`. That's fine for full-screen. If we ever size the canvas to a container that changes on its own, call `app.queueResize()` from our own `ResizeObserver`.

Game code should read `app.screen` for logical size. It should re-center the camera on resize via `app.renderer.on('resize', ...)`.

### 1.4 Next 16 specific: `cacheComponents` and Activity

`next.config.ts` has `cacheComponents: true`. With that on, navigating away from a route **does not unmount it**: Next hides it with React `<Activity mode="hidden">`. Effects are **cleaned up when hidden and recreated when visible again**, while React state is preserved. (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`, section "Navigation with Activity"; `01-app/02-guides/preserving-ui-state.md`)

Consequence: if the game ever shares the app with other routes (menu, options), leaving the game route destroys the Pixi app through our effect cleanup, and returning re-inits it. So the cleanup pattern above is required in production too, not only for StrictMode. Any game state that should survive must live outside the Pixi scene, in a module-level store. For the Vertical Slice with a single route, this is moot. Note it as a constraint for later.

### 1.5 `@pixi/react` vs plain `useEffect`: don't adopt

- `@pixi/react@8.0.5` (latest, 2025-12-01). Peer deps are `pixi.js ^8.2.6` and `react >=19.0.0`, but it **pins `react-reconciler@0.31.0`**, which is the React 19.0 reconciler. ([npm registry](https://registry.npmjs.org/@pixi/react))
- Open issue [#630 "Update to React 19.2"](https://github.com/pixijs/pixi-react/issues/630): it breaks with React 19.2 features. Maintainer, Nov 2025: "Unclear on the timeline for 19.2". Activity support is "a current topic of research". We are on **React 19.3**, with Activity active via `cacheComponents`.
- Open issue [#613 "Crash with combination of webgl and React.StrictMode"](https://github.com/pixijs/pixi-react/issues/613): crashes when the app unmounts and remounts. A fix PR (#652) was still open as of Aug 2026. See also [#602](https://github.com/pixijs/pixi-react/issues/602).
- Last commit on `main`: 2026-01-04 ([repo](https://github.com/pixijs/pixi-react)).
- It solves a problem we don't have. A hack-and-slash scene is hundreds of entities that change every frame. Those belong in an imperative game loop, not in React reconciliation. The React side of our app is just one `<div>` plus, later, a DOM HUD.

Verdict: plain `useEffect` mount. Revisit `@pixi/react` only if it ships official React 19.2+/Activity support **and** we want declarative Pixi UI, which we don't plan to.

## 2. Helper libraries

### 2.1 Isometric tilemap rendering: hand-roll; `@pixi/tilemap` optional for the floor

- **`@pixi/tilemap@5.0.2`** (2025-07-14). It is the v8 line (peer `pixi.js >=8.5.0`) and an official pixijs repo, but quiet: last push 2025-07-14, 51 open issues. It renders **rectangular** tilemaps only, with no isometric support mentioned. `CompositeTilemap.tile(texture, x, y)` places tiles at arbitrary pixel positions, so diamond floor tiles at projected iso positions would work. The limit is 16k tiles per tilemap without 32-bit indices. ([repo](https://github.com/pixijs/tilemap), [npm](https://registry.npmjs.org/@pixi/tilemap))
- The real problem in Diablo-style iso is **depth sorting walls and props against moving actors**. A batched tilemap is one draw object, so it can't interleave with actors. It only helps the flat floor layer.
- Pixi v8 gives us what we need without plugins:
  - Sprites batch automatically across up to 16 textures. Spritesheets are the recommended way to keep the texture count low. ([Performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips))
  - `zIndex` plus `sortableChildren` handles depth. `RenderLayer` handles things like health bars or name plates that must draw above the world but stay attached to their entity. ([Render Layers guide](https://pixijs.com/8.x/guides/concepts/render-layers))
  - Culling is off by default and is opt-in per object. It helps when GPU-bound and hurts when CPU-bound. ([Performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips))

Recommendation: write it ourselves.

- Projection: `screenX = (gx - gy) * tileW/2`, `screenY = (gx + gy) * tileH/2`, plus its inverse for click-picking.
- Layers:
  - **Floor:** one Container of Sprites. Swap it for `@pixi/tilemap` only if profiling says so.
  - **Objects:** walls, props and actors in one Container with `sortableChildren`, `zIndex = gx + gy` with a sub-tile offset.
  - **Overlay:** a `RenderLayer`.
- At Vertical Slice map sizes, plain sprites with culling of off-screen tiles will be fine.

### 2.2 A* pathfinding: hand-roll

| Library | Latest | Activity | Notes |
| --- | --- | --- | --- |
| `pathfinding` (PathFinding.js) | 0.4.18, **published 2016-05-10** | last push 2024-06, 106 open issues | Synchronous, many algorithms, grid-only, no TS types bundled. ([npm](https://registry.npmjs.org/pathfinding), [repo](https://github.com/qiao/PathFinding.js)) |
| `easystarjs` | 0.4.4, **published 2020-10-18** | last push 2024-01, 36 open issues | Async, callback-based, iterations per `calculate()` call; tile costs, diagonals. ([npm](https://registry.npmjs.org/easystarjs), [repo](https://github.com/prettymuchbryce/easystarjs)) |

Neither depends on Pixi, so "v8 compatibility" isn't a concern for either. Both are effectively unmaintained.

What we need is narrow:

- 8-direction movement on the logical grid, with no diagonal corner-cutting past walls
- synchronous calls (a click needs a path this frame)
- a dynamic "blocked" predicate (monsters, doors)
- later, a cap on search radius

A typed A* with a binary heap and an octile heuristic is about 100 lines. It is easy to unit-test and has no adapter layer. Recommendation: write it ourselves. Easystar's tick-sliced model and PathFinding.js's grid-cloning per search both fight a per-click, per-monster synchronous API.

### 2.3 Tiled map loading: small hand-rolled TMJ reader

- **`pixi-tiledmap@2.11.0`** (2026-09-25, peer `pixi.js >=8.10.0`). Actively maintained (last push 2026-10-20) but small, from a single maintainer ("riebel", 122 stars). It reads TMJ and TMX, external tilesets and templates, and supports **isometric** and staggered orientations. Zstd-compressed tile data isn't supported. It loads as a Pixi `Assets` extension and returns a ready `container`. ([repo](https://github.com/riebel/pixi-tiledmap), [npm](https://registry.npmjs.org/pixi-tiledmap))
- Other options: `pixi-tiled-loader@1.3.1` (2024-12, peer `pixi.js ^8`) and `@fablevision/pixi-tiled@3.0.0` (2026-02). Both are less established, and I didn't evaluate them in depth.
- The catch: a library that renders the map hands back *its* container hierarchy, which conflicts with the depth-sorted object layer in 2.1. We only need data from Tiled: the tile layer GIDs, one object layer for spawns, exits and collision, and tileset image references. That is a plain JSON file. The format is documented in the [Tiled JSON map format reference](https://doc.mapeditor.org/en/stable/reference/json-map-format/). `Assets.load('map.tmj')` (or `fetch`) plus about 100 lines of typed parsing covers it.

Recommendation: write a TMJ reader ourselves, limited to orientation `isometric`, uncompressed CSV or base64 tile data, and embedded tilesets. Pick up `pixi-tiledmap` as a parser reference, or adopt it, only if map authoring grows into many Tiled features.

**Open question for the map:** do we author maps in Tiled at all for the slice? Hand-written arrays or simple procedural generation would skip this dependency entirely.

### 2.4 Input: no library

Pixi v8 federated events: set `app.stage.eventMode = 'static'` and `app.stage.hitArea = app.screen`, then listen for `pointerdown` and `pointermove` (or `globalpointermove`) for hold-to-move. Convert to grid coordinates with the inverse iso projection. Pixi doesn't handle keyboard input, so use `window` `keydown`/`keyup` listeners that are added and removed in the same `startGame`/`stop` lifecycle. ([Events guide](https://pixijs.com/8.x/guides/components/events))

### 2.5 Other packages checked

- `pixi-viewport@6.0.3` (peer `pixi.js >=8`, 2024-11): works with v8, but it is a pan, pinch and zoom viewport. A follow-camera is a few lines. Skip.
- `@pixi/devtools@2.0.1` (peer `^7 || ^8`): an optional dev-only inspector. Fine to add later.
- `@pixi-essentials/cull@2.0.0`: peer `@pixi/display ^7`, so **v7 only**. Don't use.

## Sources

- Next 16 docs (local, `node_modules/next/dist/docs/`):
  - `01-app/02-guides/single-page-applications.md`
  - `01-app/02-guides/lazy-loading.md`
  - `01-app/02-guides/static-exports.md`
  - `01-app/02-guides/preserving-ui-state.md`
  - `01-app/03-api-reference/05-config/01-next-config-js/reactStrictMode.md`
  - `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`
- PixiJS:
  - [Application guide](https://pixijs.com/8.x/guides/components/application)
  - [Application API](https://pixijs.download/release/docs/app.Application.html)
  - [Render Layers](https://pixijs.com/8.x/guides/concepts/render-layers)
  - [Performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
  - [Events](https://pixijs.com/8.x/guides/components/events)
  - Source on unpkg: [Application.mjs](https://unpkg.com/pixi.js@8.22.0/lib/app/Application.mjs), [ResizePlugin.mjs](https://unpkg.com/pixi.js@8.22.0/lib/app/ResizePlugin.mjs), [AbstractRenderer.mjs](https://unpkg.com/pixi.js@8.22.0/lib/rendering/renderers/shared/system/AbstractRenderer.mjs)
- [pixijs/pixi-react](https://github.com/pixijs/pixi-react), issues [#630](https://github.com/pixijs/pixi-react/issues/630), [#613](https://github.com/pixijs/pixi-react/issues/613), [#602](https://github.com/pixijs/pixi-react/issues/602)
- [pixijs/tilemap](https://github.com/pixijs/tilemap), [riebel/pixi-tiledmap](https://github.com/riebel/pixi-tiledmap), [qiao/PathFinding.js](https://github.com/qiao/PathFinding.js), [prettymuchbryce/easystarjs](https://github.com/prettymuchbryce/easystarjs)
- Version and publish dates: the npm registry (`https://registry.npmjs.org/<pkg>`). Repo activity: the GitHub REST API, both queried 2026-10-25.
- [Tiled JSON map format](https://doc.mapeditor.org/en/stable/reference/json-map-format/)
