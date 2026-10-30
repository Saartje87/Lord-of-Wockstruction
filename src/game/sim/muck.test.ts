import { describe, expect, it } from "vitest";
import { monsterTuning } from "../tuning/monsters";
import { newMinion } from "./minions";
import { monsterMaxLife } from "./monsters";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  type LobbedProjectile,
  type Monster,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `N` an Entry named `arrive`, `E` an Exit to `exitTo`'s `arrive`,
 * `B` one Bog Spitter, `S` one Skeleton and `A` one Skeleton Archer, each in
 * the middle of its tile.
 */
function map(rows: string[], exitTo = "town", areaLevel: number | null = 1) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  const spawn = (monster: string, x: number, y: number) => ({
    name: "",
    type: "monsterSpawn",
    point: true,
    x,
    y,
    properties: [{ name: "monster", type: "string", value: monster }],
  });
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "N") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "B") objects.push(spawn("bog_spitter", x, y));
    if (cell === "S") objects.push(spawn("skeleton", x, y));
    if (cell === "A") objects.push(spawn("skeleton_archer", x, y));
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: x - 16,
        y: y - 16,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "arrive" },
        ],
      });
    }
  });
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width,
    height,
    data,
  });
  const area = {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "test",
        tiles: [
          {
            id: 1,
            properties: [{ name: "blocks", type: "bool", value: true }],
          },
        ],
      },
    ],
    layers: [
      layer("floor", new Array(width * height).fill(1)),
      layer(
        "walls & props",
        [...cells].map((cell) => (cell === "#" ? 2 : 0)),
      ),
      { type: "objectgroup", name: "objects", objects },
    ],
  };
  return areaLevel === null ? area : combatArea(area, areaLevel);
}

/** Town, a strip with an Exit at its west end into the field. */
const TOWN = map(["EN.....H"], "field", null);

function inTown(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows, "town", null) }, seed });
}

function inField(fieldRows: string[], seed = 1): World {
  const w = createWorld({
    areas: { town: TOWN, field: map(fieldRows) },
    seed,
  });
  walkThroughExit(w);
  return w;
}

function walkThroughExit(w: World): SimEvent[] {
  const from = w.areaName;
  const events = step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  for (let i = 0; w.areaName === from || w.areaChange; i++) {
    if (i > 60 * 5) throw new Error("Never arrived");
    events.push(...step(w, []));
  }
  return events;
}

function spitterOf(w: World): Monster {
  const spitter = w.monsters.find((m) => m.type === "bog_spitter");
  if (!spitter) throw new Error("No Bog Spitter");
  return spitter;
}

function muckOf(w: World): LobbedProjectile {
  const muck = w.projectiles.find((p): p is LobbedProjectile => "lob" in p);
  if (!muck) throw new Error("No Muck in flight");
  return muck;
}

/** Steps until the Spitter starts winding up, giving `orders` each step. */
function untilWindUp(w: World, spitter: Monster, orders: Order[] = []) {
  for (let i = 0; spitter.state !== "windup"; i++) {
    if (i > 60 * 10) throw new Error("It never wound up");
    step(w, orders);
  }
}

/** Steps until Muck is loosed, returning it. */
function untilLoosed(w: World): LobbedProjectile {
  for (let i = 0; !w.projectiles.some((p) => "lob" in p); i++) {
    if (i > 60 * 10) throw new Error("No Muck was loosed");
    step(w, []);
  }
  return muckOf(w);
}

/** Steps until `muck` is gone, returning the events on the way. */
function untilLanded(
  w: World,
  muck: object,
  each: () => void = () => {},
): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; w.projectiles.includes(muck as never); i++) {
    if (i > 60 * 10) throw new Error("The Muck never landed");
    each();
    events.push(...step(w, []));
  }
  return events;
}

const onHero = (events: SimEvent[]) =>
  events.filter(
    (e) => e.type === "HeroHit" || (e.type === "Missed" && e.target === "hero"),
  );

