/**
 * Imports the Flare art Wiablo uses from a pinned flare-game commit into
 * committed files, so the build never needs the network or Flare:
 *
 * - `public/assets/characters/`: Hero and Monster atlases and spritesheets.
 * - `public/assets/projectiles/`: Projectile atlases and spritesheets.
 * - `public/assets/tilesets/`: tileset atlases and spritesheets.
 * - `content/tilesets/`: the same tilesets for Tiled.
 * - `CREDITS.md`: attribution for all of it.
 *
 * Run it by hand with `npm run import:flare`. It keeps its Flare checkout in
 * the gitignored `.cache/`, and re-runs without fetching while the pins stay.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import type { ProjectileKind } from "../../src/game/tuning/projectiles.ts";
import { sectionOf } from "../credits-sections.mts";
import { importCharacter } from "./characters.mts";
import { filterFileCredits, readFlareArtists } from "./credits.mts";
import { readHeroLayers } from "./flare.mts";
import { checkout } from "./git.mts";
import { importProjectile } from "./projectiles.mts";
import { importTileset } from "./tilesets.mts";

const FLARE = {
  url: "https://github.com/flareteam/flare-game",
  commit: "af6eee6d339ac98011864bfe89da837fe7769c28",
  dir: ".cache/flare-game",
};
/** The wiki holds Flare's per-file credits. */
const WIKI = {
  url: "https://github.com/flareteam/flare-game.wiki.git",
  commit: "61939e26d397b51c0c36da8cb861f89c8bf1d6db",
  dir: ".cache/flare-game.wiki",
};
const MOD = "mods/fantasycore";

/** The Hero's outfit: equipment slot → Flare item. */
const HERO_OUTFIT: Record<string, string> = {
  feet: "default_feet",
  legs: "default_legs",
  hands: "default_hands",
  chest: "leather_chest",
  head: "head_short",
  main: "longsword",
};

/**
 * The Monsters' Flare enemies, each one layer, with the animations each plays
 * besides every character's.
 */
const MONSTER_ANIMATIONS: Record<string, string[]> = {
  skeleton: [],
  zombie: [],
  // Drawing the bow, for the wind-up.
  skeleton_archer: ["shoot"],
};
const MONSTERS = Object.keys(MONSTER_ANIMATIONS);

/** The Projectiles' Flare powers: Projectile to its flying animation. */
const PROJECTILES: Record<ProjectileKind, string> = {
  arrow: "arrows",
  // A pale shard trailing bone dust.
  boneSpear: "icicle",
};

/** Inclusive ranges of id. */
type Ranges = [number, number][];
const inRanges = (ranges: Ranges) => (id: number) =>
  ranges.some(([from, to]) => id >= from && id <= to);

/**
 * Tiles that block movement, kept by hand. Seeded from how often each tile
 * sits on a blocked cell of Flare's own maps' collision layers, then checked
 * by eye. Reeds, the waypoint and stairs stay walkable; stairs can be Exits.
 */
const BLOCKS: Record<"grassland" | "dungeon", Ranges> = {
  grassland: [
    [48, 77],
    [96, 111],
    [128, 173],
    [176, 191],
    [208, 216],
    [218, 231],
    [240, 255],
    [297, 300], // chests
  ],
  dungeon: [
    [48, 50],
    [64, 83],
    [88, 111],
    [114, 115],
    [118, 137],
    [144, 151],
    [160, 167],
    [192, 205],
    [208, 223], // walls with doors
    [240, 245],
    [280, 285],
    [288, 291], // chests
  ],
};

/** What we import from Flare, for the sparse checkout and the credits. */
const IMPORTED = {
  hero: Object.values(HERO_OUTFIT).map(
    (item) => `${MOD}/images/avatar/male/${item}.png`,
  ),
  ...Object.fromEntries(
    MONSTERS.map((name) => [name, [`${MOD}/images/enemies/${name}.png`]]),
  ),
  ...Object.fromEntries(
    Object.entries(PROJECTILES).map(([name, power]) => [
      name,
      [`${MOD}/images/powers/${power}.png`],
    ]),
  ),
  grassland: [
    `${MOD}/images/tilesets/tileset_grassland.png`,
    `${MOD}/images/tilesets/tileset_grassland_water.png`,
  ],
  dungeon: [`${MOD}/images/tilesets/tileset_dungeon.png`],
};

/** The imported images, rooted, as git and the credits write paths. */
const IMPORTED_PATHS = Object.values(IMPORTED)
  .flat()
  .map((p) => `/${p}`);

