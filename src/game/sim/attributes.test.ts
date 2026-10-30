import { describe, expect, it } from "vitest";
import { emptySkillBar } from "./skillBar";
import {
  type Attribute,
  attackRating,
  createWorld,
  damageRange,
  FRESH_PROGRESS,
  heroChanceToHit,
  heroDamage,
  maxLife,
  type Progress,
  progressOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` a pack of `pack` Skeletons, centred on their tile.
 */
function map(rows: string[], pack = 1) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
          { name: "count", type: "int", value: pack },
        ],
      });
    }
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

/** A Town with the Hero next to a pack of `pack` Skeletons. */
function world(pack = 1, progress?: Progress): World {
  return createWorld({
    areas: { town: map(["H.S.."], pack) },
    seed: 1,
    progress,
  });
}

/**
 * Attacks the nearest Monster until `kills` have died, returning every
 * event on the way.
 */
function kill(world: World, kills: number): SimEvent[] {
  const all: SimEvent[] = [];
  let died = 0;
  for (let i = 0; died < kills; i++) {
    if (i > 60 * 60) throw new Error(`Only ${died} of ${kills} kills`);
    const [nearest] = [...world.monsters].sort(
      (a, b) => gap(world, a.pos) - gap(world, b.pos),
    );
    const events = step(world, [{ type: "Attack", monster: nearest.id }]);
    died += events.filter((event) => event.type === "MonsterDied").length;
    all.push(...events);
  }
  return all;
}

function gap(world: World, pos: { x: number; y: number }): number {
  return Math.hypot(pos.x - world.hero.pos.x, pos.y - world.hero.pos.y);
}

describe("Attribute Points", () => {
  it("start at none, and 5 come with each new Level", () => {
    const w = world(5);
    expect(progressOf(w).attributePoints).toBe(0);

    kill(w, 5);

    expect(progressOf(w)).toMatchObject({ level: 2, attributePoints: 5 });
  });
});

describe("a fresh Hero", () => {
  it("has 100 max Life and 20–30 damage from 20/20/20", () => {
    const w = world();

    expect(progressOf(w)).toMatchObject({
      strength: 20,
      dexterity: 20,
      vitality: 20,
    });
    expect(maxLife(w)).toBe(100);
    expect(damageRange(w)).toEqual([20, 30]);
  });
});

/** A Level 3 Hero at 20/20/20 with all 10 of their points unspent. */
const UNSPENT: Progress = {
  level: 3,
  experience: 1_500,
  strength: 20,
  dexterity: 20,
  vitality: 20,
  energy: 20,
  attributePoints: 10,
  skillPoints: 2,
  skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 0 },
  skillBar: emptySkillBar(),
  touchedWaypoints: [...FRESH_PROGRESS.touchedWaypoints],
  smithService: "locked",
  gold: 0,
  quests: structuredClone(FRESH_PROGRESS.quests),
};

/** Spends `times` points on `attribute`, one step each, returning the events. */
function spend(w: World, attribute: Attribute, times = 1): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < times; i++) {
    events.push(
      ...step(w, [
        { type: "SpendAttributePoints", points: { [attribute]: 1 } },
      ]),
    );
  }
  return events;
}

describe("SpendAttributePoints", () => {
  it("raises the Attribute by one for one point and reports it", () => {
    const w = world(1, UNSPENT);

    expect(spend(w, "strength")).toEqual([
      { type: "AttributeRaised", attribute: "strength" },
    ]);
    expect(progressOf(w)).toMatchObject({
      strength: 21,
      dexterity: 20,
      vitality: 20,
      attributePoints: 9,
    });
  });

  it("is ignored with no unspent points", () => {
    const w = world(1, { ...UNSPENT, attributePoints: 1 });
    spend(w, "dexterity");

    expect(spend(w, "dexterity")).toEqual([]);
    expect(progressOf(w)).toMatchObject({ dexterity: 21, attributePoints: 0 });
  });

  it("doesn't interrupt a swing", () => {
    const w = world(1, UNSPENT);
    step(w, [{ type: "SwingAt", target: { x: 2.5, y: 0.5 } }]);
    const swing = w.hero.swing;

    spend(w, "vitality");

    expect(progressOf(w).vitality).toBe(21);
    expect(w.hero.swing).toBe(swing);
    expect(w.hero.buffered).toBeNull();
  });

  it("raises each Attribute by its count in one step, reporting every point", () => {
    const w = world(1, UNSPENT);

    const events = step(w, [
      { type: "SpendAttributePoints", points: { strength: 2, energy: 1 } },
    ]);

    expect(events).toEqual([
      { type: "AttributeRaised", attribute: "strength" },
      { type: "AttributeRaised", attribute: "strength" },
      { type: "AttributeRaised", attribute: "energy" },
    ]);
    expect(progressOf(w)).toMatchObject({
      strength: 22,
      dexterity: 20,
      vitality: 20,
      energy: 21,
      attributePoints: 7,
    });
  });

  it("adds Vitality's Life to current Life and Energy's Mana to current Mana", () => {
    const w = world(1, UNSPENT);
    w.hero.life = 50;
    w.hero.mana = 10;

    step(w, [
      { type: "SpendAttributePoints", points: { vitality: 2, energy: 1 } },
    ]);

    expect(w.hero.life).toBe(56);
    // And a step of Mana regeneration.
    expect(w.hero.mana).toBeCloseTo(12, 1);
  });

  it("is refused whole when it asks for more points than are unspent", () => {
    const w = world(1, { ...UNSPENT, attributePoints: 3 });

    const events = step(w, [
      { type: "SpendAttributePoints", points: { strength: 2, dexterity: 2 } },
    ]);

    expect(events).toEqual([]);
    expect(progressOf(w)).toMatchObject({
      strength: 20,
      dexterity: 20,
      attributePoints: 3,
    });
  });

  it("is refused for a negative or broken count", () => {
    const w = world(1, UNSPENT);

    step(w, [
      { type: "SpendAttributePoints", points: { strength: 3, dexterity: -1 } },
    ]);
    step(w, [{ type: "SpendAttributePoints", points: { vitality: 0.5 } }]);

    expect(progressOf(w)).toMatchObject({
      strength: 20,
      dexterity: 20,
      vitality: 20,
      attributePoints: 10,
    });
  });

  it("is refused while the Hero lies dead", () => {
    const w = world(1, UNSPENT);
    for (let i = 0; !w.death; i++) {
      if (i > 60 * 60) throw new Error("The Hero didn't die");
      step(w, []);
    }

    step(w, [{ type: "SpendAttributePoints", points: { strength: 1 } }]);

    expect(progressOf(w)).toMatchObject({ strength: 20, attributePoints: 10 });
  });
});

/** The Hero's damage averaged over evenly spread rolls. */
function averageDamage(w: World): number {
  const rolls = 10_000;
  let total = 0;
  for (let i = 0; i < rolls; i++) total += heroDamage(w, (i + 0.5) / rolls);
  return total / rolls;
}

describe("Strength", () => {
  it("adds 1% damage a point", () => {
    const w = world(1, UNSPENT);
    spend(w, "strength", 10);

    // 130% of 16.67–25.
    const [min, max] = damageRange(w);
    expect(min).toBeCloseTo(21.67, 2);
    expect(max).toBeCloseTo(32.5, 2);
  });

  it("raises the average hit with every single point", () => {
    const w = world(1, UNSPENT);
    const before = averageDamage(w);

    spend(w, "strength");

    // 1% of the 20.8 a hit averages before Strength.
    expect(averageDamage(w)).toBeCloseTo(before + 0.21, 1);
  });

  it("makes every hit deal its raised damage", () => {
    const w = world(1, { ...UNSPENT, strength: 120 });
    // 36.67–55, each hit rounded.
    const hits = kill(w, 1).filter((event) => event.type === "HitLanded");
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.damage).toBeGreaterThanOrEqual(37);
      expect(hit.damage).toBeLessThanOrEqual(55);
    }
  });
});

describe("Vitality", () => {
  it("adds 3 to both max and current Life a point", () => {
    const w = world(1, UNSPENT);
    w.hero.life = 50;

    spend(w, "vitality", 2);

    // 104 at Level 3, and 6 more.
    expect(maxLife(w)).toBe(110);
    expect(w.hero.life).toBe(56);
  });
});

describe("Dexterity", () => {
  it("raises Attack Rating and so the chance to hit", () => {
    const w = world(1, UNSPENT);
    const before = heroChanceToHit(w, { type: "skeleton", monsterLevel: 1 });

    spend(w, "dexterity", 10);

    expect(attackRating(w)).toBe(150);
    expect(
      heroChanceToHit(w, { type: "skeleton", monsterLevel: 1 }),
    ).toBeGreaterThan(before);
  });
});

describe("a spent point", () => {
  it("stays spent through Death and the return to Town", () => {
    const w = world(1, UNSPENT);
    spend(w, "vitality", 10);

    let died = false;
    for (let i = 0; !died; i++) {
      if (i > 60 * 60) throw new Error("The Hero didn't die");
      died = step(w, []).some((event) => event.type === "HeroDied");
    }
    for (let i = 0; i < 60; i++) step(w, []);
    step(w, [{ type: "Continue" }]);
    while (w.areaChange !== null) step(w, []);

    expect(progressOf(w)).toMatchObject({ vitality: 30, attributePoints: 0 });
    expect(w.hero.life).toBe(134);
  });
});