const onMinion = (events: SimEvent[], id: number) =>
  events.filter(
    (e) =>
      (e.type === "MinionHit" || e.type === "MinionMissed") && e.minion === id,
  );

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe("Muck", () => {
  it("lands on the spot the Hero stood on when it was loosed, not where they stand at landing", () => {
    const w = inTown(["H.....B...."]);
    const loosedAt = { ...w.hero.pos };
    const muck = untilLoosed(w);
    // The Hero was where it was loosed at, give or take the wind-up.
    expect(muck.landing.x).toBeCloseTo(w.hero.pos.x, 5);
    expect(muck.landing.y).toBeCloseTo(w.hero.pos.y, 5);
    expect(distance(muck.landing, loosedAt)).toBeLessThan(1e-6);

    // The Hero runs off while it flies.
    const away: Order = { type: "MoveTo", target: { x: 0.5, y: 4.5 } };
    const w2 = inTown([
      "H.....B....",
      "...........",
      "...........",
      "..........",
    ]);
    const muck2 = untilLoosed(w2);
    const aimed = { ...muck2.landing };
    const events = [...step(w2, [away]), ...untilLanded(w2, muck2)];

    expect(muck2.landing).toEqual(aimed);
    expect(distance(w2.hero.pos, aimed)).toBeGreaterThan(1.5);
    expect(onHero(events)).toEqual([]);
  });

  it("hits a Hero who stays on the spot, once, for the numbers it was loosed with", () => {
    const w = inTown(["H.....B...."]);
    const muck = untilLoosed(w);
    const events = untilLanded(w, muck);

    expect(onHero(events)).toHaveLength(1);
    expect(w.projectiles).toEqual([]);
  });

  it("flies to its mark at 4 tiles/s, its progress rising from 0 to 1", () => {
    const w = inTown(["H.....B...."]);
    const muck = untilLoosed(w);
    const tiles = distance(muck.origin, muck.landing);
    expect(muck.progress).toBe(0);
    let last = 0;
    let steps = 0;
    while (w.projectiles.includes(muck)) {
      step(w, []);
      steps += 1;
      if (w.projectiles.includes(muck)) {
        expect(muck.progress).toBeGreaterThan(last);
        last = muck.progress;
      }
    }
    expect(muck.progress).toBe(1);
    expect(Math.abs(steps - (tiles / 4) * 60)).toBeLessThan(2);
  });

  it("flies over a Wall and a Bone Wall to its mark", () => {
    const w = inTown(["H..#..B...."]);
    const spitter = spitterOf(w);
    // Seen from near, then the Hero is behind the Wall when it looses.
    w.hero.pos = { x: 4.5, y: 0.5 };
    w.hero.prevPos = { ...w.hero.pos };
    untilWindUp(w, spitter);
    w.hero.pos = { x: 0.5, y: 0.5 };
    w.hero.prevPos = { ...w.hero.pos };
    w.boneWalls.push({ id: 1, pos: { x: 2.5, y: 0.5 }, life: 100, left: 6000 });

    const muck = untilLoosed(w);
    const events = untilLanded(w, muck);

    expect(muck.landing).toEqual({ x: 0.5, y: 0.5 });
    expect(onHero(events)).toHaveLength(1);
    expect(w.boneWalls[0].life).toBe(100);
  });

  it("hits the Hero and each Minion inside its circle once, and nothing outside it", () => {
    const w = inTown([
      "H.....B....",
      "...........",
      "...........",
      "..........",
    ]);
    const spitter = spitterOf(w);
    const before = spitter.life;
    const muck = untilLoosed(w);
    const at = muck.landing;
    const radius =
      monsterTuning.bog_spitter.attack.kind === "ranged"
        ? (monsterTuning.bog_spitter.attack.lob?.radius ?? 0)
        : 0;
    expect(muck.radius).toBe(radius);
    const near = newMinion(
      90,
      "golem",
      "golem",
      1,
      { x: at.x, y: at.y + radius * 0.6 },
      0,
    );
    const edge = newMinion(
      91,
      "golem",
      "golem",
      1,
      { x: at.x + radius * 0.9, y: at.y },
      0,
    );
    const far = newMinion(
      92,
      "golem",
      "golem",
      1,
      { x: at.x, y: at.y + radius * 1.6 },
      0,
    );
    w.minions.push(near, edge, far);
    const monster = w.monsters[0];
    expect(monster).toBe(spitter);
    // Minions would walk off to fight; hold them on their spots.
    const spots = [near, edge, far].map((m) => ({ m, pos: { ...m.pos } }));
    const events = untilLanded(w, muck, () => {
      for (const { m, pos } of spots) {
        m.pos = { ...pos };
        m.prevPos = { ...pos };
      }
    });

    expect(onHero(events)).toHaveLength(1);
    expect(onMinion(events, 90)).toHaveLength(1);
    expect(onMinion(events, 91)).toHaveLength(1);
    expect(onMinion(events, 92)).toEqual([]);
    expect(spitter.life).toBe(before);
  });

  it("never hits Monsters", () => {
    const w = inTown(["H.....B....S"]);
    const muck = untilLoosed(w);
    const bystander = w.monsters.find((m) => m.type === "skeleton");
    if (!bystander) throw new Error("No Skeleton");
    const full = monsterMaxLife(bystander);

    untilLanded(w, muck, () => {
      bystander.pos = { ...muck.landing };
      bystander.prevPos = { ...muck.landing };
    });

    expect(bystander.life).toBe(full);
  });

  it("never hits a Hero in Death", () => {
    // The Archer's Arrow kills the Hero while the Muck is still in the air.
    const w = inTown(["A.....H.....B"]);
    w.hero.life = 1;
    const muck = untilLoosed(w);
    const events: SimEvent[] = [];
    for (let i = 0; w.projectiles.includes(muck); i++) {
      if (i > 60 * 10) throw new Error("The Muck never landed");
      events.push(...step(w, []));
    }

    expect(events.some((e) => e.type === "HeroDied")).toBe(true);
    const died = events.findIndex((e) => e.type === "HeroDied");
    expect(onHero(events.slice(died + 1))).toEqual([]);
  });

  it("lands with its numbers after its Bog Spitter dies", () => {
    const w = inTown(["H.....B...."]);
    const spitter = spitterOf(w);
    const muck = untilLoosed(w);
    const numbers = {
      attackRating: muck.attackRating,
      damage: [...muck.damage],
    };
    // The Spitter dies while its Muck is in the air.
    spitter.life = 0;
    w.monsters = w.monsters.filter((m) => m !== spitter);

    const events = untilLanded(w, muck);

    expect(w.monsters).not.toContain(spitter);
    const hits = onHero(events);
    expect(hits).toHaveLength(1);
    const [hit] = hits;
    if (hit.type === "HeroHit") {
      expect(hit.damage).toBeGreaterThanOrEqual(numbers.damage[0]);
      expect(hit.damage).toBeLessThanOrEqual(numbers.damage[1]);
    }
  });

  it("is set aside with its Area across an Exit, and has it again on returning", () => {
    const w = inField(["EN.....B....", "............", "...........H"]);
    untilLoosed(w);
    const loosed = w.projectiles.length;

    walkThroughExit(w);
    expect(w.areaName).toBe("town");
    expect(w.projectiles).toEqual([]);

    walkThroughExit(w);
    expect(w.areaName).toBe("field");
    expect(w.projectiles).toHaveLength(loosed);
  });
});

