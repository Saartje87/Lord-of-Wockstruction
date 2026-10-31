import { describe, expect, it } from "vitest";
import { affixTuning, blockTuning, itemTuning } from "../tuning/items";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import {
  createWorld,
  heroBlockChance,
  isInCombat,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start`, `S` one Skeleton, `A` one Skeleton Archer and `B` one Bog
 * Spitter, each in the middle of its tile.
 */
function map(rows: string[], objects: object[] = []) {
  const width = rows[0].length;
  const height = rows.length;
  const all = [...objects];
  const spawn = (monster: string, x: number, y: number) => ({
    name: "",
    type: "monsterSpawn",
    point: true,
    x: (x + 0.5) * 32,
    y: (y + 0.5) * 32,
    properties: [{ name: "monster", type: "string", value: monster }],
  });
  [...rows.join("")].forEach((cell, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    if (cell === "H") {
      all.push({
        name: "start",
        type: "entry",
        point: true,
        x: (x + 0.5) * 32,
        y: (y + 0.5) * 32,
      });
    }
    if (cell === "S") all.push(spawn("skeleton", x, y));
    if (cell === "A") all.push(spawn("skeleton_archer", x, y));
    if (cell === "B") all.push(spawn("bog_spitter", x, y));
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
      { type: "objectgroup", name: "objects", objects: all },
    ],
  };
}

/** An Off-hand Buckler with a Block Affix of `value`, or a plain one. */
function buckler(value?: number): Belongings["equipment"] {
  return {
    offHand: {
      type: "buckler",
      rarity: value === undefined ? "normal" : "magic",
      affixes: value === undefined ? [] : [{ kind: "block", grade: 0, value }],
    },
  };
}

function wearing(
  rows: string[],
  equipment: Belongings["equipment"],
  seed = 1,
): World {
  return createWorld({
    areas: { town: map(rows) },
    seed,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });
}

const isAttack = (event: SimEvent) =>
  event.type === "HeroHit" ||
  event.type === "Blocked" ||
  (event.type === "Missed" && event.target === "hero");

/** The events up to and including the first Monster attack on the Hero. */
function untilAttacked(w: World): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 60 * 15; i++) {
    const stepped = step(w, []);
    events.push(...stepped);
    if (stepped.some(isAttack)) return events;
  }
  throw new Error("No Monster attacked the Hero");
}

describe("Block chance", () => {
  it("is 0 with no Shield", () => {
    expect(heroBlockChance(wearing(["HS"], {}))).toBe(0);
  });

  it("is the Shield type's own chance, each type with its own in tuning", () => {
    expect(heroBlockChance(wearing(["HS"], buckler()))).toBe(
      itemTuning.buckler.block,
    );
    expect(itemTuning.towerShield.block).not.toBe(itemTuning.buckler.block);
  });

  it("adds the Shield's Block Affixes", () => {
    expect(heroBlockChance(wearing(["HS"], buckler(7)))).toBe(
      itemTuning.buckler.block + 7,
    );
  });

  it("never goes above the cap", () => {
    expect(heroBlockChance(wearing(["HS"], buckler(500)))).toBe(
      blockTuning.cap,
    );
  });

  it("is a Suffix of named grades that rolls only on Shields", () => {
    expect(affixTuning.block.side).toBe("suffix");
    expect(affixTuning.block.rollsOn).toEqual(["shield"]);
    expect(affixTuning.block.grades.map((g) => g.fromMonsterLevel)).toEqual([
      1, 5, 9,
    ]);
  });
});

describe("a Block", () => {
  // Capped chance 50% of attacks that would hit: use the cap for many samples.
  const capped = () => buckler(blockTuning.cap);

  it("stops about the Block chance of the attacks that would hit", () => {
    let blocked = 0;
    let hit = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const events = untilAttacked(wearing(["HS"], capped(), seed));
      if (events.some((e) => e.type === "Blocked")) blocked += 1;
      if (events.some((e) => e.type === "HeroHit")) hit += 1;
    }
    const share = blocked / (blocked + hit);
    expect(share).toBeGreaterThan(blockTuning.cap / 100 - 0.07);
    expect(share).toBeLessThan(blockTuning.cap / 100 + 0.07);
  });

  it("replays from a seed", () => {
    const run = () => untilAttacked(wearing(["HS"], capped(), 3));
    expect(run()).toEqual(run());
  });

  it("emits Blocked with no damage, no flinch and Bone Ward untouched", () => {
    let checked = 0;
    for (let seed = 1; seed <= 100 && checked < 10; seed++) {
      const w = wearing(["HS"], capped(), seed);
      w.hero.boneWard = { left: 20, full: 20 };
      const life = w.hero.life;
      const events = untilAttacked(w);
      if (!events.some((e) => e.type === "Blocked")) continue;
      checked += 1;
      expect(events.some((e) => e.type === "HeroHit")).toBe(false);
      expect(w.hero.life).toBe(life);
      expect(w.hero.flinch).toBe(0);
      expect(w.hero.boneWard?.left).toBe(20);
    }
    expect(checked).toBe(10);
  });

  it("keeps the Hero In Combat", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const w = wearing(["HS"], capped(), seed);
      if (!untilAttacked(w).some((e) => e.type === "Blocked")) continue;
      expect(isInCombat(w)).toBe(true);
      return;
    }
    throw new Error("Nothing was Blocked");
  });

  it("is never also a Miss", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const events = untilAttacked(wearing(["HS"], capped(), seed));
      const outcomes = events.filter(isAttack);
      expect(outcomes).toHaveLength(1);
    }
  });

  it("stops an arrow and a spell Projectile too", () => {
    for (const rows of [["H.......A"], ["H.......B"]]) {
      let blocked = false;
      for (let seed = 1; seed <= 60 && !blocked; seed++) {
        const events = untilAttacked(wearing(rows, capped(), seed));
        blocked = events.some((e) => e.type === "Blocked");
      }
      expect(blocked).toBe(true);
    }
  });
});
