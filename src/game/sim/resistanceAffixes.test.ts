import { describe, expect, it } from "vitest";
import {
  type AffixKind,
  affixOf,
  ITEM_TYPES,
  type ItemKind,
  type ItemType,
  itemOf,
} from "../tuning/items";
import { monsterTuning } from "../tuning/monsters";
import { itemTitle, rollItem } from "./affixes";
import { emptyBelt } from "./belt";
import { type Belongings, inventoryOf } from "./inventory";
import { newMinion } from "./minions";
import { createRng } from "./random";
import {
  createWorld,
  heroResistance,
  type SimEvent,
  step,
  type World,
} from "./world";

const RESISTANCE_KINDS = [
  "fireResistance",
  "coldResistance",
  "lightningResistance",
  "allResistances",
] as const satisfies readonly AffixKind[];

const isResistance = (kind: string) =>
  (RESISTANCE_KINDS as readonly string[]).includes(kind);

const ROLLS_ON: ItemKind[] = [
  "armour",
  "helm",
  "gloves",
  "boots",
  "shield",
  "belt",
  "ring",
  "amulet",
];

describe("the Resistance Affix kinds", () => {
  it("are Prefixes with three graded names each", () => {
    const names = RESISTANCE_KINDS.map((kind) => [
      kind,
      affixOf(kind).side,
      affixOf(kind).grades.map((grade) => grade.name),
    ]);
    expect(names).toEqual([
      ["fireResistance", "prefix", ["Ruby", "Garnet", "Bloodstone"]],
      ["coldResistance", "prefix", ["Sapphire", "Azurite", "Glacial"]],
      ["lightningResistance", "prefix", ["Amber", "Topaz", "Stormglass"]],
      ["allResistances", "prefix", ["Shimmering", "Prismatic", "Wockstone"]],
    ]);
  });

  it("are gated at Monster Level 1, 5 and 9", () => {
    for (const kind of RESISTANCE_KINDS) {
      expect(affixOf(kind).grades.map((g) => g.fromMonsterLevel)).toEqual([
        1, 5, 9,
      ]);
    }
  });

  it("roll on Armour, Helms, Gloves, Boots, Shields, Belts, Rings and Amulets only", () => {
    for (const kind of RESISTANCE_KINDS) {
      expect([...affixOf(kind).rollsOn].sort()).toEqual([...ROLLS_ON].sort());
    }
  });

  it("give All Resistances lower ranges than the single Elements", () => {
    for (let grade = 0; grade < 3; grade++) {
      expect(affixOf("allResistances").grades[grade].range[1]).toBeLessThan(
        affixOf("coldResistance").grades[grade].range[1],
      );
    }
  });
});

const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

type Wear = Belongings["equipment"];

/** A Magic Item of `type` with the one Resistance Affix `kind` worth `value`. */
const resisting = (type: ItemType, kind: AffixKind, value: number) => ({
  type,
  rarity: "magic" as const,
  affixes: [{ kind, grade: 2, value }],
});

function wearing(equipment: Wear): World {
  return createWorld({
    areas: { town },
    seed: 1,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });
}