describe("a Bog Spitter", () => {
  it("looses Muck once the Hero is within its 7 tiles' range and in sight, and not before", () => {
    const w = inTown(["H........B"]);
    const spitter = spitterOf(w);
    const home = { ...spitter.pos };

    const muck = untilLoosed(w);

    expect(distance(spitter.pos, home)).toBeGreaterThan(1);
    expect(distance(spitter.pos, w.hero.pos)).toBeLessThanOrEqual(7 + 1e-9);
    expect(muck.from).toBe(spitter.id);
  });

  it("walks on, in range but with a wall in the way, until it can see the Hero", () => {
    // The Skeleton sees the Hero and wakes the Spitter, which can't.
    const w = inTown([
      "..........", //
      "H....#B...",
      "......S...",
    ]);
    const spitter = spitterOf(w);
    const home = { ...spitter.pos };
    expect(distance(home, w.hero.pos)).toBeLessThanOrEqual(7);

    for (let i = 0; i < 20; i++) step(w, []);
    expect(w.projectiles.filter((p) => "lob" in p)).toEqual([]);

    untilWindUp(w, spitter);

    expect(distance(spitter.pos, home)).toBeGreaterThan(0.4);
  });

  it("has 45 Life, hits for 5–9, gives 120 Experience and walks at 1.2 tiles/s", () => {
    const t = monsterTuning.bog_spitter;
    expect([t.life, t.damage, t.experience, t.speed]).toEqual([
      45,
      [5, 9],
      120,
      1.2,
    ]);
  });
});
