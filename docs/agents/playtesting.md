# Playtesting

How to see the game running, for acceptance criteria that only show on screen (HUD, effects, menus).

## Run a dev server

- **One already running?** `next dev` refuses a second server from the same folder and prints the running one's URL (usually http://localhost:3000). Use that one; it serves whatever is checked out in that folder.
- **In a worktree:** a worktree has no `node_modules`, and Turbopack won't follow a symlink to one outside the project. Clone the main checkout's instead (APFS, about 3 s), then pick a free port:

  ```sh
  cp -cR <main checkout>/node_modules node_modules
  npx next dev -p 3124
  ```

## Alongside other agents

Parallel agents share one Chrome and often one machine.

- **Port**: `31NN`, from your ticket number (T174 → 3174). It also keeps your Save apart, since a Save belongs to its port.
- **Tab**: open your own with `tabs_create_mcp`, and close only that tab when done.
- **Main checkout**: someone else may have uncommitted work there. Merge and playtest in your own worktree, and stage files by name.

## Skip the grind

The Save lives in `localStorage` under `wockstruction.save` as JSON. Write one and reload to start at any Level; `parseSave` in `src/game/save.ts` lists the fields and the checks a Save must pass (points raised plus unspent equal 5 × (Level − 1); Skill Levels plus unspent Skill Points equal Level − 1; Items on the grid, not overlapping, and in slots of their kind). For example, a Level 3 Hero with 10 unspent points and 2 unspent Skill Points:

```js
localStorage.setItem("wockstruction.save", JSON.stringify({
  version: 7, level: 3, experience: 2000,
  strength: 20, dexterity: 20, vitality: 20, energy: 20, attributePoints: 10,
  // Skills are the keys of `skillTuning` in src/game/tuning/skills.ts.
  skillPoints: 2, skillLevels: { golem: 0 },
  // Only learned Skills, each in at most one slot.
  skillBar: { right: null, key1: null, key2: null, key3: null, key4: null },
  // Item types are the keys of `itemTuning` in src/game/tuning/items.ts.
  inventory: [{ type: "axe", cell: { column: 0, row: 0 } }],
  equipment: { weapon: "shortSword" },
  // Belt Columns, one Potion each without a Belt equipped.
  belt: [["lifePotion"], ["lifePotion"], ["lifePotion"], ["lifePotion"]],
}));
location.reload();
```

A Save at 450 Experience levels up on the next Skeleton kill. For fights, use Level 30 or more with Vitality raised: Monster Level comes from the Combat Area, not the Hero, so a Level 1 to 10 Hero dies to the first Skeleton group while you take screenshots. **New Hero** on the Start Screen (Esc, then Quit to Start Screen), or `localStorage.removeItem("wockstruction.save")`, puts things back. A Save written on a port belongs to that port only.

### Start in an Area

In dev builds, `?area=<Area>&entry=<Entry>` starts at that Entry instead of in Town, with the Area's Monsters fresh: http://localhost:3000/?area=catacombs&entry=from-town. Areas are the `.tmj` files in `content/areas/`, and Entries their `entry` objects (`start`, `from-town`, …). An unknown Area or Entry starts in Town. Production builds ignore the query. It applies on every load, so drop it to go back to Town.

### The 3D World

The World is always drawn in 3D (three.js), with the HUD, panels, Mini Map and Map Overlay drawn over it by Pixi on the same canvas. There is nothing to switch on: the models load before the first frame.

In dev builds and Vercel previews, `?stats` (alone or beside `?area=…`) shows fps, ms per frame, draw calls and triangles at the top left. Use it for any performance criterion, on the device the ticket names.

## Read the game state

Screenshots are JPEGs, and walls, the low-Life tint or Monsters standing on each other can hide what a criterion asks about. In dev builds, `window.__wockstruction.state()` returns what the game holds right now, as plain data (`DevState` in `src/game/devState.ts`). Call it from `javascript_exec`, before and after an action:

```js
window.__wockstruction.state();
// {
//   area: "catacombs",
//   hero: {
//     pos: { x: 12.4, y: 30.1 }, facing: 0.79, life: 182, maxLife: 220,
//     mana: 34, maxMana: 95, boneWard: { left: 30, full: 45 }, experience: 2310,
//   },
//   exploredTiles: 212,
//   target: 41,
//   monsters: [{ id: 41, type: "skeleton", pos: { x: 14.2, y: 30.6 }, life: 9 }, …],
//   corpses: [{ id: 38, type: "zombie", monsterLevel: 4, pos: { x: 11.8, y: 28.3 } }, …],
//   minions: [{ id: 2, type: "golem", skill: "golem", pos: { x: 11.6, y: 30.4 }, life: 150, maxLife: 180 }, …],
// }
```

- **`target`** is the Monster id of the Target that controller or touch auto-aim picked, the one shown highlighted, or `null` (also while paused). A Monster under the mouse pointer is highlighted too, but it isn't the Target.
- **`exploredTiles`** is how many tiles of the active Area are Explored (all of Town from the start). It grows as the Hero walks, so compare it before and after.
- **`boneWard`** is what's left of the Bone Ward and its full amount, or `null` while the Hero has none.
- **`corpses`** are the Corpses in the active Area, each with the id, type and Monster Level of the Monster it was and its `pos`. Those left behind through a Town Portal don't show until the Hero is back. A Corpse-using Skill fails without one near its cast point, as it does without the Mana for its cost (`mana`).
- **`minions`** are the Hero's living Minions, oldest first, with the `skill` that brought each one.
- **`facing`** is in radians in tile space, `atan2(dy, dx)`: 0 is +x, π/2 is +y.
- **Each call is a fresh copy.** Changing it changes nothing in the game, so call again after each step you take.

Production builds don't have `window.__wockstruction`.

## Touch screen

Chrome stands in for a phone: touch controls read `PointerEvent`s with `pointerType: "touch"` on the canvas (`src/game/input/touch.ts`), so dispatched events drive them.

```js
const canvas = document.querySelector("canvas");
// Dispatched events here report offsetX as clientX / devicePixelRatio, so
// scale CSS px up. Check once: log e.offsetX from a pointerdown listener.
const touch = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
  pointerId: id, pointerType: "touch", isPrimary: true, bubbles: true,
  clientX: x * devicePixelRatio, clientY: y * devicePixelRatio,
}));
```

- **The first touch** switches the HUD to touch controls; take a screenshot then to read the stick and button positions in CSS px.
- **The stick**: `pointerdown` in the stick zone, `pointermove` by up to the stick's reach (about 60 px) in the walk direction, `pointerup` to let go.
- **Buttons**: `pointerdown` on the button holds it until `pointerup`.
- **Run timed sequences in one `javascript_exec`** (await a timeout between events), then screenshot. A tool round trip lasts seconds, and Monsters keep hitting meanwhile.
- **A `setPointerCapture` error in the dev overlay** comes from dispatched touches outside the controls, which have no real pointer. It is no game bug.
- **From Town to Monsters**: start there with `?area=catacombs&entry=from-town` (see Start in an Area). The nearest Skeletons (3) are about 23 tiles east of the Catacombs' `from-town` Entry.

## Deploys

`main` deploys to https://lord-of-wockstruction.vercel.app through Vercel's GitHub integration. When something works locally but not there, check the deploy before the code: `gh api repos/Saartje87/Lord-of-Wockstruction/commits/<sha>/status` on `main`'s tip. No `Vercel` context means production never deployed; the user redeploys from the Vercel dashboard.
