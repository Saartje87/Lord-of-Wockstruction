# Which free isometric art packs fit the Vertical Slice?

Ticket #76, a child of Epic #74 (Vertical Slice spec). Researched 2026-10-25.

**Question:** which free isometric asset packs can supply a **Town tileset**, a **Combat Area tileset**, a **Hero** and **one Monster type**, with walk and attack animations (ideally 8 directions), under licences that allow use in a hobby browser game? For each one: format, frame size, tile dimensions.

## TL;DR: recommendation

Take all four pieces from the **Flare** art family by Clint Bellanger and contributors. It is the only free source found that covers every slot in **one consistent, Diablo-like style**: pre-rendered 3D, a 2:1 isometric grid, 8 directions, and full combat animation sets.

| Slot | Pick | Licence | Notes |
|---|---|---|---|
| Town | Flare **Grassland** tileset (has cabins, houses, tents, fences, an anvil, a bonfire, paths) | CC-BY-SA 3.0 | Flare's own town "Black Oak City" is built from it |
| Combat Area | Flare **Dungeon** tileset (or the **Cave** tileset) | Dungeon: CC-BY-SA 3.0 (flare-game repo). Cave: CC-BY 3.0 (OGA) | Both are dark, interior and fit Diablo |
| Hero | Flare male/female **avatar** (layered: body, head, armour, weapon) | CC-BY 3.0 (OGA) / CC-BY-SA 3.0 (repo) | 8 directions: stance, run, swing, block, hit, die, cast, shoot |
| Monster | **Skeleton Warrior** (or **Zombie**) | CC-BY 3.0 (OGA) / CC-BY-SA 3.0 (repo) | 8 directions: walk 8 frames, attack 4 frames |

**Where to get them:** use the **flare-game GitHub repo** (`flareteam/flare-game`, `mods/fantasycore/`) as the single source. It holds the current, rescaled versions of all of the above on one consistent **192×96 tile grid**, with machine-readable frame definitions. The original OpenGameArt posts are mostly at the older **64×32** grid, and some ship only Blender sources.

**Licence consequence:** everything is attribution-required. The repo is CC-BY-SA 3.0 as a whole, so we need a **Credits screen/file**, and any art we *modify* stays CC-BY-SA. Our game code is not affected. For a non-commercial hobby game this is fine.

## Candidates in detail

### 1. Flare (flare-game repo): recommended

- **Source:** https://github.com/flareteam/flare-game. The README says: *"All of the art and data files for Flare: Empyrean Campaign are released under CC-BY-SA 3.0"* (later versions allowed). A root `CREDITS.txt` lists the contributors.
- **Covers:**
  - Tilesets (`mods/fantasycore/images/tilesets/`): `tileset_grassland.png` (229 tile defs), `tileset_dungeon.png`, `tileset_cave.png`, `tileset_snowplains*.png`. Defs are in `mods/fantasycore/tilesetdefs/*.txt`.
  - Hero (`images/avatar/male|female/`): layered equipment sheets (`default_chest`, `default_legs`, `head_short`, `leather_chest`, `longsword`, `buckler`, …). In-game, each layer is drawn on top of the others.
  - Monsters (`images/enemies/`): `skeleton`, `skeleton_archer`, `skeleton_mage`, `zombie`, `goblin`, `hobgoblin`, `antlion`, `minotaur`, `wyvern`, and others.
  - Maps (`mods/empyrean_campaign/maps/`) for reference. For example, `black_oak_city.txt` is a town map using `tileset_grassland`.
- **Format:**
  - **Tiles:** maps declare `tilewidth=192, tileheight=96, orientation=isometric` (2:1). Tiles are packed into one atlas PNG per tileset. Each `tile=id,x,y,w,h,offsetX,offsetY` line gives a tile's rect and anchor (dungeon floor tiles are 192×96 at offset 96,48, and walls are taller).
  - **Characters:** packed atlas PNGs plus `animations/.../*.txt`. Each `[section]` (`stance`, `run`, `swing`, `block`, `hit`, `die`, `cast`, `shoot`, and `critdie` for some monsters) has a `duration`, a `type` (`looped`, `play_once`, `back_forth`) and `frame=index,direction,x,y,w,h,offsetX,offsetY` lines. Directions are 0 to 7, so there are **8 directions**. Frames are trimmed to varying sizes (hero frames are about 60–100 × 100–125 px, skeleton frames about 110–320 × 80–230 px).
  - **Conversion:** this maps almost 1:1 onto a PixiJS `Spritesheet` JSON (`frame` = rect, `anchor` from offset/size, animations keyed `run_dir0..7`). A small one-off Node script can convert it.
