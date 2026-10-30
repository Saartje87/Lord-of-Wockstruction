import { afterEach, describe, expect, it } from "vitest";
import type { World } from "../sim/world";
import { inputTuning } from "../tuning/input";
import { pickTarget } from "./target";
import { arenaWith } from "./testArena";

const east = { x: 1, y: 0 };
const idAt = (world: World, i: number) => world.monsters[i].id;

describe("picking the Target", () => {
  const original = { ...inputTuning };
  afterEach(() => Object.assign(inputTuning, original));

  it("picks a living Monster straight ahead within range", () => {
    const world = arenaWith([{ x: 13, y: 10 }]);

    expect(pickTarget(world, east)).toBe(idAt(world, 0));
  });

  it("picks a Bone Altar ahead when no Monster is, and a Monster before it", () => {
    const world = arenaWith([]);
    world.boneAltars.push({
      id: 900,
      pos: { x: 12.5, y: 10.5 },
      life: 5,
      raised: [],
      cooldown: 1,
    });
    expect(pickTarget(world, east)).toBe(900);

    const withMonster = arenaWith([{ x: 14, y: 10 }]);
    withMonster.boneAltars.push({ ...world.boneAltars[0] });
    expect(pickTarget(withMonster, east)).toBe(withMonster.monsters[0].id);
  });

  it("picks the nearest of the Monsters ahead", () => {
    const world = arenaWith([
      { x: 14, y: 10 },
      { x: 12, y: 10.5 },
      { x: 13, y: 9.5 },
    ]);

    expect(pickTarget(world, east)).toBe(idAt(world, 1));
  });

  it("picks none behind or to the side, outside the cone", () => {
    const world = arenaWith([
      { x: 8, y: 10 },
      { x: 10, y: 12 },
    ]);

    expect(pickTarget(world, east)).toBeNull();
  });

  it("picks one at the edge of the tuned 90° cone and none just past it", () => {
    const world = arenaWith([{ x: 12, y: 11.9 }]);
    expect(pickTarget(world, east)).toBe(idAt(world, 0));

    world.monsters[0].pos = { x: 12, y: 12.1 };
    expect(pickTarget(world, east)).toBeNull();
  });

  it("picks none out of range", () => {
    inputTuning.targetRange = 5;
    const world = arenaWith([{ x: 14.9, y: 10 }]);
    expect(pickTarget(world, east)).toBe(idAt(world, 0));

    world.monsters[0].pos = { x: 15.1, y: 10 };
    expect(pickTarget(world, east)).toBeNull();
  });

  it("passes over a dead Monster and a Corpse", () => {
    const world = arenaWith([
      { x: 12, y: 10 },
      { x: 15, y: 10 },
    ]);
    world.monsters[0].life = 0;
    world.corpses.push({
      id: 99,
      type: "skeleton",
      monsterLevel: 1,
      pos: { x: 11, y: 10 },
    });

    expect(pickTarget(world, east)).toBe(idAt(world, 1));
  });

  it("aims any way it is pointed", () => {
    const world = arenaWith([
      { x: 13, y: 10 },
      { x: 8, y: 8 },
    ]);

    expect(pickTarget(world, { x: -1, y: -1 })).toBe(idAt(world, 1));
  });

  describe("with no direction", () => {
    it("picks a Monster behind or to the side", () => {
      const behind = arenaWith([{ x: 8, y: 10 }]);
      expect(pickTarget(behind, null)).toBe(idAt(behind, 0));

      const beside = arenaWith([{ x: 10, y: 12 }]);
      expect(pickTarget(beside, null)).toBe(idAt(beside, 0));
    });

    it("picks the nearest of the Monsters around, whichever way each lies", () => {
      const world = arenaWith([
        { x: 14, y: 10 },
        { x: 10, y: 7 },
        { x: 8.5, y: 10 },
      ]);

      expect(pickTarget(world, null)).toBe(idAt(world, 2));
    });

    it("picks none out of range", () => {
      inputTuning.targetRange = 5;
      const world = arenaWith([{ x: 5.1, y: 10 }]);
      expect(pickTarget(world, null)).toBe(idAt(world, 0));

      world.monsters[0].pos = { x: 4.9, y: 9.9 };
      expect(pickTarget(world, null)).toBeNull();
    });

    it("passes over a dead Monster and a Corpse", () => {
      const world = arenaWith([
        { x: 9, y: 10 },
        { x: 10, y: 14 },
      ]);
      world.monsters[0].life = 0;
      world.corpses.push({
        id: 99,
        type: "skeleton",
        monsterLevel: 1,
        pos: { x: 10, y: 9 },
      });

      expect(pickTarget(world, null)).toBe(idAt(world, 1));
    });
  });

  it("picks none from an empty Area", () => {
    expect(pickTarget(arenaWith([]), east)).toBeNull();
    expect(pickTarget(arenaWith([]), null)).toBeNull();
  });
});
