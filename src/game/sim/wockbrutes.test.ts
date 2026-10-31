import { describe, expect, it } from "vitest";
import { monsterTuning } from "../tuning/monsters";
import { newMinion } from "./minions";
import {
  monsterDamageRange,
  monsterExperience,
  monsterMaxLife,
} from "./monsters";
import type { Vec } from "./vec";
import {
  createWorld,
  type Monster,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An open orthogonal Area drawn row by row: `.` floor, `H` the Hero's `start`,
 * `W` one Wockbrute and `S` one Skeleton, each in the middle of its tile.
 */
function map(rows: string[]) {
  const width = rows[0].length;
  const height = rows.length;
  const objects: object[] = [];
  const spawn = (monster: string, x: number, y: number) => ({
    name: "",
    type: "monsterSpawn",
    x,
    y,
    properties: [{ name: "monster", type: "string", value: monster }],
  });
  [...rows.join("")].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "W") objects.push(spawn("wockbrute", x, y));
    if (cell === "S") objects.push(spawn("skeleton", x, y));
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height,
        data: new Array(width * height).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

function world(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows) }, seed });
}

function brute(w: World): Monster {
  const found = w.monsters.find((m) => m.type === "wockbrute");
  if (!found) throw new Error("No Wockbrute");
  return found;
}

function place(thing: { pos: Vec; prevPos: Vec }, pos: Vec) {
  thing.pos = { ...pos };
  thing.prevPos = { ...pos };
}

/** Steps until the Wockbrute starts winding up. */
function untilWindUp(w: World, monster: Monster) {
  for (let i = 0; monster.state !== "windup"; i++) {
    if (i > 60 * 10) throw new Error("It never wound up");
    step(w, []);
  }
}

/** Steps until the Wockbrute's wind-up is over, returning the events. */
function untilSlammed(
  w: World,
  monster: Monster,
  each: () => void = () => {},
  orders: () => Parameters<typeof step>[1] = () => [],
): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; monster.state === "windup"; i++) {
    if (i > 60 * 5) throw new Error("The wind-up never ended");
    each();
    events.push(...step(w, orders()));
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

describe("the Wockbrute", () => {
  it("has 300 Life, Slams for 10-18 and gives 350 Experience at Monster Level 1", () => {
    const w = world(["H..W"]);
    const monster = brute(w);
    expect(monsterMaxLife(monster)).toBe(300);
    expect(monsterDamageRange(monster)).toEqual([10, 18]);
    expect(monsterExperience(monster)).toBe(350);
  });

  it("grows per Monster Level at the Skeleton's rates", () => {
    expect(monsterTuning.wockbrute.growth).toEqual(
      monsterTuning.skeleton.growth,
    );
  });

  it("walks at 1.2 tiles/s", () => {
    const w = world(["H.....W"]);
    const monster = brute(w);
    step(w, []);
    const start = { ...monster.pos };
    for (let i = 0; i < 30; i++) step(w, []);
    const walked = Math.hypot(monster.pos.x - start.x, monster.pos.y - start.y);
    expect(walked).toBeCloseTo(0.6, 1);
  });
});

describe("the Slam", () => {
  it("winds up for about 1.2 s", () => {
    const w = world(["H.W"]);
    const monster = brute(w);
    untilWindUp(w, monster);
    let steps = 0;
    while (monster.state === "windup") {
      step(w, []);
      steps += 1;
    }
    expect(Math.abs(steps - 72)).toBeLessThanOrEqual(1);
  });

  it("hits a Hero standing behind the Wockbrute, and every Minion inside its circle", () => {
    const w = world(["H.W......", ".........", ".........", "........."]);
    const monster = brute(w);
    const radius = 2;
    const golem = (id: number, pos: Vec) =>
      newMinion(id, "golem", "golem", 1, pos, 0);
    const inside = golem(90, { x: 0, y: 0 });
    const behind = golem(91, { x: 0, y: 0 });
    const outside = golem(92, { x: 0, y: 0 });
    w.minions.push(inside, behind, outside);
    untilWindUp(w, monster);
    const at = { ...monster.pos };
    // It faces east, at the Hero; the Hero and a Minion are west of it.
    const spots: [Minion3, Vec][] = [
      [inside, { x: at.x, y: at.y + radius * 0.8 }],
      [behind, { x: at.x + radius * 0.8, y: at.y }],
      [outside, { x: at.x, y: at.y - radius * 1.4 }],
    ];
    const heroSpot = { x: at.x + radius * 0.5, y: at.y };
    const events = untilSlammed(w, monster, () => {
      place(w.hero, heroSpot);
      for (const [minion, pos] of spots) place(minion, pos);
    });

    expect(onHero(events)).toHaveLength(1);
    expect(onMinion(events, 90)).toHaveLength(1);
    expect(onMinion(events, 91)).toHaveLength(1);
    expect(onMinion(events, 92)).toEqual([]);
  });

  it("misses a Hero outside its circle", () => {
    const w = world(["H.W......", "........."]);
    const monster = brute(w);
    untilWindUp(w, monster);
    const events = untilSlammed(w, monster, () => {
      place(w.hero, { x: monster.pos.x - 2.6, y: monster.pos.y });
    });
    expect(onHero(events)).toEqual([]);
  });

  it("never hits Monsters", () => {
    const w = world(["H.WS"]);
    const monster = brute(w);
    const bystander = w.monsters.find((m) => m.type === "skeleton");
    if (!bystander) throw new Error("No Skeleton");
    const full = monsterMaxLife(bystander);
    untilWindUp(w, monster);
    untilSlammed(w, monster, () => {
      place(bystander, { x: monster.pos.x + 0.3, y: monster.pos.y });
    });
    expect(bystander.life).toBe(full);
  });

  it("never hits a Hero in Death", () => {
    const w = world(["H.W"]);
    const monster = brute(w);
    untilWindUp(w, monster);
    w.death = { elapsed: 0 };
    const events = untilSlammed(w, monster);
    expect(onHero(events)).toEqual([]);
  });

  it("hits its whole circle as well as the Bone Wall piece it was attacking", () => {
    const w = world(["H.W......", "........."]);
    const monster = brute(w);
    untilWindUp(w, monster);
    const piece = {
      id: 7,
      pos: { x: monster.pos.x + 1, y: monster.pos.y },
      life: 100,
      left: 6000,
    };
    w.boneWalls.push(piece);
    monster.wall = piece.id;
    const events = untilSlammed(w, monster, () => {
      monster.facing = 0;
      place(w.hero, { x: monster.pos.x - 1, y: monster.pos.y });
    });
    expect(events.some((e) => e.type === "BoneWallHit")).toBe(true);
    expect(onHero(events)).toHaveLength(1);
  });

  it("isn't stopped by hitting the Wockbrute, even when the hit flinches it", () => {
    monsterTuning.wockbrute.flinchChance = 1;
    const w = world(["H.W"]);
    const monster = brute(w);
    untilWindUp(w, monster);
    const life = monster.life;
    const events = untilSlammed(
      w,
      monster,
      () => {},
      () => [{ type: "Attack", monster: monster.id }],
    );
    expect(monster.state).toBe("recover");
    expect(onHero(events)).toHaveLength(1);
    expect(monster.life).toBeLessThanOrEqual(life);
  });
});

type Minion3 = ReturnType<typeof newMinion>;
