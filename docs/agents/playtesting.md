# Playtesting

How to see the game running, for acceptance criteria that only show on screen (HUD, effects, menus).

## Run a dev server

- **One already running?** `next dev` refuses a second server from the same folder and prints the running one's URL (usually http://localhost:3000). Use that one; it serves whatever is checked out in that folder.
- **In a worktree:** a worktree has no `node_modules`, and Turbopack won't follow a symlink to one outside the project. Clone the main checkout's instead (APFS, about 3 s), then pick a free port:

  ```sh
  cp -cR <main checkout>/node_modules node_modules
  npx next dev -p 3124
  ```

## Skip the grind

The Save lives in `localStorage` under `wiablo.save` as JSON. Write one and reload to start at any Level; `parseSave` in `src/game/save.ts` lists the fields and the checks a Save must pass (points raised plus unspent equal 5 × (Level − 1); Skill Levels plus unspent Skill Points equal Level − 1; Items on the grid, not overlapping, and in slots of their kind). For example, a Level 3 Hero with 10 unspent points and 2 unspent Skill Points:

```js
localStorage.setItem("wiablo.save", JSON.stringify({
  version: 5, level: 3, experience: 2000,
  strength: 20, dexterity: 20, vitality: 20, energy: 20, attributePoints: 10,
  // Skills are the keys of `skillTuning` in src/game/tuning/skills.ts.
  skillPoints: 2, skillLevels: { golem: 0 },
  // Item types are the keys of `itemTuning` in src/game/tuning/items.ts.
  inventory: [{ type: "axe", cell: { column: 0, row: 0 } }],
  equipment: { weapon: "shortSword" },
}));
location.reload();
```

A Save at 450 Experience levels up on the next Skeleton kill. **New Hero** in the Esc menu, or `localStorage.removeItem("wiablo.save")`, puts things back. A Save written on a port belongs to that port only.
