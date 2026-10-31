import { describe, expect, it } from "vitest";
import { encodeSave, parseSave } from "../save";
import {
  type AffixKind,
  affixOf,
  ITEM_TYPES,
  type ItemKind,
  type ItemType,
  itemOf,
} from "../tuning/items";
import { itemTitle, rollItem } from "./affixes";
import { emptyBelt } from "./belt";
import type { Belongings } from "./inventory";
import { createRng } from "./random";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import {
  createWorld,
  damageRange,
  FRESH_PROGRESS,
  heroDamage,
  type SimEvent,
  step,
  type World,
} from "./world";

const SUFFIXES = [
  ["fireDamage", ["of Embers", "of Flames", "of the Furnace"]],
  ["coldDamage", ["of Frost", "of Ice", "of the Glacier"]],
  ["lightningDamage", ["of Sparks", "of Storms", "of Thunder"]],
] as const satisfies readonly (readonly [AffixKind, readonly string[]])[];

/** The Item kinds the Weapon Affixes roll on; a later ticket adds Wands. */
const WEAPONS: ItemKind[] = ["weapon"];

describe("the elemental damage Suffix kinds", () => {
  it("are Suffixes with three graded names each, gated at Monster Level 1, 5 and 9", () => {
    for (const [kind, names] of SUFFIXES) {
      expect(affixOf(kind).side).toBe("suffix");
      expect(affixOf(kind).grades.map((g) => g.name)).toEqual(names);
      expect(affixOf(kind).grades.map((g) => g.fromMonsterLevel)).toEqual([
        1, 5, 9,
      ]);
    }
  });

  it("roll on Weapons only", () => {
    for (const [kind] of SUFFIXES) {
      expect([...affixOf(kind).rollsOn]).toEqual(WEAPONS);
    }
  });

  it("name a Magic Item by the grade", () => {
    expect(
      itemTitle({
        type: "axe",
        affixes: [{ kind: "lightningDamage", grade: 0, value: 2 }],
      }),
    ).toBe("Axe of Sparks");
  });
});

describe("rolling the elemental damage Suffixes", () => {
  const rollMany = (type: ItemType, monsterLevel: number, count = 400) => {
    const rng = createRng(11);
    return Array.from({ length: count }, () =>
      rollItem(rng, type, monsterLevel),
    );
  };
  const isElemental = (kind: string) => SUFFIXES.some(([k]) => k === kind);

  it("roll only on Weapons", () => {
    let onWeapons = 0;
    for (const type of ITEM_TYPES) {
      const isWeapon = WEAPONS.includes(itemOf(type).kind);
      for (const roll of rollMany(type, 9, 200)) {
        for (const affix of roll.affixes) {
          if (!isElemental(affix.kind)) continue;
          expect(isWeapon).toBe(true);
          onWeapons++;
        }
      }
    }
    expect(onWeapons).toBeGreaterThan(0);
  });

  it("roll only grades the Monster Level reaches, inside the grade's range, never twice on an Item", () => {
    for (const level of [1, 5, 9]) {
      let seen = 0;
      for (const roll of rollMany("axe", level)) {
        const kinds = roll.affixes.map((a) => a.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
        for (const affix of roll.affixes) {
          if (!isElemental(affix.kind)) continue;
          seen++;
          const grade = affixOf(affix.kind).grades[affix.grade];
          expect(grade.fromMonsterLevel).toBeLessThanOrEqual(level);
          expect(affix.value).toBeGreaterThanOrEqual(grade.range[0]);
          expect(affix.value).toBeLessThanOrEqual(grade.range[1]);
        }
      }
      expect(seen).toBeGreaterThan(0);
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

/** An axe of `affixes`, each `[kind, value]`. */
const axe = (...affixes: [AffixKind, number][]) => ({
  type: "axe" as const,
  rarity: "magic" as const,
  affixes: affixes.map(([kind, value]) => ({ kind, grade: 2, value })),
});

function wearing(equipment: Wear, progress = FRESH_PROGRESS): World {
  return createWorld({
    areas: { town },
    seed: 1,
    progress,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });
}

describe("the Hero's attack damage", () => {
  it("adds the Elements' flat damage to both ends of the range, unscaled by Strength", () => {
    const plain = damageRange(wearing({ weapon: { type: "axe" } }));
    const [min, max] = damageRange(
      wearing({
        weapon: axe(
          ["fireDamage", 10],
          ["coldDamage", 5],
          ["lightningDamage", 3],
        ),
      }),
    );
    // 20 Strength scales Physical by 1.2 but not the 18 added.
    expect(plain).toEqual([30, 48]);
    expect(min).toBeCloseTo(30 + 18);
    expect(max).toBeCloseTo(48 + 18);
  });

  it("is not scaled by Strength or by enhanced damage %", () => {
    const stronger = wearing(
      { weapon: axe(["fireDamage", 10]) },
      { ...FRESH_PROGRESS, strength: 120 },
    );
    // 120 Strength scales Physical by 2.2; the Fire stays 10.
    expect(damageRange(stronger)[0]).toBeCloseTo(25 * 2.2 + 10);

    const enhanced = wearing({
      weapon: axe(["fireDamage", 10], ["enhancedDamage", 50]),
    });
    expect(damageRange(enhanced)[0]).toBeCloseTo(25 * 1.5 * 1.2 + 10);
  });

  it("totals Physical and Elements in a roll", () => {
    const w = wearing({ weapon: axe(["coldDamage", 10]) });
    expect(heroDamage(w, 0)).toBe(40);
    expect(heroDamage(w, 1)).toBe(58);
  });
});

/** A Combat Area for `row`: `H` the Hero, `Z` a Zombie, `S` a Skeleton. */
function field(row: string) {
  const objects: object[] = [];
  [...row].forEach((cell, i) => {
    const x = (i + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y: 16 });
    }
    if (cell === "Z" || cell === "S") {
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
            value: cell === "Z" ? "zombie" : "skeleton",
          },
        ],
      });
    }
  });
  return combatArea(
    {
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
    },
    1,
  );
}

