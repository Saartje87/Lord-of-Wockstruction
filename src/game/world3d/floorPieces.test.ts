import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import type { Area } from "../sim/area";
import { floorPiecesOf } from "./floorPieces";
import { LOOKS, type Look, toonShade } from "./toon";

const PIECES = [
  "halloween/floor_dirt",
  "halloween/path_A",
  "dungeon/floor_dirt_large",
  "city/park_base",
];

function scenes() {
  return Object.fromEntries(
    PIECES.map((name) => {
      const group = new Group();
      group.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
      return [name, group];
    }),
  );
}

/** The key of the shader a piece is drawn with: equal for equal looks. */
function shaderOf(piece: Group): string {
  const mesh = piece.children[0] as Mesh;
  return (
    mesh.material as { customProgramCacheKey(): string }
  ).customProgramCacheKey();
}

/** The key a piece gets when it is shaded in `look`. */
function shaderIn(look: Look): string {
  const reference = scenes()[PIECES[0]];
  toonShade(reference, look);
  return shaderOf(reference);
}

function areaWith(outdoors: boolean): Area {
  const world = arenaWith([]);
  return { ...world.areas[world.areaName], outdoors };
}

describe("the floor pieces each Area is drawn with", () => {
  const forArea = floorPiecesOf(scenes());
  const look = (outdoors: boolean, piece: string) =>
    shaderOf(forArea(areaWith(outdoors))[piece] as Group);

  it("gives Wockville's dirt and paths the dusk look", () => {
    expect(look(false, "halloween/floor_dirt")).toBe(shaderIn(LOOKS.dusk));
    expect(look(false, "halloween/path_A")).toBe(shaderIn(LOOKS.dusk));
  });

  it("gives outdoor dirt daylight dirt, with no evening blue", () => {
    expect(look(true, "halloween/floor_dirt")).toBe(
      shaderIn(LOOKS.daylightDirt),
    );
  });

  it("keeps the Bog's mud and the grass as they were outdoors", () => {
    expect(look(true, "dungeon/floor_dirt_large")).toBe(shaderIn(LOOKS.mud));
    expect(look(true, "city/park_base")).toBe(shaderIn(LOOKS.grass));
    expect(look(false, "city/park_base")).toBe(shaderIn(LOOKS.grass));
  });

  it("keeps one Area's look from leaking into the other's", () => {
    const indoor = forArea(areaWith(false));
    const outdoor = forArea(areaWith(true));
    expect(indoor["halloween/floor_dirt"]).not.toBe(
      outdoor["halloween/floor_dirt"],
    );
    expect(Object.keys(outdoor).sort()).toEqual([...PIECES].sort());
  });
});