describe("the Hero's Resistance", () => {
  it("is 0 with nothing Equipped", () => {
    const w = wearing({});
    for (const element of ["fire", "cold", "lightning"] as const) {
      expect(heroResistance(w, element)).toEqual({ total: 0, effective: 0 });
    }
  });

  it("adds an Element's Affixes, and All Resistances to each Element", () => {
    const w = wearing({
      helm: resisting("leatherCap", "coldResistance", 12),
      armour: resisting("leatherArmour", "coldResistance", 20),
      ring1: resisting("ring", "allResistances", 7),
      amulet: resisting("amulet", "fireResistance", 9),
    });
    expect(heroResistance(w, "cold")).toEqual({ total: 39, effective: 39 });
    expect(heroResistance(w, "fire")).toEqual({ total: 16, effective: 16 });
    expect(heroResistance(w, "lightning")).toEqual({ total: 7, effective: 7 });
  });

  it("changes as Items are Equipped and taken off", () => {
    const w = createWorld({
      areas: { town },
      seed: 1,
      belongings: {
        inventory: [
          {
            ...resisting("ring", "fireResistance", 10),
            cell: { column: 0, row: 0 },
          },
        ],
        equipment: {},
        belt: emptyBelt(),
      },
    });
    const id = inventoryOf(w)[0].item.id;
    step(w, [{ type: "EquipItem", item: id }]);
    expect(heroResistance(w, "fire").total).toBe(10);
    step(w, [{ type: "UnequipItem", slot: "ring1" }]);
    expect(heroResistance(w, "fire").total).toBe(0);
  });

  it("is capped at 75% in effect while the total above it still counts", () => {
    const w = wearing({
      helm: resisting("leatherCap", "coldResistance", 30),
      armour: resisting("leatherArmour", "coldResistance", 30),
      boots: resisting("leatherBoots", "coldResistance", 30),
    });
    expect(heroResistance(w, "cold")).toEqual({ total: 90, effective: 75 });
  });
});

