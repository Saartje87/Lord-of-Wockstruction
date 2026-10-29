/**
 * Imports the KayKit models Wiablo uses from pinned commits of KayKit's
 * GitHub repos into committed files, so the build never needs the network:
 *
 * - `public/assets/models/characters/`: characters, cut down to the
 *   animations and weapons Wiablo uses.
 * - `public/assets/models/dungeon/`: Dungeon Remastered pieces, as they are.
 * - `CREDITS.md`: KayKit's section. Flare's stays as it is.
 *
 * Run it by hand with `npm run import:kaykit`. It keeps its checkouts in the
 * gitignored `.cache/`, and re-runs without fetching while the pins stay.
 *
 * The paid Mystery Monthly packs can't be fetched: they're read from the
 * gitignored `vendor/kaykit/`, unzipped as downloaded, and skipped when
 * they aren't there, keeping the committed models.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { writeSection } from "../credits-sections.mts";
import { checkout } from "../import-flare/git.mts";
import { importCharacter } from "./characters.mts";
import { importRiggedCharacter } from "./retarget.mts";

const ORG = "https://github.com/KayKit-Game-Assets";

/** KayKit's repos, each pinned to a commit of `main`. */
const PACKS = {
  adventurers: {
    name: "Adventurers 1.0",
    repo: "KayKit-Character-Pack-Adventures-1.0",
    commit: "672074b73ba276876a19e8816ecdc5241817ab47",
    root: "addons/kaykit_character_pack_adventures",
  },
  dungeon: {
    name: "Dungeon Remastered 1.0",
    repo: "KayKit-Dungeon-Remastered-1.0",
    commit: "b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07",
    root: "addons/kaykit_dungeon_remastered",
  },
};

/**
 * The Hero's clips of the Knight's 76 that Wiablo plays, and the nodes it
 * drops: the Knight carries every sword and shield, and Wiablo's Hero has
 * the 1-handed sword and the round shield.
 */
const KNIGHT = {
  file: "Knight",
  clips: [
    "Idle",
    "Running_A",
    "1H_Melee_Attack_Chop",
    "Spellcast_Shoot",
    "Hit_A",
    "Death_A",
  ],
  dropNodes: (name: string) =>
    /Shield|2H_Sword|Offhand/.test(name) && name !== "Round_Shield",
};

/** The Mystery Monthly packs, as their downloads unzip. */
const MYSTERY = {
  name: "Mystery Monthly Series 6",
  dir: "vendor/kaykit/KayKit_Mystery_Monthly_Series_6",
  url: "https://kaylousberg.itch.io/kaykit-series-6",
};

/**
 * The Golem: the Monstrosity, with `Rig_Large`'s clips and, since that rig
 * has no attack, the Knight's 2-handed chop retargeted onto it.
 */
const GOLEM = {
  file: "Monstrosity",
  path: "4 - October 2025 - Monstrosity/characters/Monstrosity.glb",
  rigClips: {
    "Animations/gltf/Rig_Large/Rig_Large_General.glb": [
      "Idle_A",
      "Hit_A",
      "Death_A",
    ],
    "Animations/gltf/Rig_Large/Rig_Large_MovementBasic.glb": [
      "Walking_A",
      "Running_A",
    ],
  },
  knightClips: ["2H_Melee_Attack_Chop"],
};

/** The Dungeon Remastered pieces the floor is made of. */
const FLOORS = [
  "floor_tile_large",
  "floor_tile_small_broken_A",
  "floor_dirt_large",
];

const out = {
  characters: "public/assets/models/characters",
  dungeon: "public/assets/models/dungeon",
};

const adventurers = PACKS.adventurers;
const dungeon = PACKS.dungeon;
const dirOf = (pack: { repo: string }) => `.cache/${pack.repo}`;
const knightPath = `${adventurers.root}/Characters/gltf/${KNIGHT.file}.glb`;
const floorPath = (piece: string) =>
  `${dungeon.root}/Assets/gltf/${piece}.gltf.glb`;

for (const pack of Object.values(PACKS)) {
  const wanted =
    pack === adventurers
      ? [knightPath, `${pack.root}/LICENSE.txt`]
      : [...FLOORS.map(floorPath), `${pack.root}/LICENSE.txt`];
  checkout(
    `${ORG}/${pack.repo}`,
    pack.commit,
    dirOf(pack),
    wanted.map((path) => `/${path}`),
  );
}

for (const dir of Object.values(out)) mkdirSync(dir, { recursive: true });

await importCharacter({
  from: `${dirOf(adventurers)}/${knightPath}`,
  to: `${out.characters}/${KNIGHT.file}.glb`,
  clips: KNIGHT.clips,
  dropNodes: KNIGHT.dropNodes,
});
if (existsSync(MYSTERY.dir)) {
  await importRiggedCharacter({
    from: `${MYSTERY.dir}/${GOLEM.path}`,
    to: `${out.characters}/${GOLEM.file}.glb`,
    clips: [
      ...Object.entries(GOLEM.rigClips).flatMap(([file, names]) =>
        names.map((name) => ({ from: `${MYSTERY.dir}/${file}`, name })),
      ),
      ...GOLEM.knightClips.map((name) => ({
        from: `${dirOf(adventurers)}/${knightPath}`,
        name,
      })),
    ],
  });
} else {
  console.log(`No ${MYSTERY.dir}: keeping the committed ${GOLEM.file}.glb`);
}
for (const piece of FLOORS) {
  copyFileSync(
    `${dirOf(dungeon)}/${floorPath(piece)}`,
    `${out.dungeon}/${piece}.glb`,
  );
}

const imported = [
  `| \`${knightPath}\` | the Hero, and the Golem's attack |`,
  `| ${MYSTERY.name}: \`${GOLEM.path.split("/").pop()}\` | the Golem |`,
  ...FLOORS.map((piece) => `| \`${floorPath(piece)}\` | the floor |`),
].join("\n");

writeSection(
  "CREDITS.md",
  "kaykit",
  `## Models

The 3D models in \`public/assets/models/\` are by Kay Lousberg,
[www.kaylousberg.com](https://www.kaylousberg.com) (KayKit), from
[${ORG.split("/").pop()}](${ORG}) on GitHub, under the
[Creative Commons Zero](https://creativecommons.org/publicdomain/zero/1.0/)
licence (CC0). Crediting him is not required, and we do.

${Object.values(PACKS)
  .map(
    (pack) =>
      `- ${pack.name}: [${pack.repo}](${ORG}/${pack.repo}) (commit \`${pack.commit.slice(0, 7)}\`)`,
  )
  .join("\n")}
- ${MYSTERY.name}: [itch.io](${MYSTERY.url}), paid and CC0

**Changes:** the Knight is cut down to the animations Wiablo uses and to
the 1-handed sword and the round shield. The Monstrosity gets the
\`Rig_Large\` animations Wiablo uses and the Knight's 2-handed chop,
retargeted onto its rig. Nothing is recoloured.

### Imported files

| KayKit file | Used for |
|---|---|
${imported}`,
);
console.log("Wrote KayKit's section of CREDITS.md");
