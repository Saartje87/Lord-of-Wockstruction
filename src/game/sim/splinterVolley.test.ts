import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { branchSkills, type Skill, skillTuning } from "../tuning/skills";
import type { HeroProjectile } from "./projectiles";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Monster,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `A` an Entry named `arrive`, `S` one Skeleton and `E` an Exit to
 * the other Area's `arrive`, each in the middle of its tile. A Combat Area
 * has `areaLevel`; Town has none.
 */
function map(rows: string[], exitTo: string, areaLevel: number | null) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "A") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [{ name: "monster", type: "string", value: "skeleton" }],
      });
    }
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

/**
 * A Hero who spent a Skill Point a Level from Level 6 on Splinter Volley, on the
 * right-click slot, with plenty of Mana and the 4 Skill Points from before
 * Level 6 unspent.
 */
function necromancer(levels: Partial<Record<Skill, number>> = {}): Progress {
  const level = 10;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    energy: FRESH_PROGRESS.energy + 5 * (level - 1),
    skillPoints: 4,
    skillLevels: {
      ...FRESH_PROGRESS.skillLevels,
      splinterVolley: 1,
      ...levels,
    },
    skillBar: { ...emptySkillBar(), right: "splinterVolley" },
  };
}

/**
 * Town by an Exit to `field`, a Combat Area of `areaLevel`: by default 8,
 * where a Skeleton outlasts a spear's hit.
 */
function areas(field: string[], areaLevel = 8) {
  return {
    town: map(["HAE"], "field", null),
    field: map(field, "town", areaLevel),
  };
}

const FIELD = areas([
  "EA..................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "H................SSS",
]);

/** Steps with no orders until `done`, failing after `limit` steps. */
function stepUntil(w: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, []));
  }
  return events;
}

/**
 * A World with the Hero just arrived in `field`, moved to `hero`, and its
 * Skeletons standing still at `at`, the rest far off.
 */
function inField(
  at: Vec[],
  {
    hero = { x: 2, y: 4 },
    progress = necromancer(),
    field = FIELD,
    seed = 1,
  } = {},
): World {
  const w = createWorld({ areas: field, seed, progress });
  step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  w.hero.pos = { ...hero };
  w.hero.prevPos = { ...hero };
  w.monsters.forEach((monster, i) => {
    const pos = at[i] ?? { x: 19.5, y: 7.5 };
    monster.pos = { ...pos };
    monster.prevPos = { ...pos };
    monster.home = { ...pos };
  });
  return w;
}

/** Casts Splinter Volley at `target`, the step's events. */
function volleyAt(w: World, target: Vec): SimEvent[] {
  return step(w, [{ type: "Cast", slot: "right", target }]);
}

/** How many times each Monster was hit in `events`, by id. */
function hitsOn(events: SimEvent[]): Map<Monster["id"], number[]> {
  const hits = new Map<Monster["id"], number[]>();
  for (const event of events) {
    if (event.type !== "HitLanded") continue;
    hits.set(event.target, [...(hits.get(event.target) ?? []), event.damage]);
  }
  return hits;
}

const originalVolley = structuredClone(skillTuning.splinterVolley);
const originalSpear = structuredClone(skillTuning.boneSpear);
afterEach(() => {
  skillTuning.splinterVolley = structuredClone(originalVolley);
  skillTuning.boneSpear = structuredClone(originalSpear);
});

/** Splinter Volley's effect, failing if it is not a volley. */
function volley() {
  const { effect } = skillTuning.splinterVolley;
  if (effect.type !== "volley") throw new Error("Not a volley");
  return effect;
}

/** The shards in flight. */
function shards(w: World): HeroProjectile[] {
  return w.projectiles.filter(
    (p): p is HeroProjectile => p.from === "hero" && p.kind === "splinter",
  );
}

/** Steps until no Projectile is left in flight, the events on the way. */
function untilSpent(w: World): SimEvent[] {
  return stepUntil(w, () => w.projectiles.length === 0);
}

describe("Splinter Volley in the Skill Tree", () => {
  it("sits after Bone Wall with Bone Wall as its Prerequisite", () => {
    expect(skillTuning.splinterVolley.branch).toBe("bone");
    expect(skillTuning.splinterVolley.prerequisite).toBe("boneWall");
    expect(branchSkills.bone.slice(-3, -1)).toEqual([
      "boneWall",
      "splinterVolley",
    ]);
  });
});

