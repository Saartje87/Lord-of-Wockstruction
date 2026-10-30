/**
 * Imports the KayKit models the game uses from pinned commits of KayKit's
 * GitHub repos into committed files, so the build never needs the network:
 *
 * - `public/assets/models/characters/`: characters, cut down to the
 *   animations and weapons the game uses.
 * - `public/assets/models/{dungeon,halloween,hexagon}/`: the pieces Areas are
 *   painted with (see `pieces.mts`), each as one glb.
 * - `content/tilesets/kaykit.tsj`: the Tiled tileset of those pieces. Its
 *   thumbnails come from `npm run thumbnails:kaykit`.
 * - `CREDITS.md`: KayKit's section.
 *
 * Run it by hand with `npm run import:kaykit`. It keeps its checkouts in the
 * gitignored `.cache/`, and re-runs without fetching while the pins stay.
 *
 * The paid Mystery Monthly packs can't be fetched: they're read from the
 * gitignored `vendor/kaykit/`, unzipped as downloaded, and skipped when
 * they aren't there, keeping the committed models.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { writeSection } from "../credits-sections.mts";
import { importCharacter, rotTexture } from "./characters.mts";
import { checkout } from "./git.mts";
import { PIECES, type PieceSource, pieceName } from "./pieces.mts";
import { importRiggedCharacter } from "./retarget.mts";
import { tilesetOf } from "./tileset.mts";

const ORG = "https://github.com/KayKit-Game-Assets";

/** KayKit's repos, each pinned to a commit of `main`. */
const PACKS = {
  adventurers: {
    name: "Adventurers 1.0",
    repo: "KayKit-Character-Pack-Adventures-1.0",
    commit: "672074b73ba276876a19e8816ecdc5241817ab47",
    root: "addons/kaykit_character_pack_adventures",
  },
  skeletons: {
    name: "Skeletons 1.0",
    repo: "KayKit-Character-Pack-Skeletons-1.0",
    commit: "15b62b9bad122f72926c10fb14d622c73819fa54",
    root: "addons/kaykit_character_pack_skeletons",
  },
  dungeon: {
    name: "Dungeon Remastered 1.0",
    repo: "KayKit-Dungeon-Remastered-1.0",
    commit: "b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07",
    root: "addons/kaykit_dungeon_remastered",
  },
  halloween: {
    name: "Halloween Bits 1.0",
    repo: "KayKit-Halloween-Bits-1.0",
    commit: "6dc69bf6b2fa766a985754f35ec6a0324090e6c6",
    root: "addons/kaykit_halloween_bits",
  },
  hexagon: {
    name: "Medieval Hexagon 1.0",
    repo: "KayKit-Medieval-Hexagon-Pack-1.0",
    commit: "84fa4e91af6a88989be7c99e0891cede11f2ca38",
    root: "addons/kaykit_medieval_hexagon_pack",
  },
};

/**
 * The Hero's clips of the Knight's 76 that the game plays, and the nodes it
 * drops: the Knight carries every sword and shield, and the game's Hero has
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

/**
 * The Monsters' clips of the Skeletons' 95, shared by all three: Skeletons
 * carry the Knight's rig. Weapons come as separate files that the 3D World
 * parents to the hand slots.
 */
const MONSTER_CLIPS = [
  "Idle",
  "Idle_Combat",
  "Walking_A",
  "Walking_D_Skeletons",
  "Running_C",
  "Hit_B",
  "1H_Melee_Attack_Chop",
  "2H_Ranged_Shoot",
  "Death_A",
];

