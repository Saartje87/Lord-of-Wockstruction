import { afterEach, describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { skillTuning } from "../tuning/skills";
import { newMinion } from "./minions";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { validateResistances } from "./validate";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `S` one Skeleton and `Z` one Zombie, each in the middle of its
 * tile. It is a Combat Area of Area Level 1.
 */
function map(rows: string[], areaLevel: number | null = 1) {
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
    if (cell === "S") objects.push(spawn("skeleton", x, y));
    if (cell === "Z") objects.push(spawn("zombie", x, y));
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

/** A World in a field of Area Level 1 drawn as `rows`, the Hero at its `H`. */
function inField(rows: string[], progress?: Progress): World {
  return createWorld({
    areas: { town: map(["H"], null), field: map(rows) },
    seed: 1,
    progress,
    start: { area: "field", entry: "start" },
  });
}

const original = {
  skeleton: structuredClone(monsterTuning.skeleton),
  explosion: structuredClone(skillTuning.corpseExplosion),
};

afterEach(() => {
  Object.assign(monsterTuning.skeleton, original.skeleton);
  Object.assign(skillTuning.corpseExplosion, original.explosion);
});

/** A Skeleton that hits for exactly `damage`, with the Damage Types given. */
function skeletonDealing(damage: number, damageTypes?: Record<string, number>) {
  monsterTuning.skeleton.damage = [damage, damage];
  (monsterTuning.skeleton as { damageTypes?: unknown }).damageTypes =
    damageTypes;
}

/** A World with one Skeleton right by the Hero and a Raised Skeleton or Golem. */
function skirmish(kind?: "raisedSkeleton" | "golem" | "raisedArcher"): World {
  const w = inField(["HS......."]);
  if (kind) {
    const minion = newMinion(
      90,
      kind,
      kind === "golem" ? "golem" : "raiseSkeleton",
      1,
      { x: 1.2, y: 0.5 },
      0,
    );
    minion.life = 100000;
    w.minions.push(minion);
  }
  return w;
}

/** Steps until `done` finds an event, failing after ten seconds. */
function until<Found extends SimEvent>(
  w: World,
  pick: (event: SimEvent) => event is Found,
  orders = [],
): Found {
  for (let i = 0; i < 60 * 10; i++) {
    const found = step(w, orders).find(pick);
    if (found) return found;
  }
  throw new Error("Never happened");
}

const isHeroHit = (e: SimEvent): e is Extract<SimEvent, { type: "HeroHit" }> =>
  e.type === "HeroHit";
const isMinionHit = (
  e: SimEvent,
): e is Extract<SimEvent, { type: "MinionHit" }> => e.type === "MinionHit";

/** A skirmish in which the Skeleton fights only the Minion, not the Hero. */
function minionFight(kind: "raisedSkeleton" | "golem" | "raisedArcher") {
  const w = skirmish(kind);
  w.hero.pos = { x: 8.5, y: 0.5 };
  w.hero.prevPos = { ...w.hero.pos };
  const [skeleton] = w.monsters;
  skeleton.target = 90;
  return w;
}

describe("a Monster's hit on the Hero", () => {
  it("is all Physical by default", () => {
    skeletonDealing(10);
    const hit = until(skirmish(), isHeroHit);
    expect(hit.damage).toBe(10);
    expect(hit.damageType).toBe("physical");
  });

  it("names the Element that made up most of it", () => {
    skeletonDealing(10, { physical: 0.3, fire: 0.7 });
    expect(until(skirmish(), isHeroHit).damageType).toBe("fire");
    skeletonDealing(10, { cold: 0.6, lightning: 0.4 });
    expect(until(skirmish(), isHeroHit).damageType).toBe("cold");
    skeletonDealing(10, { cold: 0.2, lightning: 0.8 });
    expect(until(skirmish(), isHeroHit).damageType).toBe("lightning");
  });

  it("gives a tie to Physical, then Fire, then Cold, then Lightning", () => {
    skeletonDealing(10, { physical: 0.5, lightning: 0.5 });
    expect(until(skirmish(), isHeroHit).damageType).toBe("physical");
    skeletonDealing(10, { fire: 0.5, lightning: 0.5 });
    expect(until(skirmish(), isHeroHit).damageType).toBe("fire");
    skeletonDealing(10, { cold: 0.5, lightning: 0.5 });
    expect(until(skirmish(), isHeroHit).damageType).toBe("cold");
  });

  it("deals the whole of every share, as the Hero has no Resistance", () => {
    skeletonDealing(10, { physical: 0.5, cold: 0.5 });
    expect(until(skirmish(), isHeroHit).damage).toBe(10);
  });
});

describe("a Monster's hit on a Minion", () => {
  it("takes a Raised Skeleton's Cold Resistance off the Cold part, as a Skeleton's", () => {
    skeletonDealing(20, { cold: 1 });
    const hit = until(minionFight("raisedSkeleton"), isMinionHit);
    // Cold +25%.
    expect(hit.damage).toBe(15);
    expect(hit.damageType).toBe("cold");
  });

  it("leaves Physical untouched", () => {
    skeletonDealing(20);
    expect(until(minionFight("golem"), isMinionHit).damage).toBe(20);
  });

  it("takes a Golem's Lightning +50% off Lightning", () => {
    skeletonDealing(20, { lightning: 1 });
    expect(until(minionFight("golem"), isMinionHit).damage).toBe(10);
  });

  it("adds a negative Resistance to the Element's damage", () => {
    skeletonDealing(20, { fire: 1 });
    monsterTuning.skeleton.damageTypes = { fire: 1 };
    // Golem and Raised Skeletons have no Fire Resistance, so give the Golem some.
    const golem = minionTuning.golem as { resistances?: unknown };
    const was = golem.resistances;
    golem.resistances = { fire: -50 };
    try {
      expect(until(minionFight("golem"), isMinionHit).damage).toBe(30);
    } finally {
      golem.resistances = was;
    }
  });

  it("takes the Weakened share of every Damage Type in the hit", () => {
    skeletonDealing(20, { physical: 0.5, cold: 0.5 });
    const w = minionFight("raisedSkeleton");
    w.monsters[0].curse = { skill: "weaken", left: 100000 };
    const weakened = skillTuning.weaken.effect;
    if (weakened.type !== "curse" || weakened.kind !== "weaken") {
      throw new Error("Weaken is no Curse");
    }
    // 20 * 0.6 = 12: 6 Physical and 6 Cold, which comes to 4.5 after +25%.
    expect(weakened.damageDealt).toBe(0.6);
    expect(until(w, isMinionHit).damage).toBe(11);
  });
});

describe("Monster and Minion Resistances", () => {
  const table: Record<MonsterType, [number, number, number]> = {
    skeleton: [0, 25, 0],
    skeleton_archer: [0, 25, 0],
    zombie: [-25, 25, 0],
    wockwolf: [0, 25, 0],
    bog_spitter: [-50, 0, 25],
    wockbrute: [0, 0, 0],
    grave_wockington: [50, 0, 0],
  };

  it("start from the spec's table, a missing one counting as 0", () => {
    for (const [type, [fire, cold, lightning]] of Object.entries(table)) {
      const resistances = monsterTuning[type as MonsterType].resistances ?? {};
      expect(
        [
          resistances.fire ?? 0,
          resistances.cold ?? 0,
          resistances.lightning ?? 0,
        ],
        type,
      ).toEqual([fire, cold, lightning]);
    }
    expect(minionTuning.golem.resistances?.lightning).toBe(50);
  });

  it("are the Monster type's for a Raised Skeleton and a Raised Archer", () => {
    expect(minionTuning.raisedSkeleton.resistancesOf).toBe("skeleton");
    expect(minionTuning.raisedArcher.resistancesOf).toBe("skeleton_archer");
  });

  it("are rejected by validation at 100 or more", () => {
    expect(() =>
      validateResistances({ a: { resistances: { fire: 100 } } }),
    ).toThrow(/a.*fire.*below 100/);
    expect(() =>
      validateResistances({ a: { resistances: { cold: 150 } } }),
    ).toThrow();
    expect(() =>
      validateResistances({ a: { resistances: { cold: 99, fire: -200 } } }),
    ).not.toThrow();
    expect(() => validateResistances({ a: {} })).not.toThrow();
  });

  it("pass validation as shipped", () => {
    expect(() => validateResistances(monsterTuning)).not.toThrow();
    expect(() => validateResistances(minionTuning)).not.toThrow();
  });
});

describe("Corpse Explosion's Damage Types", () => {
  const necromancer = () => {
    const level = 4;
    return {
      ...FRESH_PROGRESS,
      level,
      experience: heroTuning.experienceTable[level - 1],
      energy: FRESH_PROGRESS.energy + 5 * (level - 1),
      skillPoints: 2,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, corpseExplosion: 1 },
      skillBar: { ...emptySkillBar(), right: "corpseExplosion" as const },
    };
  };

  /** One burst of a Monster Level 3 Skeleton's Corpse on a lone victim. */
  function burstOn(
    type: MonsterType,
    { monsterLevel = 3, curse = false } = {},
  ) {
    const w = inField(["H.S"], necromancer());
    const [victim] = w.monsters;
    victim.type = type;
    victim.monsterLevel = monsterLevel;
    victim.life = 100000;
    victim.pos = { x: 2.5, y: 0.5 };
    victim.prevPos = { ...victim.pos };
    if (curse) victim.curse = { skill: "amplifyDamage", left: 100000 };
    w.corpses.push({
      id: w.nextMonsterId++,
      type: "skeleton",
      monsterLevel: 3,
      pos: { x: 2.5, y: 0.5 },
    });
    const events = step(w, [
      { type: "Cast", slot: "right", target: { x: 2.5, y: 0.5 } },
    ]);
    const hit = events.find((event) => event.type === "HitLanded");
    if (hit?.type !== "HitLanded") throw new Error("No hit");
    return hit;
  }

  it("is half Physical and half Fire, a tie the main Damage Type gives to Physical", () => {
    const hit = burstOn("skeleton");
    expect(hit.damageType).toBe("physical");
  });

  it("hurts a Zombie, which burns, a bit more than a Skeleton", () => {
    const skeleton = burstOn("skeleton");
    const zombie = burstOn("zombie");

    expect(zombie.damage).toBeGreaterThan(skeleton.damage);
    // Fire -25%: half the roll, a quarter more.
    expect(zombie.damage).toBe(Math.round(skeleton.damage * 1.125));
    // More Fire than Physical now.
    expect(zombie.damageType).toBe("fire");
  });

  it("hurts a Bog Spitter, which burns twice as much, more still", () => {
    const skeleton = burstOn("skeleton");
    expect(burstOn("bog_spitter").damage).toBe(
      Math.round(skeleton.damage * 1.25),
    );
  });

  it("hurts Grave Wockington, who shrugs off Fire, less", () => {
    const skeleton = burstOn("skeleton");
    const boss = burstOn("grave_wockington");
    expect(boss.damage).toBe(Math.round(skeleton.damage * 0.75));
    expect(boss.damageType).toBe("physical");
  });

  it("hurts a Monster the same at every Monster Level", () => {
    expect(burstOn("zombie", { monsterLevel: 9 }).damage).toBe(
      burstOn("zombie", { monsterLevel: 1 }).damage,
    );
  });

  it("is multiplied by Amplify Damage after Resistance, rounded once", () => {
    const skeleton = burstOn("skeleton");
    const effect = skillTuning.amplifyDamage.effect;
    if (effect.type !== "curse" || effect.kind !== "amplifyDamage") {
      throw new Error("Amplify Damage is no Curse");
    }
    expect(effect.damageTaken).toBe(1.5);
    // (R/2 + R/2 * 1.25) * 1.5, with no rounding in between.
    expect(burstOn("zombie", { curse: true }).damage).toBe(
      Math.round(skeleton.damage * 1.125 * 1.5),
    );
  });

  it("can be tuned to another share of Fire", () => {
    skillTuning.corpseExplosion.effect = {
      ...(skillTuning.corpseExplosion.effect as object),
      damageTypes: { physical: 0.2, fire: 0.8 },
    } as never;
    expect(burstOn("skeleton").damageType).toBe("fire");
  });
});
