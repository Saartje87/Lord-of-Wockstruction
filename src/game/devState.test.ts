import { describe, expect, it } from "vitest";
import { devStateOf } from "./devState";
import { arenaWith } from "./input/testArena";

describe("devStateOf", () => {
  it("reads the Area, the Hero, the Target and the Monsters", () => {
    const world = arenaWith([{ x: 13, y: 10 }], { combat: true });
    const [skeleton] = world.monsters;
    world.hero.facing = Math.PI;
    world.hero.progress.experience = 120;

    expect(devStateOf(world, skeleton.id)).toEqual({
      area: "arena",
      hero: {
        pos: { x: 10, y: 10 },
        facing: Math.PI,
        life: world.hero.life,
        maxLife: world.hero.life,
        experience: 120,
      },
      target: skeleton.id,
      monsters: [
        {
          id: skeleton.id,
          type: "skeleton",
          pos: { x: 13, y: 10 },
          life: skeleton.life,
        },
      ],
    });
  });

  it("has no Target when none is picked", () => {
    expect(devStateOf(arenaWith([]), null).target).toBeNull();
  });

  it("has no Target once that Monster is dead, as none is highlighted", () => {
    const world = arenaWith([{ x: 13, y: 10 }]);
    const [skeleton] = world.monsters;
    world.monsters = [];

    expect(devStateOf(world, skeleton.id).target).toBeNull();
  });

  it("changes nothing in the World when changed", () => {
    const world = arenaWith([{ x: 13, y: 10 }]);
    const state = devStateOf(world, null);

    state.hero.pos.x = 0;
    state.hero.life = 0;
    state.monsters[0].pos.x = 0;
    state.monsters[0].life = 0;

    expect(world.hero.pos.x).toBe(10);
    expect(world.hero.life).toBeGreaterThan(0);
    expect(world.monsters[0].pos.x).toBe(13);
    expect(world.monsters[0].life).toBeGreaterThan(0);
  });
});
