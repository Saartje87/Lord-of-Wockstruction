import { describe, expect, it } from "vitest";
import type { Area } from "../sim/area";
import { type Viewport, viewportOf } from "../viewport";
import {
  MAP_OVERLAY,
  type MapInputs,
  mapAreaNameLayout,
  mapOffset,
  mapOverlayScale,
  mapMarks as marksOf,
} from "./mapMarks";

/**
 * An Area drawn row by row: `.` floor, `#` a wall on floor, and a space void.
 * Only the shape matters to the maps.
 */
function areaOf(rows: string[]): Area {
  const cells = [...rows.join("")];
  return {
    width: rows[0].length,
    height: rows.length,
    floor: cells.map((cell) => cell !== " "),
    walkable: cells.map((cell) => cell === "."),
    exits: [],
    npcs: [],
  } as unknown as Area;
}

/** Every tile of `area` Explored. */
function all(area: Area): boolean[] {
  return area.floor.map(() => true);
}

const HERO = { x: 1.5, y: 1.5 };

const NAMES = { town: "Town", catacombs: "Catacombs" };

/** The marks of an Area with nothing but its shape, unless said otherwise. */
function mapMarks(
  of: Pick<MapInputs, "area" | "explored" | "heroAt"> & Partial<MapInputs>,
) {
  return marksOf({
    minions: [],
    townPortal: null,
    displayNames: NAMES,
    ...of,
  });
}

describe("mapMarks", () => {
  it("draws a wall line on each side of a floor tile that meets a wall", () => {
    const area = areaOf(["###", "#.#", "###"]);

    const { edges } = mapMarks({ area, explored: all(area), heroAt: HERO });

    expect(edges).toHaveLength(4);
    expect(edges.every((edge) => edge.kind === "wall")).toBe(true);
    expect(edges).toContainEqual({
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      kind: "wall",
    });
  });

  it("draws a floor line where floor meets void", () => {
    const area = areaOf(["   ", " . ", "   "]);

    const { edges } = mapMarks({ area, explored: all(area), heroAt: HERO });

    expect(edges).toHaveLength(4);
    expect(edges.every((edge) => edge.kind === "floor")).toBe(true);
  });

  it("draws the edge of the Area as a floor line", () => {
    const area = areaOf(["."]);

    const { edges } = mapMarks({
      area,
      explored: all(area),
      heroAt: { x: 0.5, y: 0.5 },
    });

    expect(edges).toHaveLength(4);
    expect(edges.every((edge) => edge.kind === "floor")).toBe(true);
  });

  it("draws no line between two floor tiles", () => {
    const area = areaOf(["..", "  "]);

    const { edges } = mapMarks({ area, explored: all(area), heroAt: HERO });

    // Each tile's three outer sides, none on the side they share.
    expect(edges).toHaveLength(6);
    expect(edges).not.toContainEqual(
      expect.objectContaining({ from: { x: 1, y: 0 }, to: { x: 1, y: 1 } }),
    );
  });

  it("draws no line round a wall with nothing walkable beside it", () => {
    const area = areaOf(["###", "###"]);

    expect(mapMarks({ area, explored: all(area), heroAt: HERO }).edges).toEqual(
      [],
    );
  });

  it("draws only the lines of Explored tiles", () => {
    const area = areaOf(["..", "  "]);

    const { edges } = mapMarks({
      area,
      explored: [true, false, false, false],
      heroAt: HERO,
    });

    // The left tile's three outer sides; the right tile, unseen, has none.
    expect(edges).toHaveLength(3);
    expect(edges.every((edge) => edge.to.x <= 1 && edge.from.x <= 1)).toBe(
      true,
    );
  });
});

