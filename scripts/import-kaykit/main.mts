/**
 * Imports the KayKit models Wiablo uses from pinned commits of KayKit's
 * GitHub repos into committed files, so the build never needs the network:
 *
 * - `public/assets/models/characters/`: characters, cut down to the
 *   animations and weapons Wiablo uses.
 * - `public/assets/models/{dungeon,halloween,hexagon}/`: the pieces Areas are
 *   painted with (see `pieces.mts`), each as one glb.
 * - `content/tilesets/kaykit.tsj`: the Tiled tileset of those pieces. Its
 *   thumbnails come from `npm run thumbnails:kaykit`.
 * - `CREDITS.md`: KayKit's section. Flare's stays as it is.
 *
 * Run it by hand with `npm run import:kaykit`. It keeps its checkouts in the
 * gitignored `.cache/`, and re-runs without fetching while the pins stay.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { writeSection } from "../credits-sections.mts";
import { checkout } from "../import-flare/git.mts";
import { importCharacter } from "./characters.mts";
import { PIECES, type PieceSource, pieceName } from "./pieces.mts";
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

/** Dungeon Remastered glbs that, unlike the rest, don't end `.gltf.glb`. */
const PLAIN_GLB = new Set(["chest"]);

const out = {
  characters: "public/assets/models/characters",
  models: "public/assets/models",
  tilesets: "content/tilesets",
};

const adventurers = PACKS.adventurers;
const dirOf = (pack: { repo: string }) => `.cache/${pack.repo}`;
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
    pack === adventurers
      ? [knightPath, "LICENSE.txt"]
      : [
          ...PIECES.filter((piece) => PACKS[piece.pack] === pack).flatMap(
            filesOf,
          ),
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

await importCharacter({
  from: `${dirOf(adventurers)}/${knightPath}`,
  to: `${out.characters}/${KNIGHT.file}.glb`,
  clips: KNIGHT.clips,
  dropNodes: KNIGHT.dropNodes,
});
const io = new NodeIO();
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
writeFileSync(
  `${out.tilesets}/kaykit.tsj`,
  `${JSON.stringify(tilesetOf(PIECES), null, 1)}\n`,
);

const imported = [
  `| \`${knightPath}\` | the Hero |`,
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

**Changes:** the Knight is cut down to the animations Wiablo uses and to
the 1-handed sword and the round shield. Halloween Bits and Medieval Hexagon
pieces, which come as glTF with a binary and a texture, are packed into one
glb each. Nothing is recoloured.

### Imported files

| KayKit file | Used for |
|---|---|
${imported}`,
);
console.log("Wrote KayKit's section of CREDITS.md");
