# Playtesting

How to see the game running, for acceptance criteria that only show on screen (HUD, effects, menus).

## Run a dev server

- **One already running?** `next dev` refuses a second server from the same folder and prints the running one's URL (usually http://localhost:3000). Use that one; it serves whatever is checked out in that folder.
- **In a worktree:** a worktree has no `node_modules`, and Turbopack won't follow a symlink to one outside the project. Clone the main checkout's instead (APFS, about 3 s; remove an empty `node_modules` dir a fresh worktree may have first, or `cp` copies into it), then pick a free port:

  ```sh
  cp -cR <main checkout>/node_modules node_modules
  npx next dev -p 3124
  ```

## Alongside other agents

Parallel agents share one Chrome and often one machine.

- **Port**: `31NN`, from your ticket number (T174 → 3174). It also keeps your Save apart, since a Save belongs to its port.
- **Tab**: open your own with `tabs_create_mcp`, and close only that tab when done.
- **Branch**: a new worktree may start on another agent's branch. Check `git log` and reset it onto your base branch before working.
- **`vendor/`**: the KayKit import (`scripts/import-kaykit/main.mts`) reads the gitignored `vendor/kaykit/` from the folder it runs in and skips what isn't there. In a worktree, clone the main checkout's like `node_modules`: `cp -cR <main checkout>/vendor vendor` (about 1 s).
- **Main checkout**: someone else may have uncommitted work there. Merge and playtest in your own worktree, and stage files by name.

## Skip the grind

In dev builds, `window.__wockstruction.loadSave(options)` builds a valid Save, writes it under `localStorage`'s `wockstruction.save` and reloads, so the game loads it through Continue. Everything you leave out is a New Hero's. For example:

```js
// Level 30, Vitality raised, some Gold.
window.__wockstruction.loadSave({ level: 30, vitality: 120, gold: 500 });
// A Magic Axe in the Inventory and a Heavy Belt holding more Potions.
window.__wockstruction.loadSave({
  inventory: [{ type: "axe", rarity: "magic", affixes: [{ kind: "brutality", grade: 1, value: 5 }] }],
  equipment: { belt: "heavyBelt" },
  belt: [["lifePotion", "manaPotion"], ["lifePotion"], [], []],
});
```

Options are `SaveOptions` in `src/game/devSave.ts`, which says what each means. Attributes are the values wanted, not points raised; an Item is a type name or a whole one; a Belt Column holds only as many Potions as the Equipped Belt allows. An Item that fits nowhere, is in a slot of another kind, or a Belt Column that is too full throws.

Unspent Attribute and Skill Points are worked out from the Level, what you asked for and what Done Quests paid. Asking for more than the Level allows throws, naming Attribute Points or Skill Points and by how much. The Skill Bar starts empty and the Smith's service follows the Quests.

A Save at 450 Experience levels up on the next Skeleton kill. For fights, use Level 30 or more with Vitality raised: Monster Level comes from the Combat Area, not the Hero, so a Level 1 to 10 Hero dies to the first Skeleton group while you take screenshots. **New Hero** on the Start Screen (Esc, then Quit to Start Screen), or `localStorage.removeItem("wockstruction.save")`, puts things back.

### Start in an Area

In dev builds, `?area=<Area>&entry=<Entry>` starts at that Entry instead of in Town, with the Area's Monsters fresh: http://localhost:3000/?area=catacombs&entry=start. Areas are the `.tmj` files in `content/areas/`, and Entries their `entry` objects (the Catacombs' are `start`, `from-wockyard` and `from-crypt`). An unknown Area or Entry starts in Town. Production builds ignore the query. It applies on every load, so drop it to go back to Town.

To start beside a fight, use the `fight` Entry, 3 to 4 tiles from a pack that notices the Hero on arrival. No Exit leads to it:

- `?area=catacombs&entry=fight`: the Catacombs' 7 Skeletons.
- `?area=old-mill&entry=fight`: Wockbrutes in the Old Mill.
- `?area=soggy-bog&entry=fight`: Bog Spitters in the Soggy Bog.
- `?area=ossuary&entry=fight`: Grave Wockington's room, about 6 tiles from him. Use a Level 11–12 Save; he notices the Hero on arrival.

### The 3D World

The World is always drawn in 3D (three.js), with the HUD, panels, Mini Map and Map Overlay drawn over it by Pixi on the same canvas. There is nothing to switch on: the models load before the first frame.

In dev builds and Vercel previews, `?stats` (alone or beside `?area=…`) shows fps, ms per frame, draw calls and triangles at the top left. Use it for any performance criterion, on the device the ticket names.

## Read the game state

Screenshots are JPEGs, and walls, the low-Life tint or Monsters standing on each other can hide what a criterion asks about. In dev builds, `window.__wockstruction.state()` returns what the game holds right now, as plain data (`DevState` in `src/game/devState.ts`). Call it from `javascript_tool`, before and after an action:

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
//   itemInReach: 12,
//   groundItems: [{ id: 12, type: "axe", rarity: "magic", pos: { x: 12.9, y: 30.4 } }, …],
//   inventory: [{ id: 3, type: "ring", rarity: "normal", cell: { column: 0, row: 0 } }, …],
//   monsters: [{ id: 41, type: "skeleton", pos: { x: 14.2, y: 30.6 }, life: 9 }, …],
//   corpses: [{ id: 38, type: "zombie", monsterLevel: 4, pos: { x: 11.8, y: 28.3 } }, …],
//   minions: [{ id: 2, type: "golem", skill: "golem", pos: { x: 11.6, y: 30.4 }, life: 150, maxLife: 180 }, …],
// }
```

- **`itemInReach`** is the Ground Item id that A or the attack button would pick up, the one whose label is outlined in gold, or `null`. Like its label, it is `null` with mouse and keyboard as the Active Input and while paused.
- **`groundItems`** and **`inventory`** are the Items lying in the active Area and in the Inventory. To put an Item on the ground, load a Save holding it, then drop it: open the Inventory, click the Item, then click the World below the panel.
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

The Compact Layout needs a short screen, and `resize_window` doesn't change the viewport: load the game in an 844×390 `<iframe>` of the same URL instead.

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
- **Run timed sequences in one `javascript_tool`** (await a timeout between events), then screenshot. A tool round trip lasts seconds, and Monsters keep hitting meanwhile.
- **A `setPointerCapture` error in the dev overlay** comes from dispatched touches outside the controls, which have no real pointer. It is no game bug.
- **From Town to Monsters**: start beside a pack with a `fight` Entry (see Start in an Area).

## Deploys

`main` deploys to https://lord-of-wockstruction.vercel.app through Vercel's GitHub integration. When something works locally but not there, check the deploy before the code: `gh api repos/Saartje87/Lord-of-Wockstruction/commits/<sha>/status` on `main`'s tip. No `Vercel` context means production never deployed; the user redeploys from the Vercel dashboard.

A failed Vercel preview reading "rate limited" is Vercel's rate limit, not the code. `gh pr checks <n>` shows it, while `gh pr view` shows only `UNSTABLE`. Production may hit the same limit after merging; the user redeploys from the Vercel dashboard once it resets.