describe("mapMarks of what stands on the Area", () => {
  const area = {
    ...areaOf(["....", "...."]),
    exits: [
      { area: "catacombs", entry: "up", x: 2, y: 0, width: 2, height: 1 },
    ],
    npcs: [{ name: "Smith", pos: { x: 0.5, y: 1.5 } }],
    waypoint: { x: 3.5, y: 1.5 },
  } as Area;

  it("marks each Minion where it stands", () => {
    const { minions } = mapMarks({
      area,
      explored: all(area),
      heroAt: HERO,
      minions: [
        { x: 0.5, y: 0.5 },
        { x: 1.25, y: 1.75 },
      ],
    });

    expect(minions).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 1.25, y: 1.75 },
    ]);
  });

  it("marks an Exit at its middle, named after the Area it leads to", () => {
    const { exits } = mapMarks({ area, explored: all(area), heroAt: HERO });

    expect(exits).toEqual([{ at: { x: 3, y: 0.5 }, name: "Catacombs" }]);
  });

  it("marks the Town Portal where it stands", () => {
    const { townPortal } = mapMarks({
      area,
      explored: all(area),
      heroAt: HERO,
      townPortal: { x: 1.5, y: 0.5 },
    });

    expect(townPortal).toEqual({ x: 1.5, y: 0.5 });
  });

  it("marks no Town Portal when there is none here", () => {
    expect(
      mapMarks({ area, explored: all(area), heroAt: HERO }).townPortal,
    ).toBeNull();
  });

  it("marks the Waypoint where it stands, only once Explored", () => {
    const explored = area.floor.map(() => false);
    expect(mapMarks({ area, explored, heroAt: HERO }).waypoint).toBeNull();

    explored[7] = true; // the Waypoint's tile
    expect(mapMarks({ area, explored, heroAt: HERO }).waypoint).toEqual({
      x: 3.5,
      y: 1.5,
    });
  });

  it("marks no Waypoint in an Area without one", () => {
    const bare = { ...area, waypoint: null } as Area;
    expect(
      mapMarks({ area: bare, explored: all(bare), heroAt: HERO }).waypoint,
    ).toBeNull();
  });

  it("names each NPC where they stand", () => {
    const { npcs } = mapMarks({ area, explored: all(area), heroAt: HERO });

    expect(npcs).toEqual([{ at: { x: 0.5, y: 1.5 }, name: "Smith" }]);
  });

  it("marks an Exit, the Town Portal and an NPC only where Explored", () => {
    const explored = area.floor.map(() => false);
    const unseen = mapMarks({
      area,
      explored,
      heroAt: HERO,
      townPortal: { x: 1.5, y: 0.5 },
    });

    expect(unseen.exits).toEqual([]);
    expect(unseen.townPortal).toBeNull();
    expect(unseen.npcs).toEqual([]);

    explored[3] = true; // the Exit's middle tile
    explored[1] = true; // the Town Portal's tile
    explored[4] = true; // the NPC's tile
    const seen = mapMarks({
      area,
      explored,
      heroAt: HERO,
      townPortal: { x: 1.5, y: 0.5 },
    });

    expect(seen.exits).toHaveLength(1);
    expect(seen.townPortal).toEqual({ x: 1.5, y: 0.5 });
    expect(seen.npcs).toHaveLength(1);
  });

  it("has no marks for Monsters, Corpses, Ground Items or Projectiles", () => {
    const marks = mapMarks({ area, explored: all(area), heroAt: HERO });

    expect(Object.keys(marks).sort()).toEqual([
      "edges",
      "exits",
      "minions",
      "npcs",
      "townPortal",
      "waypoint",
    ]);
  });
});

describe("mapAreaNameLayout", () => {
  it("puts the name at the top right, at the UI Scale", () => {
    const screen = { width: 1000, height: 800, uiScale: 2 } as Viewport;

    const { at, size } = mapAreaNameLayout(screen);

    expect(at.x).toBeLessThan(1000);
    expect(at.x).toBeGreaterThan(900);
    expect(at.y).toBeLessThan(80);
    expect(size).toBe(2 * 24);
  });
});

describe("mapOffset", () => {
  it("puts the Hero at the centre", () => {
    expect(mapOffset(HERO, HERO, MAP_OVERLAY.scale)).toEqual({ x: 0, y: 0 });
  });

  it("draws at the World's isometric angle, at the map scale", () => {
    const east = mapOffset({ x: 2.5, y: 1.5 }, HERO, MAP_OVERLAY.scale);
    const south = mapOffset({ x: 1.5, y: 2.5 }, HERO, MAP_OVERLAY.scale);

    // One tile is 192 by 96 on the World: east goes down and right.
    expect(east.x).toBeCloseTo(96 * MAP_OVERLAY.scale);
    expect(east.y).toBeCloseTo(48 * MAP_OVERLAY.scale);
    expect(south.x).toBeCloseTo(-96 * MAP_OVERLAY.scale);
    expect(south.y).toBeCloseTo(48 * MAP_OVERLAY.scale);
  });
});

describe("mapOverlayScale", () => {
  it("takes the tile's share of the World at the World zoom", () => {
    const screen = viewportOf({ width: 1920, height: 1080 });

    expect(screen.worldZoom).toBe(1.5);
    expect(mapOverlayScale(screen)).toBe(MAP_OVERLAY.scale * 1.5);
  });
});
