import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { monsterTuning } from "../tuning/monsters";
import { newMinion } from "./minions";
import { monsterMaxLife } from "./monsters";
import { isLobbed, type LobbedProjectile } from "./projectiles";
import { combatArea } from "./testAreas";
import { msToSteps } from "./units";
import {
  burningCircles,
  createWorld,
  type Monster,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `N` an Entry named `arrive`, `E` an Exit to `exitTo`'s `arrive`,
 * `G` Grave Wockington, `S` one Skeleton and `A` one Skeleton Archer, each in
 * the middle of its tile.
 */
function map(rows: string[], exitTo = "town", areaLevel: number | null = 11) {
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
    if (cell === "G") objects.push(spawn("grave_wockington", x, y));
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

const attack = monsterTuning.grave_wockington.attack;
if (attack.kind !== "ranged" || !attack.lob?.burn || !attack.recoveryMs) {
  throw new Error("No Gravefire tuning");
}
const { lob, recoveryMs } = attack;
const { burn } = lob;
if (!burn) throw new Error("No burn tuning");
const ticks = Math.floor(burn.burnMs / burn.tickMs);

const savedFlinch = heroTuning.flinchChance;
afterEach(() => {
  heroTuning.flinchChance = savedFlinch;
});

/** The boss in a field with the Hero kept alive, unflinching, and no waves. */
function fight(rows: string[], seed = 1): World {
  const w = createWorld({ areas: { town: map(rows, "town", null) }, seed });
  prepare(w);
  return w;
}

function prepare(w: World) {
  heroTuning.flinchChance = 0;
  w.hero.life = 1e6;
  for (const m of w.monsters) m.waves = null;
}

function bossOf(w: World): Monster {
  const boss = w.monsters.find((m) => m.type === "grave_wockington");
  if (!boss) throw new Error("No boss");
  return boss;
}

function untilCast(w: World, once = true): LobbedProjectile {
  for (let i = 0; !w.projectiles.some(isLobbed); i++) {
    if (i > 60 * 10) throw new Error("He never cast");
    step(w, []);
  }
  const fire = w.projectiles.find(isLobbed);
  if (!fire) throw new Error("unreachable");
  // Once is enough: he casts no more, so one circle burns out.
  if (once) for (const m of w.monsters) m.cooldown = 1e9;
  return fire;
}

function untilWindUp(w: World, boss: Monster) {
  for (let i = 0; boss.state !== "windup"; i++) {
    if (i > 60 * 10) throw new Error("He never wound up");
    step(w, []);
  }
}

/** Steps until a burning circle exists, returning the events on the way. */
function untilBurning(w: World): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; burningCircles(w).length === 0; i++) {
    if (i > 60 * 10) throw new Error("Never burned");
    events.push(...step(w, []));
  }
  return events;
}