- **Style:** pre-rendered Blender 3D with painterly textures, dark fantasy, a Diablo-like camera. All slots match, because one art director rendered them with one camera setup.
- **Caveats:**
  - CC-BY-SA, with many contributors (the Grassland set alone credits Clint Bellanger, Lamoot, Blender Foundation, lattice, p0ss, Bart K., Sindwiller and 16 OGA assets). Copy the relevant `CREDITS.txt` entries.
  - The hero is layered, not one baked sprite. Either stack 3–5 layer sprites in PixiJS (this also gives us visible equipment later, which suits Diablo) or pre-composite one outfit offline.
  - The Flare look is widely recognised from the open-source game, so for our "own identity" we may want to recolour/tint the art or limit what we use.

### 2. Flare art on OpenGameArt (original posts, by Clint Bellanger)

Same art family, older resolution, and some items have a looser licence (CC-BY, no ShareAlike):

| Asset | Link | Licence | Format |
|---|---|---|---|
| Grassland Tileset | https://opengameart.org/content/grassland-tileset | CC-BY-SA 3.0, credit all listed contributors (CREDITS.txt is in the blend zip) | 200+ tiles, **64×32** base grid, single `grassland_tiles.png` (1.3 MB) |
| Cave Tileset | https://opengameart.org/content/cave-tileset | **CC-BY 3.0** | `tileset_cave_1.png` and `tiled_cave_1.png`. Walls in 4 orientations, 16 floor tiles, minecarts, rubble, bones, water. Tile size not stated (Flare-era 64×32 grid, with 64×64 and 64×128 pieces according to comments) |
| Medieval Building Tiles | https://opengameart.org/content/medieval-building-tiles | GPL 2/3 or CC-BY-SA 3.0 | 60 tiles, 64×32 base, each 64×192 px. Possible town buildings |
| Dungeon Stairs | https://opengameart.org/content/dungeon-stairs | CC-BY 3.0 | 256×256 (up) and 256×128 (down), each covering 4×4 tiles of 64×32 |
| Isometric Hero and Heroine | https://opengameart.org/content/isometric-hero-and-heroine | **CC-BY 3.0** (also credit D. Sharon Pruitt for the leather texture) | 8 directions, 128×128 frames. Stance 4, Run 8, Melee 4, Block 2, Hit/Die 6, Cast 4, Bow 4 (32 frames per direction). Layered (body, head, armour, weapons, shields). The zips hold layer renders plus Blender sources, and you must montage them yourself |
| Skeleton Warrior | https://opengameart.org/content/skeleton-warrior-0 | **CC-BY 3.0**, credit Clint Bellanger | `skeleton_0.png` sheet, 8 directions, **128×128** frames. Stance 4, **Walk 8, Attack 4**, Cast 4, Block 2, Hit/Die 6, Crossbow 4 |
| Zombie Sprites | https://opengameart.org/content/zombie-sprites | **CC-BY 3.0**, credit "Clint Bellanger" | `zombie_0.png` sheet, a grid of 36 columns × 8 rows (directions), **128×128** frames. Stance 4, **Lurch 8, Slam 4**, Bite 4, Block 2, Hit/Die 6, Crit death 8 |
| Flare collection (index) | https://opengameart.org/content/flare | Mixed. Bellanger: *"Most Flare art is CC-BY-SA licensed"*. Check each item | Also lists goblin, minotaur, antlion, orc, werebear, spider and wyvern sheets |

**When to use this instead of the repo:** if we want to avoid ShareAlike for the characters (Hero, Skeleton and Zombie are plain CC-BY here), or if we want the 64×32 grid. Mixing 128×128 OGA characters with the 192×96 repo tiles would need rescaling, so pick one source per slice.

### 3. "Isometric Hero and Creatures" (Clint Bellanger, OGA): fallback, different style

- https://opengameart.org/content/isometric-hero-and-creatures, **CC-BY 3.0**.
- Contents: a hero in 3 armour tiers, with longsword, longbow, staff and shield overlays. Monsters: elemental, goblin, magician, ogre, skeleton, slime, werewolf, zombie.
- 8 directions, **256×256 frames** (designed to be shown at 128×128). **Walk is 4 frames. Attack, special, hit and dead are 1 frame each.** One `characters.zip` (1.8 MB).
- Style: low colour count, no anti-aliasing, and easy to recolour. That makes it a simpler, chunkier look than the main Flare art. It has many monsters, but the animation is too thin for satisfying hack-and-slash combat.

### 4. Kenney Isometric Miniature series (kenney.nl): no fit for characters