/** Where each import's sources sit, to find its entries in the credits. */
const CREDIT_PATHS = [
  ...IMPORTED_PATHS,
  "/art_src/characters/hero/",
  ...MONSTERS.map((name) => `/art_src/characters/${name}/`),
  "/art_src/tilesets/grassland/",
  "/art_src/tilesets/dungeon/",
];

const out = {
  characters: "public/assets/characters",
  projectiles: "public/assets/projectiles",
  tilesets: "public/assets/tilesets",
  tiled: "content/tilesets",
};

checkout(FLARE.url, FLARE.commit, FLARE.dir, [
  "/CREDITS.txt",
  `/${MOD}/engine/hero_layers.txt`,
  ...Object.values(HERO_OUTFIT).map(
    (item) => `/${MOD}/animations/avatar/male/${item}.txt`,
  ),
  ...MONSTERS.map((name) => `/${MOD}/animations/enemies/${name}.txt`),
  ...Object.values(PROJECTILES).map(
    (power) => `/${MOD}/animations/powers/${power}.txt`,
  ),
  `/${MOD}/tilesetdefs/tileset_grassland.txt`,
  `/${MOD}/tilesetdefs/tileset_dungeon.txt`,
  ...IMPORTED_PATHS,
]);
checkout(WIKI.url, WIKI.commit, WIKI.dir, ["/Credits.md"]);

for (const dir of Object.values(out)) mkdirSync(dir, { recursive: true });
const modDir = `${FLARE.dir}/${MOD}`;

importCharacter({
  name: "hero",
  modDir,
  layers: Object.entries(HERO_OUTFIT).map(([slot, item]) => ({
    slot,
    animations: `animations/avatar/male/${item}.txt`,
  })),
  drawOrder: readHeroLayers(`${modDir}/engine/hero_layers.txt`),
  outDir: out.characters,
});
for (const name of MONSTERS) {
  importCharacter({
    name,
    modDir,
    layers: [{ slot: "body", animations: `animations/enemies/${name}.txt` }],
    extraAnimations: MONSTER_ANIMATIONS[name],
    outDir: out.characters,
  });
}
for (const [name, power] of Object.entries(PROJECTILES)) {
  importProjectile({
    name,
    modDir,
    animations: `animations/powers/${power}.txt`,
    outDir: out.projectiles,
  });
}

for (const name of ["grassland", "dungeon"] as const) {
  importTileset({
    name,
    modDir,
    definition: `tilesetdefs/tileset_${name}.txt`,
    blocks: inRanges(BLOCKS[name]),
    publicDir: out.tilesets,
    tiledDir: out.tiled,
  });
}

const fileList = Object.entries(IMPORTED)
  .flatMap(([use, paths]) => paths.map((p) => `| \`${p}\` | ${use} |`))
  .join("\n");

// KayKit's section is import:kaykit's. Rewriting the file whole keeps it.
const kaykit = sectionOf(
  existsSync("CREDITS.md") ? readFileSync("CREDITS.md", "utf8") : "",
  "kaykit",
);
writeFileSync(
  "CREDITS.md",
  `# Credits

<!-- Generated by \`npm run import:flare\` (scripts/import-flare). Don't edit by hand. -->

## Art

The art in \`public/assets/\` and \`content/tilesets/\` comes from
[Flare: Empyrean Campaign](${FLARE.url}) (commit \`${FLARE.commit.slice(0, 7)}\`),
by Clint Bellanger and contributors.

It is licensed under the
[Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
licence (CC-BY-SA 3.0), and so are our versions of it.

**Changes:** the Hero's equipment layers are composited into one outfit;
the character sheets are cut down to the animations Wiablo uses and
repacked; the Projectile sheets are cut down to one direction, which Wiablo
rotates; the tilesets are cut into one padded image per tile for Tiled.
Nothing is recoloured.

### Imported files

| Flare file | Used for |
|---|---|
${fileList}

### Flare's artists

${readFlareArtists(`${FLARE.dir}/CREDITS.txt`)
  .map((a) => `- ${a}`)
  .join("\n")}

### Per-file attribution

From Flare's [Credits](${FLARE.url}/wiki/Credits) page (wiki commit \`${WIKI.commit.slice(0, 7)}\`),
filtered to the files above and their sources.

${filterFileCredits(`${WIKI.dir}/Credits.md`, CREDIT_PATHS)}
`,
);
if (kaykit) appendFileSync("CREDITS.md", `\n${kaykit}\n`);
console.log("Wrote CREDITS.md");