function untilBurnt(w: World): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; burningCircles(w).length > 0; i++) {
    if (i > 60 * 20) throw new Error("Never burnt out");
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

function walkThrough(w: World) {
  const from = w.areaName;
  step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  for (let i = 0; w.areaName === from || w.areaChange; i++) {
    if (i > 60 * 5) throw new Error("Never arrived");
    step(w, []);
  }
}

describe("Grave Wockington fighting as a caster", () => {
  it("casts Gravefire with his target in range and sight, standing still", () => {
    const w = fight(["H.....G...."]);
    const boss = bossOf(w);
    const home = { ...boss.pos };
    const fire = untilCast(w);

    expect(fire.kind).toBe("gravefire");
    expect(fire.from).toBe(boss.id);
    expect(boss.pos).toEqual(home);
    for (let i = 0; i < 30; i++) step(w, []);
    expect(boss.pos).toEqual(home);
  });

  it("swings his blow instead with his target within melee reach", () => {
    const w = fight(["HG........."]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 * 3; i++) events.push(...step(w, []));

    expect(w.projectiles.filter(isLobbed)).toEqual([]);
    expect(onHero(events).length).toBeGreaterThan(0);
  });

  it("walks closer while his target is out of range", () => {
    const w = fight(["H......................G"]);
    const boss = bossOf(w);
    const start = { ...boss.pos };
    boss.state = "chase";
    for (let i = 0; i < 60; i++) step(w, []);

    expect(boss.pos.x).toBeLessThan(start.x);
    expect(w.projectiles.filter(isLobbed)).toEqual([]);
  });

  it("lands where the Hero stood when it was cast, over a Wall and a Bone Wall", () => {
    const w = fight(["H..#..G...."]);
    const boss = bossOf(w);
    // Seen from near, then the Hero is behind the Wall when he casts.
    w.hero.pos = { x: 4.5, y: 0.5 };
    w.hero.prevPos = { ...w.hero.pos };
    untilWindUp(w, boss);
    w.hero.pos = { x: 0.5, y: 0.5 };
    w.hero.prevPos = { ...w.hero.pos };
    w.boneWalls.push({ id: 1, pos: { x: 2.5, y: 0.5 }, life: 100, left: 6000 });
    const fire = untilCast(w);
    expect(fire.landing).toEqual({ x: 0.5, y: 0.5 });
    untilBurning(w);

    expect(burningCircles(w)).toHaveLength(1);
    expect(burningCircles(w)[0].pos).toEqual({ x: 0.5, y: 0.5 });
    expect(burningCircles(w)[0].radius).toBe(lob.radius);
    expect(w.boneWalls[0].life).toBe(100);
  });

  it("reports a cast, a landing and a burn ending", () => {
    const w = fight(["H.....G...."]);
    const events: SimEvent[] = [];
    while (!events.some((e) => e.type === "GravefireCast")) {
      if (w.tick > 600) throw new Error("No cast");
      events.push(...step(w, []));
    }
    for (const m of w.monsters) m.cooldown = 1e9;
    events.push(...untilBurning(w), ...untilBurnt(w));

    expect(
      events.map((e) => e.type).filter((t) => t.startsWith("Gravefire")),
    ).toEqual(["GravefireCast", "GravefireLanded", "GravefireBurnEnded"]);
  });
});

describe("a burning circle", () => {
  it("hurts the Hero once per tick for its burn length, and exposes its time left", () => {
    const w = fight(["H.....G...."]);
    untilCast(w);
    const landed = untilBurning(w);
    const [circle] = burningCircles(w);
    expect(circle.leftMs).toBeGreaterThan(burn.burnMs - 100);
    expect(circle.leftMs).toBeLessThanOrEqual(burn.burnMs);

    expect(onHero([...landed, ...untilBurnt(w)])).toHaveLength(ticks);
  });

  it("always hits: no Miss, no Block and no flinch, however the Hero is armed", () => {
    const w = fight(["H.....G...."]);
    untilCast(w);
    untilBurning(w);
    // A Block the Hero cannot fail, an Attack Rating that cannot hit, and a
    // flinch that never fails.
    w.hero.equipment.offHand = {
      id: 900,
      type: "buckler",
      rarity: "magic",
      affixes: [{ kind: "block", grade: 0, value: 1000 }],
    };
    w.burns[0].attackRating = 0;
    heroTuning.flinchChance = 1;
    const events: SimEvent[] = [];
    while (burningCircles(w).length > 0) {
      events.push(...step(w, []));
      expect(w.hero.flinch).toBe(0);
    }

    expect(events.filter((e) => e.type === "HeroHit")).toHaveLength(ticks);
    expect(events.some((e) => e.type === "Missed")).toBe(false);
    expect(events.some((e) => e.type === "Blocked")).toBe(false);
  });

  it("hits a Minion every tick whatever its Defense, with its Resistance applied", () => {
    const w = fight(["H.....G...."]);
    untilCast(w);
    untilBurning(w);
    w.burns[0].attackRating = 0;
    const [circle] = burningCircles(w);
    const minion = newMinion(90, "golem", "golem", 1, { ...circle.pos }, 0);
    w.minions.push(minion);
    const events: SimEvent[] = [];
    while (burningCircles(w).length > 0) {
      minion.pos = { ...circle.pos };
      minion.prevPos = { ...circle.pos };
      events.push(...step(w, []));
    }
    const hits = events.filter((e) => e.type === "MinionHit");

    expect(hits.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "MinionMissed")).toBe(false);
  });

  it("soaks into the Bone Ward before the Hero's Life", () => {
    const w = fight(["H.....G...."]);
    untilCast(w);
    untilBurning(w);
    w.hero.boneWard = { left: 1000, full: 1000 };
    const life = w.hero.life;
    const events: SimEvent[] = [];
    while (burningCircles(w).length > 0) events.push(...step(w, []));

    expect(w.hero.life).toBe(life);
    expect(w.hero.boneWard?.left).toBeLessThan(1000);
    expect(events.filter((e) => e.type === "HeroHit")).toHaveLength(ticks);
  });

  it("hurts each Minion inside it and nothing outside it", () => {
    const w = fight(["H.....G....", "...........", "..........."]);
    untilCast(w);
    untilBurning(w);
    const at = burningCircles(w)[0].pos;
    const inside = newMinion(
      90,
      "golem",
      "golem",
      1,
      { x: at.x, y: at.y + lob.radius * 0.5 },
      0,
    );
    const outside = newMinion(
      91,
      "golem",
      "golem",
      1,
      { x: at.x, y: at.y + lob.radius * 1.6 },
      0,
    );
    w.minions.push(inside, outside);
    const spots = [inside, outside].map((m) => ({ m, pos: { ...m.pos } }));
    const events: SimEvent[] = [];
    while (burningCircles(w).length > 0) {
      for (const { m, pos } of spots) {
        m.pos = { ...pos };
        m.prevPos = { ...pos };
      }
      events.push(...step(w, []));
    }

    expect(onMinion(events, 90).length).toBeGreaterThan(0);
    expect(onMinion(events, 91)).toEqual([]);
  });

  it("does not hurt the Hero once they have left it", () => {
    const w = fight([
      "H.....G....",
      "...........",
      "...........",
      "...........",
      "...........",
    ]);
    untilCast(w);
    untilBurning(w);
    w.hero.pos = { x: 0.5, y: 4.5 };
    w.hero.prevPos = { ...w.hero.pos };
    const circle = burningCircles(w)[0];
    expect(Math.hypot(circle.pos.x - 0.5, circle.pos.y - 4.5)).toBeGreaterThan(
      lob.radius,
    );

    expect(onHero(untilBurnt(w))).toEqual([]);
  });

  it("never hurts Monsters", () => {
    const w = fight(["H.....G....S"]);
    untilCast(w);
    untilBurning(w);
    const bystander = w.monsters.find((m) => m.type === "skeleton");
    if (!bystander) throw new Error("No Skeleton");
    const boss = bossOf(w);
    const full = [monsterMaxLife(bystander), boss.life];
    while (burningCircles(w).length > 0) {
      bystander.pos = { ...burningCircles(w)[0].pos };
      bystander.prevPos = { ...bystander.pos };
      step(w, []);
    }

    expect([bystander.life, boss.life]).toEqual(full);
  });

  it("never hurts a Hero in Death, and still burns out", () => {
    const w = fight(["H.....G....A"]);
    untilCast(w);
    untilBurning(w);
    w.hero.life = 1;
    const events: SimEvent[] = [];
    while (burningCircles(w).length > 0) events.push(...step(w, []));
    const died = events.findIndex((e) => e.type === "HeroDied");

    expect(died).toBeGreaterThanOrEqual(0);
    expect(onHero(events.slice(died + 1))).toEqual([]);
    expect(burningCircles(w)).toEqual([]);
  });

  it("lands and burns after he dies", () => {
    const w = fight(["H.....G...."]);
    const boss = bossOf(w);
    const fire = untilCast(w);
    w.monsters = w.monsters.filter((m) => m !== boss);
    const events = [...untilBurning(w), ...untilBurnt(w)];

    expect(w.projectiles).not.toContain(fire);
    expect(onHero(events)).toHaveLength(ticks);
  });

  it("is set aside with its Area across an Exit", () => {
    const w = createWorld({
      areas: {
        town: map(["EN.....H"], "field", null),
        field: map(["EN.....G....", "...........H"]),
      },
      seed: 1,
    });
    walkThrough(w);
    prepare(w);
    untilCast(w);
    untilBurning(w);
    const left = burningCircles(w)[0].leftMs;

    walkThrough(w);
    expect(w.areaName).toBe("town");
    expect(burningCircles(w)).toEqual([]);
    walkThrough(w);
    expect(w.areaName).toBe("field");
    expect(burningCircles(w)).toHaveLength(1);
    expect(burningCircles(w)[0].leftMs).toBeLessThanOrEqual(left);
    expect(burningCircles(w)[0].leftMs).toBeGreaterThan(left - 1000);
  });
});

describe("his wind-up", () => {
  it("is cancelled by no hit", () => {
    const w = fight(["H.....G...."]);
    const boss = bossOf(w);
    untilWindUp(w, boss);
    const before = boss.attack;
    // However hard it is hit, a flinch never interrupts it.
    boss.flinch = 10;
    step(w, []);

    expect(boss.state).toBe("windup");
    expect(boss.attack).toBeGreaterThan(before);
  });

  it("recovers for the recovery tuned for his stage", () => {
    const w = fight(["H.....G...."]);
    const boss = bossOf(w);
    untilCast(w, false);
    const t = monsterTuning.grave_wockington;
    const least = msToSteps(recoveryMs[0]) + msToSteps(t.rootMs);

    expect(boss.cooldown).toBeGreaterThanOrEqual(least - 2);
    expect(boss.cooldown).toBeLessThanOrEqual(
      least + msToSteps(t.jitterMs) + 2,
    );
  });
});
