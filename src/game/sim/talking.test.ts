import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { distance } from "./vec";
import {
  createWorld,
  type Order,
  type SimEvent,
  step,
  type World,
  withinNpcReach,
} from "./world";

/** A point object in the middle of tile (x, y). */
function point(type: string, name: string, x: number, y: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
}

// An open 12×3 Town: the Hero at the left, the Smith a few tiles along and
// the Elder far off.
const town = {
  orientation: "orthogonal",
  width: 12,
  height: 3,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    {
      type: "tilelayer",
      name: "floor",
      width: 12,
      height: 3,
      data: new Array(36).fill(1),
    },
    {
      type: "objectgroup",
      name: "objects",
      objects: [
        point("entry", "start", 1, 1),
        point("npc", "Smith", 5, 1),
        point("npc", "Elder", 10, 1),
      ],
    },
  ],
};

const SMITH = 0;
const ELDER = 1;

function newWorld(): World {
  return createWorld({ areas: { town }, seed: 1 });
}

/** Steps `world` with `orders` once, then idle until `steps` have passed. */
function run(world: World, orders: Order[], steps = 200): SimEvent[] {
  const events = step(world, orders);
  for (let i = 1; i < steps; i += 1) events.push(...step(world, []));
  return events;
}

describe("Talk", () => {
  it("walks the Hero within reach of the NPC, then they talk", () => {
    const world = newWorld();

    const events = run(world, [{ type: "Talk", npc: SMITH }]);

    const spoke = events.filter((event) => event.type === "Talked");
    expect(spoke).toEqual([{ type: "Talked", npc: SMITH, name: "Smith" }]);
    const smith = world.areas.town.npcs[SMITH];
    expect(distance(world.hero.pos, smith.pos)).toBeLessThanOrEqual(
      heroTuning.talkReach,
    );
  });

  it("talks at once to an NPC already in reach", () => {
    const world = newWorld();
    world.hero.pos = { x: 4.5, y: 1.5 };
    world.hero.prevPos = { ...world.hero.pos };

    const events = step(world, [{ type: "Talk", npc: SMITH }]);

    expect(events).toContainEqual({
      type: "Talked",
      npc: SMITH,
      name: "Smith",
    });
  });

  it("talks once, not on every step spent standing there", () => {
    const world = newWorld();

    const events = run(world, [{ type: "Talk", npc: SMITH }], 400);

    expect(events.filter((event) => event.type === "Talked")).toHaveLength(1);
  });

  it("is dropped by walking elsewhere on the way", () => {
    const world = newWorld();
    step(world, [{ type: "Talk", npc: ELDER }]);

    const events = run(world, [{ type: "MoveTo", target: { x: 1.5, y: 2.5 } }]);

    expect(events.some((event) => event.type === "Talked")).toBe(false);
  });

  it("ignores an NPC that isn't there", () => {
    const world = newWorld();

    const events = run(world, [{ type: "Talk", npc: 9 }], 50);

    expect(events.some((event) => event.type === "Talked")).toBe(false);
    expect(world.hero.path).toEqual([]);
  });
});

describe("withinNpcReach", () => {
  it("is true within the reach to keep talking from, false beyond", () => {
    const world = newWorld();
    const smith = world.areas.town.npcs[SMITH].pos;

    world.hero.pos = { x: smith.x - heroTuning.talkLeave + 0.1, y: smith.y };
    expect(withinNpcReach(world, SMITH)).toBe(true);
    world.hero.pos = { x: smith.x - heroTuning.talkLeave - 0.1, y: smith.y };
    expect(withinNpcReach(world, SMITH)).toBe(false);
  });

  it("is false for an NPC the Area doesn't have", () => {
    expect(withinNpcReach(newWorld(), 9)).toBe(false);
  });
});
