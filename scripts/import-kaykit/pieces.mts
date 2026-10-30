/**
 * The KayKit pieces Areas are painted with: one tile each in the KayKit
 * tileset (`content/tilesets/kaykit.tsj`), in this order. Only ever append,
 * as the tile ids are the order and the Areas refer to them.
 *
 * `model` is the file's path in the pack's `Assets/gltf/` without extension
 * (Dungeon Remastered's glbs end `.gltf.glb`, but not all of them). The
 * piece is `<pack>/<name>`: its model is `public/assets/models/<piece>.glb`.
 */
export type PieceSource = {
  pack: "dungeon" | "halloween" | "hexagon";
  model: string;
  /** What the tile is, in Tiled. */
  kind: "floor" | "wall" | "prop";
  /** Whether the Hero is stopped by it. */
  blocks: boolean;
};

const floor = (pack: PieceSource["pack"], model: string): PieceSource => ({
  pack,
  model,
  kind: "floor",
  blocks: false,
});
const wall = (pack: PieceSource["pack"], model: string): PieceSource => ({
  pack,
  model,
  kind: "wall",
  blocks: true,
});
const prop = (
  pack: PieceSource["pack"],
  model: string,
  blocks: boolean,
): PieceSource => ({ pack, model, kind: "prop", blocks });

/** A Medieval Hexagon building, which lives in a folder of its colour. */
const building = (kind: string, colour: string): PieceSource =>
  prop("hexagon", `buildings/${colour}/building_${kind}_${colour}`, true);

export const PIECES: PieceSource[] = [
  floor("dungeon", "floor_tile_large"),
  floor("dungeon", "floor_tile_small_broken_A"),
  floor("dungeon", "floor_dirt_large"),
  wall("dungeon", "wall"),
  prop("dungeon", "pillar", true),
  prop("dungeon", "column", true),
  prop("dungeon", "barrel_large", true),
  prop("dungeon", "crates_stacked", true),
  prop("dungeon", "chest", true),
  prop("dungeon", "candle_triple", false),
  prop("dungeon", "rubble_half", false),
  floor("halloween", "floor_dirt"),
  floor("halloween", "path_A"),
  floor("halloween", "path_B"),
  floor("halloween", "path_C"),
  floor("halloween", "path_D"),
  wall("halloween", "fence"),
  prop("halloween", "gravestone", true),
  prop("halloween", "grave_A", true),
  prop("halloween", "tree_dead_large", true),
  prop("halloween", "tree_dead_medium", true),
  prop("halloween", "crypt", true),
  prop("halloween", "shrine", true),
  prop("halloween", "lantern_standing", false),
  prop("halloween", "gravemarker_A", false),
  prop("halloween", "skull", false),
  prop("halloween", "bone_A", false),
  prop("halloween", "pumpkin_orange_small", false),
  building("home_A", "red"),
  building("home_B", "blue"),
  building("tavern", "red"),
  building("church", "blue"),
  building("well", "red"),
  building("blacksmith", "red"),
  // Joints for the dungeon Wall: the 3D World picks them where Walls meet.
  wall("dungeon", "wall_corner"),
  wall("dungeon", "wall_Tsplit"),
  wall("dungeon", "wall_crossing"),
  // The end of a dungeon Wall run.
  wall("dungeon", "wall_endcap"),
];

/** The piece's name: its pack and its model's file name. */
export function pieceName(source: PieceSource): string {
  return `${source.pack}/${source.model.replace(/^.*\//, "")}`;
}
