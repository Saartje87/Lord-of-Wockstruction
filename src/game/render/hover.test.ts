import { describe, expect, it } from "vitest";
import { combatArea } from "../sim/testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
  type Minion,
  type Monster,
  minionMaxLife,
} from "../sim/world";
import type { MonsterType } from "../tuning/monsters";
import { characterUnder, nameplateOf, type Pickable } from "./hover";

describe("characterUnder", () => {
  it("picks the character whose box is under the point", () => {
    const characters: Pickable<number | "golem">[] = [
      { id: 1, at: { x: 100, y: 100 }, scale: 1 },
      { id: "golem", at: { x: 300, y: 100 }, scale: 1 },
    ];

    expect(characterUnder(characters, { x: 100, y: 60 })).toBe(1);
    expect(characterUnder(characters, { x: 300, y: 60 })).toBe("golem");
    expect(characterUnder(characters, { x: 200, y: 60 })).toBeNull();
  });

  it("picks the one in front, lowest on screen, where boxes overlap", () => {
    const characters: Pickable<number | "golem">[] = [
      { id: 1, at: { x: 100, y: 100 }, scale: 1 },
      { id: "golem", at: { x: 110, y: 120 }, scale: 1.3 },
    ];

    expect(characterUnder(characters, { x: 105, y: 80 })).toBe("golem");
  });

  it("grows a character's box with its scale", () => {
    const at = { x: 100, y: 100 };
    // Above a native-scale character's head, but on one 1.3 times as big.
    const point = { x: 100, y: 100 - 150 };

    expect(characterUnder([{ id: 1, at, scale: 1 }], point)).toBeNull();
    expect(characterUnder([{ id: 1, at, scale: 1.3 }], point)).toBe(1);
  });
});

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

  it("names the Golem, friendly, with its Life bar's fill", () => {
    const max = minionMaxLife({ type: "golem", skillLevel: 1 });

    const plate = nameplateOf({ minion: golem(max / 4) });

    expect(plate).toEqual({ name: "Golem", fraction: 0.25, friendly: true });
  });
});
