import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, SAVE_VERSION } from "../save";
import { AFFIX_KINDS, type AffixKind, affixOf } from "../tuning/items";
import { rollItem } from "./affixes";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import { createRng } from "./random";
import {
  createWorld,
  damageRange,
  FRESH_PROGRESS,
  heroAttackDamage,
  type World,
} from "./world";

const DAMAGE_KINDS = [
  "fireDamage",
  "coldDamage",
  "lightningDamage",
] as const satisfies readonly AffixKind[];

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

/** A Hero with an axe of `affixes`, each `[kind, low, high]`. */
function wielding(...affixes: [AffixKind, number, number][]): World {
  return createWorld({
    areas: { town },
    seed: 7,
    belongings: {
      inventory: [],
      equipment: {
        weapon: {
          type: "axe",
          rarity: "magic",
          affixes: affixes.map(([kind, value, high]) => ({
            kind,
            grade: 2,
            value,
            high,
          })),
        },
      },
      belt: emptyBelt(),
    },
  });
}

describe("the elemental damage Suffix tuning", () => {
  it("gives each grade a range for its low end and one for its high end", () => {
    for (const kind of DAMAGE_KINDS) {
      for (const grade of affixOf(kind).grades) {
        expect(grade.highRange).toBeDefined();
        expect(grade.highRange?.[1]).toBeGreaterThan(grade.range[1]);
      }
    }
  });

  it("gives no other Affix a high end", () => {
    for (const kind of AFFIX_KINDS) {
      if ((DAMAGE_KINDS as readonly string[]).includes(kind)) continue;
      for (const grade of affixOf(kind).grades) {
        expect(grade.highRange).toBeUndefined();
      }
    }
  });
});

describe("rolling an elemental damage Suffix", () => {
  it("rolls a low and a high inside the grade's ranges, low at most high", () => {
    const rng = createRng(3);
    let seen = 0;
    for (let i = 0; i < 600; i++) {
      for (const affix of rollItem(rng, "axe", 9).affixes) {
        const grade = affixOf(affix.kind).grades[affix.grade];
        if (!grade.highRange) {
          expect(affix.high).toBeUndefined();
          continue;
        }
        seen++;
        expect(affix.value).toBeGreaterThanOrEqual(grade.range[0]);
        expect(affix.value).toBeLessThanOrEqual(grade.range[1]);
        expect(affix.high).toBeGreaterThanOrEqual(grade.highRange[0]);
        expect(affix.high).toBeLessThanOrEqual(grade.highRange[1]);
        expect(affix.value).toBeLessThanOrEqual(affix.high as number);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
});

describe("a drop with no elemental damage Suffix", () => {
  it("rolls the same as before damage ranges, seed by seed", () => {
    // Taken from the rolls before an elemental damage Suffix had a high end.
    const before = [
      { seed: 1, rarity: "normal", affixes: [] },
      {
        seed: 2,
        rarity: "magic",
        affixes: [{ kind: "brutality", grade: 1, value: 6 }],
      },
      {
        seed: 3,
        rarity: "magic",
        affixes: [{ kind: "accuracy", grade: 1, value: 30 }],
      },
      {
        seed: 4,
        rarity: "magic",
        affixes: [{ kind: "accuracy", grade: 0, value: 15 }],
      },
    ];
    for (const { seed, ...expected } of before) {
      expect(rollItem(createRng(seed), "axe", 9)).toEqual(expected);
    }
  });
});

describe("the Hero's attack with an elemental Suffix", () => {
  it("rolls the Element's amount between low and high, both ends occurring", () => {
    const w = wielding(["fireDamage", 2, 5]);
    const fires = new Set<number>();
    for (let i = 0; i < 400; i++) {
      fires.add(heroAttackDamage(w, 0.5).fire as number);
    }
    expect([...fires].sort()).toEqual([2, 3, 4, 5]);
  });

  it("adds each Element's low and high to the damage range, unscaled", () => {
    const [min, max] = damageRange(
      wielding(["fireDamage", 2, 5], ["coldDamage", 1, 1]),
    );
    expect(min).toBeCloseTo(30 + 3);
    expect(max).toBeCloseTo(48 + 6);
  });

  it("is repeatable from the same seed", () => {
    const run = () => {
      const w = wielding(["fireDamage", 2, 5]);
      return Array.from({ length: 20 }, () => heroAttackDamage(w, 0.5).fire);
    };
    expect(run()).toEqual(run());
  });
});

describe("the Save of a damage range", () => {
  const belongings: Belongings = {
    inventory: [],
    equipment: {
      weapon: {
        type: "axe",
        rarity: "magic",
        affixes: [{ kind: "fireDamage", grade: 1, value: 5, high: 10 }],
      },
    },
    belt: emptyBelt(),
  };
  const textOf = () =>
    JSON.parse(
      encodeSave({
        progress: { ...FRESH_PROGRESS, smithService: "locked" },
        belongings,
      }),
    );

  it("keeps both values", () => {
    expect(parseSave(JSON.stringify(textOf()))?.belongings).toEqual(belongings);
  });

  it("loads an older Save's single value v as v to v", () => {
    const old = textOf();
    old.version = SAVE_VERSION - 1;
    old.equipment.weapon.affixes = [{ kind: "fireDamage", grade: 1, value: 6 }];
    expect(
      parseSave(JSON.stringify(old))?.belongings.equipment.weapon?.affixes,
    ).toEqual([{ kind: "fireDamage", grade: 1, value: 6, high: 6 }]);
  });

  it("refuses a low above the high, and a low or high outside its grade", () => {
    const swapped = textOf();
    Object.assign(swapped.equipment.weapon.affixes[0], { value: 8, high: 7 });
    expect(parseSave(JSON.stringify(swapped))).toBeNull();

    const lowOut = textOf();
    lowOut.equipment.weapon.affixes[0].value = 9;
    expect(parseSave(JSON.stringify(lowOut))).toBeNull();

    const highOut = textOf();
    highOut.equipment.weapon.affixes[0].high = 99;
    expect(parseSave(JSON.stringify(highOut))).toBeNull();

    const missing = textOf();
    delete missing.equipment.weapon.affixes[0].high;
    expect(parseSave(JSON.stringify(missing))).toBeNull();
  });

  it("refuses a high on an Affix that has none", () => {
    const text = textOf();
    text.equipment.weapon.affixes = [
      { kind: "brutality", grade: 0, value: 2, high: 3 },
    ];
    expect(parseSave(JSON.stringify(text))).toBeNull();
  });
});
