import { describe, expect, it } from "vitest";
import { devStateOf } from "./devState";
import { arenaWith } from "./input/testArena";
import { newMinion } from "./sim/minions";
import { QUEST_IDS } from "./sim/quests";
import { maxMana } from "./sim/world";

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
        mana: world.hero.mana,
        maxMana: maxMana(world),
        boneWard: null,
        experience: 120,
      },
      exploredTiles: expect.any(Number),
      target: skeleton.id,
      itemInReach: null,
      groundItems: [],
      inventory: expect.any(Array),
      monsters: [
        {
          id: skeleton.id,
          type: "skeleton",
          pos: { x: 13, y: 10 },
          life: skeleton.life,
          unique: null,
        },
      ],
      corpses: [],
      minions: [],
      quests: world.hero.progress.quests,
    });
  });

  it("reads a Unique Monster's name and each Quest's progress", () => {
    const world = arenaWith([{ x: 13, y: 10 }], { combat: true });
    world.monsters[0].unique = "Bruckle";
    const [quest] = QUEST_IDS;
    world.hero.progress.quests[quest] = { state: "ready", count: 0 };

    const state = devStateOf(world, null);

    expect(state.monsters[0].unique).toBe("Bruckle");
    expect(state.quests[quest]).toEqual({ state: "ready", count: 0 });
    state.quests[quest].state = "done";
    expect(world.hero.progress.quests[quest].state).toBe("ready");
  });

  it("reads the Hero's Mana and Bone Ward", () => {
    const world = arenaWith([]);
    world.hero.mana = 7;
    world.hero.boneWard = { left: 15, full: 20 };

    const { hero } = devStateOf(world, null);

    expect(hero.mana).toBe(7);
    expect(hero.maxMana).toBe(maxMana(world));
    expect(hero.boneWard).toEqual({ left: 15, full: 20 });
  });

  it("reads the Corpses and the Minions", () => {
    const world = arenaWith([], { combat: true });
    world.corpses.push({
      id: 4,
      type: "zombie",
      monsterLevel: 3,
      pos: { x: 12, y: 11 },
    });
    const golem = newMinion(1, "golem", "golem", 2, { x: 9, y: 10 }, 0);
    golem.life = 5;
    world.minions.push(golem);

    const state = devStateOf(world, null);

    expect(state.corpses).toEqual([
      { id: 4, type: "zombie", monsterLevel: 3, pos: { x: 12, y: 11 } },
    ]);
    expect(state.minions).toEqual([
      {
        id: 1,
        type: "golem",
        skill: "golem",
        pos: { x: 9, y: 10 },
        life: 5,
        maxLife: golem.maxLife,
      },
    ]);
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

  it("reads the Ground Items, the Item in Reach and the Inventory", () => {
    const world = arenaWith([]);
    world.groundItems.push({
      item: { id: 7, type: "axe", rarity: "magic", affixes: [] },
      pos: { x: 10.5, y: 10 },
    });
    world.hero.inventory = [
      {
        item: { id: 8, type: "ring", rarity: "normal", affixes: [] },
        cell: { column: 2, row: 1 },
      },
    ];

    const state = devStateOf(world, null, 7);

    expect(state.itemInReach).toBe(7);
    expect(state.groundItems).toEqual([
      { id: 7, type: "axe", rarity: "magic", pos: { x: 10.5, y: 10 } },
    ]);
    expect(state.inventory).toEqual([
      { id: 8, type: "ring", rarity: "normal", cell: { column: 2, row: 1 } },
    ]);
  });

  it("has no Item in Reach once that Item is no longer lying there", () => {
    expect(devStateOf(arenaWith([]), null, 7).itemInReach).toBeNull();
  });

  it("changes nothing in the World when changed", () => {
    const world = arenaWith([{ x: 13, y: 10 }]);
    world.hero.mana = 7;
    world.hero.boneWard = { left: 15, full: 20 };
    world.corpses.push({
      id: 4,
      type: "zombie",
      monsterLevel: 3,
      pos: { x: 12, y: 11 },
    });
    world.minions.push(newMinion(1, "golem", "golem", 1, { x: 9, y: 10 }, 0));
    const state = devStateOf(world, null);

    state.hero.pos.x = 0;
    state.hero.mana = -1;
    if (state.hero.boneWard) state.hero.boneWard.left = 0;
    state.corpses[0].pos.x = 0;
    state.minions[0].pos.x = 0;
    state.minions[0].life = 0;
    state.hero.life = 0;
    state.monsters[0].pos.x = 0;
    state.monsters[0].life = 0;

    expect(world.hero.pos.x).toBe(10);
    expect(world.hero.life).toBeGreaterThan(0);
    expect(world.monsters[0].pos.x).toBe(13);
    expect(world.monsters[0].life).toBeGreaterThan(0);
    expect(world.hero.mana).toBe(7);
    expect(world.hero.boneWard?.left).toBe(15);
    expect(world.corpses[0].pos.x).toBe(12);
    expect(world.minions[0].pos.x).toBe(9);
    expect(world.minions[0].life).toBeGreaterThan(0);
  });
});