/** The three Monsters' models, and the weapons they are given. */
const SKELETONS = {
  /** The model each Monster is drawn with, and the file it is written to. */
  models: [
    { from: "Skeleton_Warrior", to: "Skeleton" },
    { from: "Skeleton_Rogue", to: "SkeletonArcher" },
    { from: "Skeleton_Minion", to: "Zombie", repaint: true },
  ],
  /** Weapons, written as glbs beside the characters. */
  weapons: ["Skeleton_Blade", "Skeleton_Shield_Small_A", "Skeleton_Crossbow"],
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

/**
 * Town's NPCs: Series 6 characters on `Rig_Medium`, which has the free rig's
 * deform bones under the same names. They come with no clips; the idles come
 * from the pack's `Rig_Medium` files, and the retarget drops any track whose
 * joint the character lacks (the free rig's IK bones).
 */
const NPCS = {
  files: [
    "12 - June 2026 - Farmers/characters/Farmer_A",
    "12 - June 2026 - Farmers/characters/Farmer_B",
    "1 - July 2025 - Lorekeeper/characters/Lorekeeper",
    "3 - September 2025 - Cleric/characters/Cleric",
    "8 - February 2026 - Hoarder/characters/Hoarder",
  ],
  rigClips: {
    "Animations/gltf/Rig_Medium/Rig_Medium_General.glb": ["Idle_A", "Idle_B"],
  },
};

/**
 * Ground Items' models, written to `public/assets/models/loot/`: Adventurers
 * weapons and shields (glTF with a texture each), an arrow and Dungeon
 * Remastered's bottles. Item kinds without one get a stand-in drawn in code.
 */
const LOOT = {
  adventurers: [
    { model: "sword_1handed", texture: "knight_texture.png" },
    { model: "axe_1handed", texture: "barbarian_texture.png" },
    { model: "shield_round", texture: "knight_texture.png" },
    { model: "shield_spikes", texture: "barbarian_texture.png" },
    { model: "arrow", texture: "rogue_texture.png" },
  ],
  dungeon: ["bottle_A_brown", "bottle_B_green", "bottle_C_brown"],
};

/** Dungeon Remastered glbs that, unlike the rest, don't end `.gltf.glb`. */
const PLAIN_GLB = new Set(["chest"]);

/**
 * Dungeon Remastered pieces the 3D World places itself rather than Areas
 * painting them, so they are no tiles in the tileset: the Wall torches.
 */
const EXTRA_DUNGEON = ["torch_mounted"];

const out = {
  characters: "public/assets/models/characters",
  models: "public/assets/models",
  tilesets: "content/tilesets",
};

const io = new NodeIO();
const adventurers = PACKS.adventurers;
const dirOf = (pack: { repo: string }) => `.cache/${pack.repo}`;
const skeletons = PACKS.skeletons;
const skeletonDir = `${skeletons.root}/Characters/gltf`;
const weaponDir = `${skeletons.root}/Assets/gltf`;
const knightPath = `${adventurers.root}/Characters/gltf/${KNIGHT.file}.glb`;
/** The files of a piece in its pack: Dungeon's one glb, or glTF with its binary and texture. */
function filesOf(source: PieceSource): string[] {
  const dir = `${PACKS[source.pack].root}/Assets/gltf`;
  if (source.pack === "dungeon") {
    const plain = PLAIN_GLB.has(source.model);
    return [`${dir}/${source.model}${plain ? "" : ".gltf"}.glb`];
  }
  const folder =
    dir +
    (source.model.includes("/")
      ? `/${source.model.replace(/\/[^/]*$/, "")}`
      : "");
  const texture =
    source.pack === "halloween"
      ? "halloweenbits_texture.png"
      : "hexagons_medieval.png";
  return [
    `${dir}/${source.model}.gltf`,
    `${dir}/${source.model}.bin`,
    `${folder}/${texture}`,
  ];
}

for (const pack of Object.values(PACKS)) {
  const wanted =
    pack === skeletons
      ? [
          ...SKELETONS.models.map(({ from }) => `${skeletonDir}/${from}.glb`),
          ...SKELETONS.weapons.flatMap((name) => [
            `${weaponDir}/${name}.gltf`,
            `${weaponDir}/${name}.bin`,
          ]),
          `${weaponDir}/skeleton_texture.png`,
          "LICENSE.txt",
        ]
      : pack === adventurers
        ? [
            knightPath,
            ...LOOT.adventurers.flatMap(({ model, texture }) => [
              `${adventurers.root}/Assets/gltf/${model}.gltf`,
              `${adventurers.root}/Assets/gltf/${model}.bin`,
              `${adventurers.root}/Assets/gltf/${texture}`,
            ]),
            "LICENSE.txt",
          ]
        : [
            ...PIECES.filter((piece) => PACKS[piece.pack] === pack).flatMap(
              filesOf,
            ),
            ...(pack === PACKS.dungeon
              ? [...EXTRA_DUNGEON, ...LOOT.dungeon].map(
                  (name) => `${pack.root}/Assets/gltf/${name}.gltf.glb`,
                )
              : []),
            "LICENSE.txt",
          ];
  checkout(
    `${ORG}/${pack.repo}`,
    pack.commit,
    dirOf(pack),
    wanted.map((path) => `/${path}`),
  );
  // The public repo takes CC0 only: refuse a pack whose licence says otherwise.
  const licence = readFileSync(`${dirOf(pack)}/LICENSE.txt`, "utf8");
  if (!licence.includes("Creative Commons Zero")) {
    throw new Error(`${pack.name} is not CC0`);
  }
}

for (const dir of Object.values(out)) mkdirSync(dir, { recursive: true });
for (const pack of ["dungeon", "halloween", "hexagon"]) {
  mkdirSync(`${out.models}/${pack}`, { recursive: true });
}
mkdirSync(`${out.models}/loot`, { recursive: true });

await importCharacter({
  from: `${dirOf(adventurers)}/${knightPath}`,
  to: `${out.characters}/${KNIGHT.file}.glb`,
  clips: KNIGHT.clips,
  dropNodes: KNIGHT.dropNodes,
});
for (const { from, to, repaint } of SKELETONS.models) {
  const target = `${out.characters}/${to}.glb`;
  await importCharacter({
    from: `${dirOf(skeletons)}/${skeletonDir}/${from}.glb`,
    to: target,
    clips: MONSTER_CLIPS,
    dropNodes: () => false,
  });
  if (repaint) await rotTexture(target);
}
for (const name of SKELETONS.weapons) {
  await io.write(
    `${out.characters}/${name}.glb`,
    await io.read(`${dirOf(skeletons)}/${weaponDir}/${name}.gltf`),
  );
}
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
  for (const path of NPCS.files) {
    await importRiggedCharacter({
      from: `${MYSTERY.dir}/${path}.glb`,
      to: `${out.characters}/${path.split("/").pop()}.glb`,
      clips: Object.entries(NPCS.rigClips).flatMap(([file, names]) =>
        names.map((name) => ({ from: `${MYSTERY.dir}/${file}`, name })),
      ),
    });
  }
} else {
  console.log(`No ${MYSTERY.dir}: keeping the committed models of the pack`);
}
for (const source of PIECES) {
  const [from] = filesOf(source);
  const to = `${out.models}/${pieceName(source)}.glb`;
  if (source.pack === "dungeon") {
    copyFileSync(`${dirOf(PACKS.dungeon)}/${from}`, to);
  } else {
    // glTF with its binary and texture beside it becomes one glb.
    const pack = PACKS[source.pack];
    await io.write(to, await io.read(`${dirOf(pack)}/${from}`));
  }
}
for (const name of EXTRA_DUNGEON) {
  copyFileSync(
    `${dirOf(PACKS.dungeon)}/${PACKS.dungeon.root}/Assets/gltf/${name}.gltf.glb`,
    `${out.models}/dungeon/${name}.glb`,
  );
}
for (const { model } of LOOT.adventurers) {
  await io.write(
    `${out.models}/loot/${model}.glb`,
    await io.read(
      `${dirOf(adventurers)}/${adventurers.root}/Assets/gltf/${model}.gltf`,
    ),
  );
}
for (const name of LOOT.dungeon) {
  copyFileSync(
    `${dirOf(PACKS.dungeon)}/${PACKS.dungeon.root}/Assets/gltf/${name}.gltf.glb`,
    `${out.models}/loot/${name}.glb`,
  );
}
writeFileSync(
  `${out.tilesets}/kaykit.tsj`,
  `${JSON.stringify(tilesetOf(PIECES), null, 1)}\n`,
);