describe("casting Splinter Volley", () => {
  it("spends its Mana and looses the tuned number of shards in a fan centred on the cast point", () => {
    const w = inField([]);
    const mana = w.hero.mana;

    const events = volleyAt(w, { x: 5, y: 8 });

    expect(events).toContainEqual({
      type: "SkillCast",
      skill: "splinterVolley",
      target: { x: 5, y: 8 },
    });
    expect(w.hero.mana).toBeCloseTo(
      mana - skillTuning.splinterVolley.manaCost,
      0,
    );
    const loosed = shards(w);
    expect(loosed).toHaveLength(volley().shards);
    const centre = Math.atan2(4, 3);
    const off = loosed
      .map((p) => Math.atan2(p.direction.y, p.direction.x) - centre)
      .sort((a, b) => a - b);
    const half = (volley().spreadDegrees / 2) * (Math.PI / 180);
    expect(off[0]).toBeCloseTo(-half);
    expect(off[off.length - 1]).toBeCloseTo(half);
    expect(off.reduce((sum, angle) => sum + angle, 0)).toBeCloseTo(0);
    for (const shard of loosed) {
      expect(shard.from).toBe("hero");
      expect(shard.prevPos).toEqual({ x: 2, y: 4 });
    }
  });
});

describe("Splinter Volley's shards", () => {
  it("can each hit the same Monster up close, a shard hitting a Monster once", () => {
    const w = inField([{ x: 3, y: 4 }]);
    const [monster] = w.monsters;

    const events = volleyAt(w, { x: 10, y: 4 });
    events.push(...untilSpent(w));

    const hits = hitsOn(events).get(monster.id) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.length).toBeLessThanOrEqual(volley().shards);
  });

  it("fly through the Hero's Minions without hurting them", () => {
    const progress = necromancer();
    progress.skillLevels.golem = 1;
    progress.skillBar.key1 = "golem";
    const w = inField([{ x: 7, y: 4 }], { progress });
    step(w, [{ type: "Cast", slot: "key1", target: { x: 4, y: 4 } }]);
    stepUntil(w, () => !w.hero.cast);
    const [golem] = w.minions;
    golem.pos = { x: 3, y: 4 };
    const life = golem.life;

    const events = volleyAt(w, { x: 10, y: 4 });
    events.push(...untilSpent(w));

    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "MinionHit" }),
    );
    expect(golem.life).toBe(life);
    expect(hitsOn(events).get(w.monsters[0].id)?.length).toBeGreaterThan(0);
  });
});

describe("Splinter Volley's Synergy with Bone Spear", () => {
  it("grows each shard by the tuned % per Skill Level of Bone Spear", () => {
    const effect = volley();
    skillTuning.splinterVolley.effect = { ...effect, damage: [100, 100] };
    const synergy = skillTuning.splinterVolley.synergies.find(
      (s) => s.skill === "boneSpear",
    );
    if (!synergy) throw new Error("No Synergy with Bone Spear");
    const shardDamage = (boneSpear: number) => {
      const w = inField([], { progress: necromancer({ boneSpear }) });
      volleyAt(w, { x: 10, y: 4 });
      return shards(w)[0].damage[0];
    };
    expect(shardDamage(5)).toBe(
      Math.round(
        shardDamage(0) * (1 + (synergy.percentPerSkillLevel / 100) * 5),
      ),
    );
  });
});

describe("Bone Spear's Synergy with Splinter Volley", () => {
  it("grows the spear by the tuned % per Skill Level of Splinter Volley, off the Skill Bar", () => {
    const effect = skillTuning.boneSpear.effect;
    if (effect.type !== "projectile") throw new Error("Not a projectile");
    skillTuning.boneSpear.effect = { ...effect, damage: [100, 100] };
    const synergy = skillTuning.boneSpear.synergies.find(
      (s) => s.skill === "splinterVolley",
    );
    if (!synergy) throw new Error("No Synergy with Splinter Volley");
    const spearDamage = (splinterVolley: number) => {
      const progress = necromancer({ splinterVolley, boneSpear: 1 });
      progress.skillBar = { ...emptySkillBar(), right: "boneSpear" };
      const w = inField([], { progress });
      volleyAt(w, { x: 10, y: 4 });
      const [spear] = w.projectiles;
      if (spear?.from !== "hero") throw new Error("No Bone Spear");
      return spear.damage[0];
    };
    expect(spearDamage(5)).toBe(
      Math.round(
        spearDamage(0) * (1 + (synergy.percentPerSkillLevel / 100) * 5),
      ),
    );
  });
});
