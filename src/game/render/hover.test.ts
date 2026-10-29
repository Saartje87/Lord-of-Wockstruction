import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import { combatArea } from "../sim/testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
  type Minion,
  type Monster,
  minionMaxLife,
} from "../sim/world";
import type { MonsterType } from "../tuning/monsters";
import { viewportOf } from "../viewport";
import { hoveredOf, nameplateLayout, nameplateOf } from "./hover";

/** A World in a Combat Area with one `monster`, to read nameplates from. */
function world(monster: MonsterType = "skeleton") {
  const map = {
    orientation: "orthogonal",
    width: 3,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [{ firstgid: 1, name: "test", tiles: [] }],
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 3,
        height: 1,
        data: [1, 1, 1],
      },
      {
        type: "tilelayer",
        name: "walls & props",
        width: 3,
        height: 1,
        data: [0, 0, 0],
      },
      {
        type: "objectgroup",
        name: "objects",
        objects: [
          { name: "start", type: "entry", point: true, x: 16, y: 16 },
          {
            name: "",
            type: "monsterSpawn",
            point: true,
            x: 80,
            y: 16,
            properties: [{ name: "monster", type: "string", value: monster }],
          },
        ],
      },
    ],
  };
  return createWorld({
    areas: { town: map, field: combatArea(map) },
    seed: 1,
    progress: FRESH_PROGRESS,
  });
}

const golem = (life: number): Minion => ({
  id: 1,
  type: "golem",
  skill: "golem",
  skillLevel: 1,
  pos: { x: 1, y: 1 },
  prevPos: { x: 1, y: 1 },
  life,
  facing: 0,
  state: "follow",
  target: null,
  attackSteps: 0,
  cooldown: 0,
  path: [],
  replan: 0,
  stuck: 0,
});

describe("the nameplate's layout", () => {
  it.each([
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1180, height: 820 },
  ])("is centred at the top at the UI Scale on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const { panel, bar, nameAt, nameSize } = nameplateLayout(viewport);

    // 220×46 px at native scale, its name 16 px.
    expect(panel.w).toBeCloseTo(220 * viewport.uiScale);
    expect(panel.h).toBeCloseTo(46 * viewport.uiScale);
    expect(nameSize).toBeCloseTo(16 * viewport.uiScale);
    expect(panel.x + panel.w / 2).toBeCloseTo(size.width / 2);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    // The name and Life bar inside the panel, the name over the bar.
    for (const rect of [bar, { ...nameAt, w: 0, h: nameSize }]) {
      expect(rect.x).toBeGreaterThanOrEqual(panel.x);
      expect(rect.x + rect.w).toBeLessThanOrEqual(panel.x + panel.w);
      expect(rect.y).toBeGreaterThanOrEqual(panel.y);
      expect(rect.y + rect.h).toBeLessThanOrEqual(panel.y + panel.h);
    }
    expect(nameAt.y + nameSize).toBeLessThanOrEqual(bar.y);
  });
});

describe("nameplateOf", () => {
  it("names a Monster with its Life bar's fill", () => {
    const [skeleton] = world().monsters;
    const hurt: Monster = { ...skeleton, life: skeleton.life / 2 };

    const plate = nameplateOf({ monster: hurt });

    expect(plate.name).toBe("Skeleton");
    expect(plate.fraction).toBe(0.5);
    expect(plate.friendly).toBe(false);
  });

  it("names a Zombie by its type", () => {
    const [zombie] = world("zombie").monsters;

    expect(nameplateOf({ monster: zombie }).name).toBe("Zombie");
  });

  it("names a Skeleton Archer by its type", () => {
    const [archer] = world("skeleton_archer").monsters;

    expect(nameplateOf({ monster: archer }).name).toBe("Skeleton Archer");
  });

  it("names the Golem, friendly, with its Life bar's fill", () => {
    const max = minionMaxLife({ type: "golem", skillLevel: 1 });

    const plate = nameplateOf({ minion: golem(max / 4) });

    expect(plate).toEqual({ name: "Golem", fraction: 0.25, friendly: true });
  });
});

describe("what is shown as hovered", () => {
  const two = () =>
    arenaWith([
      { x: 12, y: 10 },
      { x: 14, y: 10 },
    ]);

  it("shows the Target with the pointer over no one", () => {
    const world = two();
    const [, target] = world.monsters;

    expect(hoveredOf(world, null, target.id)).toEqual({ monster: target });
  });

  it("shows the Monster under the pointer over the Target", () => {
    const world = two();
    const [pointed, target] = world.monsters;

    expect(hoveredOf(world, pointed.id, target.id)).toEqual({
      monster: pointed,
    });
  });

  it("shows nothing for a Target that has since died", () => {
    const world = two();
    const [, target] = world.monsters;
    world.monsters.splice(1, 1);

    expect(hoveredOf(world, null, target.id)).toBeNull();
  });

  it("shows nothing with neither", () => {
    expect(hoveredOf(two(), null, null)).toBeNull();
  });

  it("shows the Minion under the pointer, of several, over the Target", () => {
    const world = two();
    const [, target] = world.monsters;
    const pointed = { ...golem(5), id: 2 };
    world.minions = [golem(5), pointed];

    expect(hoveredOf(world, { minion: 2 }, target.id)).toEqual({
      minion: pointed,
    });
  });

  it("shows nothing for a pointed Minion that has since died", () => {
    const world = two();
    world.minions = [golem(5)];

    expect(hoveredOf(world, { minion: 2 }, null)).toBeNull();
  });
});