/** An Area for a strip of cells: `H` the Hero, `B` a Bog Spitter, `S` a Skeleton. */
function strip(row: string) {
  const objects: object[] = [];
  [...row].forEach((cell, i) => {
    const x = (i + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y: 16 });
    }
    if (cell === "B" || cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y: 16,
        properties: [
          {
            name: "monster",
            type: "string",
            value: cell === "B" ? "bog_spitter" : "skeleton",
          },
        ],
      });
    }
  });
  return {
    orientation: "orthogonal",
    width: row.length,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: row.length,
        height: 1,
        data: new Array(row.length).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/** A World in the strip `row` with the Hero wearing `equipment`. */
function inStrip(row: string, equipment: Wear, seed = 3): World {
  return createWorld({
    areas: { town: strip(row) },
    seed,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });
}

/** Steps until the Hero is hit by something, returning that event. */
function firstHit(w: World): Extract<SimEvent, { type: "HeroHit" }> {
  for (let i = 0; i < 60 * 20; i++) {
    for (const event of step(w, [])) {
      if (event.type === "HeroHit") return event;
    }
  }
  throw new Error("The Hero was never hit");
}

describe("Muck on the Hero", () => {
  const MUCK = "H.....B....";
  const hitWith = (equipment: Wear) => firstHit(inStrip(MUCK, equipment));
  const SLOTS = [
    ["ring1", "ring"],
    ["ring2", "ring"],
    ["amulet", "amulet"],
    ["belt", "sash"],
  ] as const;
  /** Cold Resistance Items worth `values`, one per slot. */
  const cold = (...values: number[]): Wear =>
    Object.fromEntries(
      values.map((value, i) => [
        SLOTS[i][0],
        resisting(SLOTS[i][1], "coldResistance", value),
      ]),
    );

  it("deals Cold damage", () => {
    expect(hitWith({}).damageType).toBe("cold");
    expect(monsterTuning.bog_spitter.damageTypes).toEqual({ cold: 1 });
  });

  it("is reduced by the effective Cold Resistance at 0%, 50%, 75% and above the cap", () => {
    const base = hitWith({}).damage;
    expect(base).toBeGreaterThan(4);
    expect(hitWith(cold(25, 25)).damage).toBe(Math.round(base * 0.5));
    expect(hitWith(cold(30, 30, 15)).damage).toBe(Math.round(base * 0.25));
    expect(hitWith(cold(30, 30, 30, 30)).damage).toBe(Math.round(base * 0.25));
  });

  it("is not reduced by Fire or Lightning Resistance", () => {
    const base = hitWith({}).damage;
    expect(
      hitWith({
        ring1: resisting("ring", "fireResistance", 30),
        ring2: resisting("ring", "lightningResistance", 30),
      }).damage,
    ).toBe(base);
  });

  it("is reduced before Bone Ward soaks the rest", () => {
    const gear = cold(30, 20);
    const reduced = hitWith(gear).damage;
    const w = inStrip(MUCK, gear);
    w.hero.boneWard = { left: 2, full: 2 };
    const hit = firstHit(w);
    expect(hit.warded).toBe(2);
    expect(hit.damage + hit.warded).toBe(reduced);
  });
});

describe("Physical hits on the Hero", () => {
  it("are unchanged by any Resistance", () => {
    const base = firstHit(inStrip("H..S", {}, 5));
    expect(base.damageType).toBe("physical");
    const resistant = firstHit(
      inStrip(
        "H..S",
        {
          ring1: resisting("ring", "allResistances", 15),
          ring2: resisting("ring", "coldResistance", 30),
        },
        5,
      ),
    );
    expect(resistant.damage).toBe(base.damage);
  });
});

describe("Minions and the Hero's Resistance", () => {
  it("take Muck by their own Resistance whatever the Hero wears", () => {
    const hitOn = (equipment: Wear) => {
      const w = inStrip("H.B", equipment);
      w.minions.push(
        newMinion(
          90,
          "raisedSkeleton",
          "raiseSkeleton",
          1,
          { ...w.hero.pos },
          0,
        ),
      );
      for (let i = 0; i < 60 * 20; i++) {
        for (const event of step(w, [])) {
          if (event.type === "MinionHit" && event.minion === 90) return event;
        }
      }
      throw new Error("The Minion was never hit");
    };
    const bare = hitOn({});
    expect(bare.damageType).toBe("cold");
    const geared = hitOn({
      ring1: resisting("ring", "coldResistance", 30),
      ring2: resisting("ring", "coldResistance", 30),
      amulet: resisting("amulet", "coldResistance", 30),
    });
    expect(geared.damage).toBe(bare.damage);
  });
});

describe("rolling the Resistance Affixes", () => {
  const rollMany = (type: ItemType, monsterLevel: number, count = 400) => {
    const rng = createRng(11);
    return Array.from({ length: count }, () =>
      rollItem(rng, type, monsterLevel),
    );
  };

  it("roll only on the Item kinds they suit", () => {
    for (const type of ITEM_TYPES) {
      const kind = itemOf(type).kind;
      for (const roll of rollMany(type, 9, 200)) {
        for (const affix of roll.affixes) {
          if (isResistance(affix.kind)) expect(ROLLS_ON).toContain(kind);
        }
      }
    }
  });

  it("roll only grades the Monster Level reaches, with values inside the grade's range, never twice on an Item", () => {
    for (const level of [1, 5, 9]) {
      let seen = 0;
      for (const type of ["leatherCap", "ring", "amulet", "buckler"] as const) {
        for (const roll of rollMany(type, level)) {
          const kinds = roll.affixes.map((a) => a.kind);
          expect(new Set(kinds).size).toBe(kinds.length);
          for (const affix of roll.affixes) {
            if (!isResistance(affix.kind)) continue;
            seen++;
            const grade = affixOf(affix.kind).grades[affix.grade];
            expect(grade.fromMonsterLevel).toBeLessThanOrEqual(level);
            expect(affix.value).toBeGreaterThanOrEqual(grade.range[0]);
            expect(affix.value).toBeLessThanOrEqual(grade.range[1]);
          }
        }
      }
      expect(seen).toBeGreaterThan(0);
    }
  });

  it("roll All Resistances rarer than any single Element's", () => {
    const counts: Record<string, number> = {};
    for (const roll of rollMany("ring", 9, 4000)) {
      for (const affix of roll.affixes) {
        counts[affix.kind] = (counts[affix.kind] ?? 0) + 1;
      }
    }
    expect(counts.allResistances).toBeGreaterThan(0);
    for (const kind of [
      "fireResistance",
      "coldResistance",
      "lightningResistance",
    ]) {
      expect(counts.allResistances).toBeLessThan(counts[kind] * 0.6);
    }
  });

  it("names a Magic Item by the grade", () => {
    expect(
      itemTitle({
        type: "leatherCap",
        affixes: [{ kind: "coldResistance", grade: 1, value: 14 }],
      }),
    ).toBe("Azurite Leather Cap");
  });
});
