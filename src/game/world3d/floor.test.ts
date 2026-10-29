import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import { floorOf } from "./floor";

function piece() {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(4, 0.15, 4), new MeshBasicMaterial()));
  return group;
}

describe("the 3D World's floor", () => {
  it("has one instance on each floor cell of the Area", () => {
    const world = arenaWith([]);
    const area = world.areas[world.areaName];
    const cells = area.floor.filter(Boolean).length;

    const floor = floorOf(area, {
      plain: piece(),
      broken: piece(),
      dirt: piece(),
    });

    const instances = floor.children
      .filter((child): child is InstancedMesh => child instanceof InstancedMesh)
      .reduce((total, mesh) => total + mesh.count, 0);
    expect(instances).toBe(cells);
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

    const floor = floorOf(area, {
      plain: piece(),
      broken: piece(),
      dirt: piece(),
    });

    const meshes = floor.children as InstancedMesh[];
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBe(base.floor.filter(Boolean).length);
  });

  it("covers the Area the same way every time", () => {
    const world = arenaWith([]);
    const area = world.areas[world.areaName];
    const pieces = () => ({ plain: piece(), broken: piece(), dirt: piece() });

    const counts = (floor: Group) =>
      floor.children.map((child) => (child as InstancedMesh).count);

    expect(counts(floorOf(area, pieces()))).toEqual(
      counts(floorOf(area, pieces())),
    );
  });
});