const imported = [
  `| \`${knightPath}\` | the Hero, and the Golem's attack |`,
  `| ${MYSTERY.name}: \`${GOLEM.path.split("/").pop()}\` | the Golem |`,
  ...NPCS.files.map(
    (path) =>
      `| ${MYSTERY.name}: \`${path.split("/").pop()}.glb\` | Town's NPCs |`,
  ),
  ...EXTRA_DUNGEON.map(
    (name) =>
      `| \`${PACKS.dungeon.root}/Assets/gltf/${name}.gltf.glb\` | Wall torches |`,
  ),
  ...LOOT.adventurers.map(
    ({ model }) =>
      `| \`${adventurers.root}/Assets/gltf/${model}.gltf\` | Ground Items and Arrows |`,
  ),
  ...LOOT.dungeon.map(
    (name) =>
      `| \`${PACKS.dungeon.root}/Assets/gltf/${name}.gltf.glb\` | Ground Items (Potions) |`,
  ),
  ...PIECES.map(
    (source) =>
      `| \`${filesOf(source)[0]}\` | ${source.kind === "floor" ? "floors" : source.kind === "wall" ? "Walls" : "Props"} |`,
  ),
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

**Changes:** the Knight is cut down to the animations the game uses and to
the 1-handed sword and the round shield. The Monstrosity gets the
\`Rig_Large\` animations the game uses and the Knight's 2-handed chop,
retargeted onto its rig. Town's NPCs get the \`Rig_Medium\` idles, with no
animation track for a bone they lack. Halloween Bits and Medieval Hexagon
pieces, which come as glTF with a binary and a texture, are packed into one
glb each. Nothing is recoloured.

### Imported files

| KayKit file | Used for |
|---|---|
${imported}`,
);
console.log("Wrote KayKit's section of CREDITS.md");