function fighting(row: string, equipment: Wear, progress = FRESH_PROGRESS) {
  return createWorld({
    areas: { town, field: field(row) },
    seed: 4,
    progress,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
    start: { area: "field", entry: "start" },
  });
}

type Landed = Extract<SimEvent, { type: "HitLanded" }>;

/** The Hero's first landed swing at the lone Monster of `w`. */
function swing(w: World): Landed {
  w.monsters[0].life = 100000;
  for (let i = 0; i < 60 * 10; i++) {
    const events = step(w, [{ type: "Attack", monster: w.monsters[0].id }]);
    const landed = events.find(
      (e): e is Landed => e.type === "HitLanded" && e.attacker === "hero",
    );
    if (landed) return landed;
  }
  throw new Error("Never landed a swing");
}

describe("a Weapon with an elemental Suffix", () => {
  const fire = { weapon: axe(["fireDamage", 100]) };

  it("hits a Zombie, which burns, harder than a Skeleton", () => {
    const skeleton = swing(fighting("HS", fire));
    const zombie = swing(fighting("HZ", fire));
    expect(skeleton.damageType).toBe("fire");
    // 100 Fire is x1.25 on a Zombie (-25%) against x1 on a Skeleton.
    expect(zombie.damage - skeleton.damage).toBeGreaterThan(15);
  });

  it("is cut by the Skeleton's Cold Resistance on the Cold part only", () => {
    const hit = swing(fighting("HS", { weapon: axe(["coldDamage", 100]) }));
    // 100 Cold x0.75 on a Skeleton (+25%), plus 30-48 Physical.
    expect(hit.damageType).toBe("cold");
    expect(hit.damage).toBeGreaterThanOrEqual(75 + 30);
    expect(hit.damage).toBeLessThanOrEqual(75 + 48);
  });

  it("leaves Bone Spear's damage unchanged", () => {
    const necromancer = {
      ...FRESH_PROGRESS,
      skillPoints: 2,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, boneSpear: 1 },
      skillBar: { ...emptySkillBar(), right: "boneSpear" as const },
    };
    const cast = (equipment: Wear) => {
      const w = fighting("H.S", equipment, necromancer);
      w.monsters[0].life = 100000;
      for (let i = 0; i < 60 * 5; i++) {
        const events = step(w, [
          { type: "Cast", slot: "right", target: { x: 2.5, y: 0.5 } },
        ]);
        const hit = events.find(
          (e): e is Landed => e.type === "HitLanded" && e.attacker === "skill",
        );
        if (hit) return hit;
      }
      throw new Error("Bone Spear never landed");
    };
    const plain = cast({ weapon: { type: "axe" } });
    const embers = cast(fire);
    expect(embers.damage).toBe(plain.damage);
    expect(embers.damageType).toBe(plain.damageType);
  });
});

describe("the Save of the elemental damage Suffixes", () => {
  const belongings: Belongings = {
    inventory: [],
    equipment: {
      weapon: {
        type: "axe",
        rarity: "rare",
        rareName: "Doom Edge",
        affixes: [
          { kind: "brutality", grade: 0, value: 2 },
          { kind: "fireDamage", grade: 1, value: 6 },
          { kind: "lightningDamage", grade: 2, value: 12 },
        ],
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

  it("round-trips with their grades", () => {
    const text = encodeSave({
      progress: { ...FRESH_PROGRESS, smithService: "locked" },
      belongings,
    });
    expect(parseSave(text)?.belongings).toEqual(belongings);
    // Untampered, the same text parses, so the refusals below are real.
    expect(parseSave(JSON.stringify(textOf()))).not.toBeNull();
  });

  it("refuses one on a non-Weapon, with an unknown grade or outside its grade's range", () => {
    const onArmour = textOf();
    onArmour.equipment.armour = {
      type: "chainMail",
      rarity: "magic",
      affixes: [{ kind: "coldDamage", grade: 0, value: 2 }],
    };
    expect(parseSave(JSON.stringify(onArmour))).toBeNull();

    const unknownGrade = textOf();
    unknownGrade.equipment.weapon.affixes[1].grade = 3;
    expect(parseSave(JSON.stringify(unknownGrade))).toBeNull();

    const outOfRange = textOf();
    outOfRange.equipment.weapon.affixes[1].value = 999;
    expect(parseSave(JSON.stringify(outOfRange))).toBeNull();
  });
});