- https://kenney.nl/assets/isometric-miniature-dungeon (also https://kenney-assets.itch.io/isometric-dungeon-tiles), **CC0** (attribution optional). It has 72 tiles/objects (walls, floors, furniture, crates, barrels, stairs). **Each tile image is 256×512 px, tile width 256, base floor height 128** (2:1), and every tile is a separate PNG rendered at 30°×45°.
- The included character (`Characters/Male/Male_{dir}_{anim}{n}.png`, which we checked in the zip) has **8 directions, with Idle (1 frame), Run (10 frames) and Pickup (10 frames). There is no attack and no monster.** The Isometric Miniature Prototype pack has the same set for a "Human" character.
- Kenney's other isometric packs (Farm, Library, Prototype, Tiles City/Buildings/Landscape, Roads) are modern or cartoon themed. None is a fantasy town and none has monsters.
- Style: clean, bright, toy-like miniatures, which is the opposite of a Diablo mood and would clash with any dark Combat Area. Useful only as a CC0 placeholder for greybox work.

### 5. itch.io (searched, nothing better found)

The "8-direction" + "isometric" asset tags (https://itch.io/game-assets/tag-8-direction/tag-isometric) mostly contain small pixel-art bases. Examples are a CC0 32×48 walk-only cycle (ordinary-bumblebee) and a 32×32 base with attack whose licence is unclear (apyryon). There is no free, clearly licensed set that covers tiles, hero and monster in one style. Mixing these with any tileset above would look inconsistent. We did not explore them further.

## Style consistency

- **Flare repo (all slots):** consistent. One renderer, one camera, one grid (192×96).
- **Flare OGA posts:** consistent with each other at 64×32 tiles / 128×128 characters, and the same look as the repo at a lower resolution.
- **Hero and Creatures:** the same author, but a deliberately low-colour style. It clashes slightly with painterly Flare tiles.
- **Kenney:** consistent only with itself (toy-miniature). It does not mix with Flare.

## Gaps and risks

1. **Hero assembly:** the Flare hero is layered. The slice needs a paper-doll render (3–5 stacked sprites per frame, all sharing the frame index, direction and offset) or an offline composite.
2. **"Town" is a grassland village**, not a walled Diablo-style town square. Medieval Building Tiles (64×32 grid) could add stone buildings, but they are at a different resolution from the 192×96 repo set.
3. **Attribution and ShareAlike:** we need a credits file listing every contributor of the tiles/sprites we ship, plus a note that modified art is CC-BY-SA 3.0. (This is our reading of the licences, not legal advice.)
4. **Identity:** Flare is a known open-source ARPG, so using its art unchanged makes Wiablo look like Flare. Recolouring/tinting is allowed under CC-BY(-SA), and we could do it later.
5. **Frame data conversion:** Flare's `.txt` animation and tileset defs need a small converter to PixiJS Spritesheet JSON. The format is simple (rect + anchor offset per frame per direction).
6. **Asset size:** the repo atlases are large (the hero is many layer sheets at about 2k×2k). Load only the needed layers and one monster for the slice.

## Sources

- flare-game repo and README licence: https://github.com/flareteam/flare-game
- We read these files in that repo through the GitHub API: `mods/fantasycore/tilesetdefs/tileset_dungeon.txt`, `mods/fantasycore/animations/avatar/male/default_chest.txt`, `mods/fantasycore/animations/enemies/skeleton.txt`, `mods/empyrean_campaign/maps/black_oak_city.txt`, `mods/empyrean_campaign/maps/perdition_harbor.txt`, and the directory listings of `images/tilesets`, `images/avatar/male` and `images/enemies`
- https://opengameart.org/content/flare
- https://opengameart.org/content/grassland-tileset
- https://opengameart.org/content/cave-tileset
- https://opengameart.org/content/medieval-building-tiles
- https://opengameart.org/content/dungeon-stairs
- https://opengameart.org/content/isometric-hero-and-heroine
- https://opengameart.org/content/skeleton-warrior-0
- https://opengameart.org/content/zombie-sprites
- https://opengameart.org/content/isometric-hero-and-creatures
- https://opengameart.org/content/isometric-64x64-outside-tileset (Yar, CC-BY 3.0, 64×64 images on a 64×32 grid, outdoor pixel art; another style, not recommended)
- https://kenney.nl/assets/isometric-miniature-dungeon, https://opengameart.org/content/isometric-miniature-dungeon, https://kenney-assets.itch.io/isometric-dungeon-tiles, https://kenney.nl/assets/tag:isometric. We also inspected the zip contents of the Isometric Miniature Dungeon and Isometric Miniature Prototype packs; the zips were not committed.
- https://itch.io/game-assets/tag-8-direction/tag-isometric
