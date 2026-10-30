import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import { floorOf, GRASS_FLOOR } from "./floor";

function piece(width = 4) {
  const group = new Group();
  group.add(
    new Mesh(new BoxGeometry(width, 0.15, width), new MeshBasicMaterial()),
  );
  return group;
}

/** The dungeon pieces an Area without named floor pieces is mixed from. */
const dungeon = () => ({
  "dungeon/floor_tile_large": piece(),
  "dungeon/floor_tile_small_broken_A": piece(2),
  "dungeon/floor_dirt_large": piece(),
});

describe("the 3D World's floor", () => {
  it("has one instance on each floor cell of the Area", () => {
    const world = arenaWith([]);
    const area = world.areas[world.areaName];
    const cells = area.floor.filter(Boolean).length;

    const floor = floorOf(area, dungeon());

    const instances = floor.children
      .filter((child): child is InstancedMesh => child instanceof InstancedMesh)
      .reduce((total, mesh) => total + mesh.count, 0);
    expect(instances).toBe(cells);
  });

  it("has no floor under Water, which is drawn as its own plane", () => {
    const world = arenaWith([]);
    const base = world.areas[world.areaName];
    const water = base.water.map((_, i) => i < 3);
    const area = { ...base, water };

    const floor = floorOf(area, dungeon());

    const instances = floor.children.reduce(
      (total, mesh) => total + (mesh as InstancedMesh).count,
      0,
    );
    expect(instances).toBe(base.floor.filter(Boolean).length - 3);
  });

  it("also has floor under each Wall, so no gap shows beside it", () => {
    const world = arenaWith([]);
    const base = world.areas[world.areaName];
    const wall = { x: 3, y: 4, piece: "dungeon/wall", blocks: true };
    const floor = base.floor.map((hasFloor, i) =>
      i === wall.y * base.width + wall.x ? false : hasFloor,
    );
    const area = { ...base, floor, walls: [wall] };

    const group = floorOf(area, dungeon());

    const instances = group.children.reduce(
      (total, mesh) => total + (mesh as InstancedMesh).count,
      0,
    );
    expect(instances).toBe(base.floor.filter(Boolean).length);
  });

  it("uses the pieces a KayKit Area names", () => {
    const world = arenaWith([]);
    const base = world.areas[world.areaName];
    const area = {
      ...base,
      floorPieces: base.floor.map((hasFloor) =>
        hasFloor ? "dungeon/floor_dirt_large" : null,
      ),
    };

    const pieces = dungeon();
    const dirt = pieces["dungeon/floor_dirt_large"];
    const floor = floorOf(area, pieces);

    // The floor comes in blocks; all of them are the dirt piece.
    const meshes = floor.children as InstancedMesh[];
    const dirtGeometry = (dirt.children[0] as Mesh).geometry;
    expect(meshes.every((mesh) => mesh.geometry === dirtGeometry)).toBe(true);
    expect(meshes.reduce((total, mesh) => total + mesh.count, 0)).toBe(
      base.floor.filter(Boolean).length,
    );
  });

  it("covers the Area the same way every time", () => {
    const world = arenaWith([]);
    const area = world.areas[world.areaName];
    const pieces = dungeon;

    const counts = (floor: Group) =>
      floor.children.map((child) => (child as InstancedMesh).count);

    expect(counts(floorOf(area, pieces()))).toEqual(
      counts(floorOf(area, pieces())),
    );
  });

  it("lays Town's Halloween pieces, each fitted to one tile", () => {
    const world = arenaWith([]);
    const base = world.areas[world.areaName];
    const area = {
      ...base,
      floorPieces: base.floor.map((hasFloor, i) =>
        hasFloor ? (i % 2 ? "halloween/floor_dirt" : "halloween/path_A") : null,
      ),
    };
    const pieces = {
      ...dungeon(),
      "halloween/floor_dirt": piece(),
      // A path piece is a little under 2 across, so it scales up by more.
      "halloween/path_A": piece(1.9),
    };

    const floor = floorOf(area, pieces);

    const scaleOfMesh = (mesh: InstancedMesh) => {
      const matrix = new Matrix4();
      mesh.getMatrixAt(0, matrix);
      return new Vector3().setFromMatrixScale(matrix).x;
    };
    const meshes = floor.children as InstancedMesh[];
    const path = meshes.find(
      (mesh) =>
        mesh.geometry ===
        (pieces["halloween/path_A"].children[0] as Mesh).geometry,
    );
    const dirt = meshes.find(
      (mesh) =>
        mesh.geometry ===
        (pieces["halloween/floor_dirt"].children[0] as Mesh).geometry,
    );
    if (!path || !dirt) throw new Error("a Halloween piece wasn't laid");
    expect(scaleOfMesh(path) * 1.9).toBeCloseTo(1);
    expect(scaleOfMesh(dirt) * 4).toBeCloseTo(1);
  });

  it("lays the grass, whose 2-unit piece is fitted to one tile like the others", () => {
    const world = arenaWith([]);
    const base = world.areas[world.areaName];
    const area = {
      ...base,
      floorPieces: base.floor.map((hasFloor) =>
        hasFloor ? "city/park_base" : null,
      ),
    };
    const pieces = { ...dungeon(), "city/park_base": piece(2) };

    const floor = floorOf(area, pieces);

    const meshes = floor.children as InstancedMesh[];
    expect(meshes.length).toBeGreaterThan(0);
    const matrix = new Matrix4();
    for (const mesh of meshes) {
      expect(mesh.geometry).toBe(
        (pieces["city/park_base"].children[0] as Mesh).geometry,
      );
      mesh.getMatrixAt(0, matrix);
      expect(new Vector3().setFromMatrixScale(matrix).x * 2).toBeCloseTo(1);
    }
  });

  it("loads the grass with the other floor pieces", () => {
    expect(GRASS_FLOOR).toEqual(["city/park_base"]);
  });

  it("skips a named piece that isn't loaded rather than failing", () => {
    const world = arenaWith([]);
    const base = world.areas[world.areaName];
    const area = {
      ...base,
      floorPieces: base.floor.map((hasFloor) =>
        hasFloor ? "halloween/path_Z" : null,
      ),
    };

    expect(() => floorOf(area, dungeon())).not.toThrow();
  });
});
