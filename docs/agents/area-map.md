# Area maps

For tickets that place or move Monster spawns, Unique Monsters, Entries, Exits, NPCs, Waypoints or Bone Altars, and when reviewing them, look at the Area first:

```sh
npm run area:map spa
```

It prints the Area as the sim loads it from `content/areas/<area>.tmj`, one character a tile, with column numbers along the top (read downwards: `2` over `3` is column 23) and row numbers down the side. The legend after the grid names every character used and lists each marker with its tile `(x, y)`. Exits also list where they lead.

- **Terrain**: blank is void, `.` walkable floor, `~` Water, `#` a blocking Wall (the fence round Bruckle's yard in the Spa), `%` a blocking Prop (trees, rocks), `!` floor blocked with no piece on it (an invisible wall from the `blocking override` layer).
- **Markers**: `B` Act Boss, `U` Unique Monster, `N` NPC, `W` Waypoint, `P` Town Portal, `A` Bone Altar, a lower-case letter per Monster type for spawns (`s` Skeleton, `w` Wockwolf…), `@` Entry, `>` Exit. When two share a tile, the one listed first wins.

Use it to check that a spawn stands on walkable floor the Hero can reach from an Entry, not behind a fence or Water. Paste the rows you checked into the ticket comment so reviewers can see the layout. Changes to `.tmj` files show the next time you run it.

An unknown Area name exits non-zero and lists the names. The grid comes from `areaMap` in `src/game/sim/areaMap.ts`.
