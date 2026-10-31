import { describe, expect, it } from "vitest";
import {
  affixTuning,
  dropTuning,
  ITEM_TYPES,
  type ItemType,
  isPotion,
  itemTuning,
  potionDropTuning,
} from "../tuning/items";
import { itemTitle } from "./affixes";
import { emptyBelt } from "./belt";
import { type Belongings, belongingsOf, inventoryOf } from "./inventory";
import {
  attackRating,
  createWorld,
  damageRange,
  FRESH_PROGRESS,
  heroDefense,
  maxLife,
  maxMana,
  step,
  type World,
} from "./world";

/** A Town with the Hero at `H` and one Skeleton at `S`. */
function map() {
  const objects = [
    { name: "start", type: "entry", point: true, x: 16, y: 16 },
    {
      name: "",
      type: "monsterSpawn",
      point: true,
      x: 80,
      y: 16,
      properties: [
        { name: "monster", type: "string", value: "skeleton" },
        { name: "count", type: "int", value: 1 },
      ],
    },
  ];
  return {
    orientation: "orthogonal",
    width: 5,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 5,
        height: 1,
        data: new Array(5).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const tuned = { ...dropTuning };
const tunedPotions = { ...potionDropTuning };
/** The Item one kill of a Monster of `monsterLevel` drops, seeded `seed`. */
function droppedAt(monsterLevel: number, seed: number, type?: ItemType) {
  const potion = type !== undefined && isPotion(type);
  dropTuning.chance = potion ? 0 : 1;
  dropTuning.items = type ? [type] : tuned.items;
  potionDropTuning.chance = potion ? 1 : 0;
  potionDropTuning.items = type ? [type] : tunedPotions.items;
  const world = createWorld({
    areas: { town: map() },
    seed,
    progress: { ...FRESH_PROGRESS, vitality: 200 },
  });
  world.monsters[0].monsterLevel = monsterLevel;
  for (let i = 0; i < 60 * 60; i++) {
    const events = step(world, [
      { type: "Attack", monster: world.monsters[0]?.id ?? 0 },
    ]);
    const dropped = events.find((event) => event.type === "ItemDropped");
    if (dropped?.type === "ItemDropped") return dropped.item;
  }
  throw new Error("Nothing dropped");
}

describe("Magic Items", () => {
  it("make up about a quarter of non-Potion drops, the rest Normal", () => {
    let magic = 0;
    let counted = 0;
    const total = 300;
    for (let seed = 1; seed <= total; seed++) {
      const item = droppedAt(1, seed);
      // Rings and Amulets never drop Normal, so they say nothing about odds.
      if (item.type === "ring" || item.type === "amulet") continue;
      counted++;
      if (item.rarity === "magic") magic++;
      else if (item.rarity === "normal") expect(item.affixes).toEqual([]);
    }

    expect(magic / counted).toBeGreaterThan(0.17);
    expect(magic / counted).toBeLessThan(0.35);
  });

  it("always drop Potions Normal, with no Affixes", () => {
    for (let seed = 1; seed <= 60; seed++) {
      expect(droppedAt(9, seed, "manaPotion")).toMatchObject({
        rarity: "normal",
        affixes: [],
      });
    }
  });

  it("have one or two Affixes, at most a Prefix and a Suffix, of kinds that suit the Item", () => {
    const counts = new Set<number>();
    const types = ITEM_TYPES.filter((type) => !isPotion(type));
    for (let seed = 1; seed <= 400; seed++) {
      const item = droppedAt(9, seed, types[seed % types.length]);
      if (item.rarity !== "magic") continue;
      counts.add(item.affixes.length);
      const sides = item.affixes.map((a) => affixTuning[a.kind].side);
      expect(new Set(sides).size).toBe(sides.length);
      for (const affix of item.affixes) {
        expect(affixTuning[affix.kind].rollsOn).toContain(
          itemTuning[item.type].kind,
        );
      }
    }

    expect([...counts].sort()).toEqual([1, 2]);
  });

  it("only roll grades the Monster Level reaches, with values inside the grade's range", () => {
    const seen = new Map<number, Set<number>>();
    for (const level of [1, 5, 9]) {
      const grades = new Set<number>();
      seen.set(level, grades);
      for (let seed = 1; seed <= 400; seed++) {
        for (const { kind, grade, value } of droppedAt(level, seed).affixes) {
          const tuning = affixTuning[kind].grades[grade];
          expect(tuning.fromMonsterLevel).toBeLessThanOrEqual(level);
          expect(value).toBeGreaterThanOrEqual(tuning.range[0]);
          expect(value).toBeLessThanOrEqual(tuning.range[1]);
          grades.add(grade);
        }
      }
    }

    expect([...(seen.get(1) ?? [])]).toEqual([0]);
    expect([...(seen.get(5) ?? [])].sort()).toEqual([0, 1]);
    expect([...(seen.get(9) ?? [])].sort()).toEqual([0, 1, 2]);
  });

  it("are named Prefix grade name, type name, Suffix grade name", () => {
    let named = 0;
    for (let seed = 1; seed <= 600 && named < 3; seed++) {
      const item = droppedAt(1, seed, "chainMail");
      if (item.affixes.length !== 2) continue;
      const [prefix, suffix] = [...item.affixes].sort((a) =>
        affixTuning[a.kind].side === "prefix" ? -1 : 1,
      );
      const grade = (a: typeof prefix) => affixTuning[a.kind].grades[a.grade];
      expect(itemTitle(item)).toBe(
        `${grade(prefix).name} Chain Mail ${grade(suffix).name}`,
      );
      named++;
    }

    expect(named).toBe(3);
  });
});

/** A World whose Hero wears `belongings`. */
function wearing(belongings: Belongings): World {
  return createWorld({ areas: { town: map() }, seed: 1, belongings });
}

const NAKED: Belongings = { inventory: [], equipment: {}, belt: emptyBelt() };

describe("Equipped Magic Items", () => {
  const magic = (
    type: ItemType,
    ...affixes: { kind: keyof typeof affixTuning; value: number }[]
  ) => ({
    type,
    rarity: "magic" as const,
    affixes: affixes.map((a) => ({ ...a, grade: 0 })),
  });

  it("add their Affixes to the Attributes, Life, Defense and Attack Rating", () => {
    const plain = wearing({
      ...NAKED,
      equipment: { armour: { type: "chainMail" } },
    });
    const world = wearing({
      ...NAKED,
      equipment: {
        armour: magic(
          "chainMail",
          { kind: "defense", value: 7 },
          { kind: "life", value: 8 },
        ),
      },
    });

    expect(heroDefense(world)).toBe(heroDefense(plain) + 7);
    expect(maxLife(world)).toBe(maxLife(plain) + 8);

    const ring = wearing({
      ...NAKED,
      equipment: {
        ring1: magic(
          "ring",
          { kind: "accuracy", value: 10 },
          { kind: "dexterity", value: 3 },
        ),
      },
    });
    const bare = wearing(NAKED);
    // A Ring of Life's own +10 Life is unaffected; Dexterity adds Attack Rating.
    expect(attackRating(ring)).toBeGreaterThan(attackRating(bare) + 10);
  });

  it("add Brutality to both ends of the Weapon's damage before Strength scales it", () => {
    const plain = wearing({
      ...NAKED,
      equipment: { weapon: { type: "axe" } },
    });
    const world = wearing({
      ...NAKED,
      equipment: { weapon: magic("axe", { kind: "brutality", value: 5 }) },
    });

    const [min, max] = damageRange(plain);
    const [bMin, bMax] = damageRange(world);
    // 20 Strength scales by 1.2.
    expect(bMin).toBeCloseTo(min + 5 * 1.2);
    expect(bMax).toBeCloseTo(max + 5 * 1.2);
  });

  it("add Mana to the Hero's maximum Mana", () => {
    const plain = wearing(NAKED);
    const world = wearing({
      ...NAKED,
      equipment: { ring1: magic("ring", { kind: "mana", value: 12 }) },
    });

    expect(maxMana(world)).toBe(maxMana(plain) + 12);
    step(world, [{ type: "LiftItem", from: "ring1" }]);
    expect(maxMana(world)).toBe(maxMana(plain));
  });

  it("scale the Weapon's own damage before Brutality is added and Strength scales it", () => {
    const plain = wearing({ ...NAKED, equipment: { weapon: { type: "axe" } } });
    const world = wearing({
      ...NAKED,
      equipment: {
        weapon: magic(
          "axe",
          { kind: "enhancedDamage", value: 50 },
          { kind: "brutality", value: 5 },
        ),
      },
    });

    const [min, max] = damageRange(plain);
    const [eMin, eMax] = damageRange(world);
    // Strength's 1.2 comes off; 50% more own damage, then +5 flat, then x1.2.
    expect(eMin).toBeCloseTo((min / 1.2) * 1.5 * 1.2 + 5 * 1.2);
    expect(eMax).toBeCloseTo((max / 1.2) * 1.5 * 1.2 + 5 * 1.2);
  });

  it("scale the Armour's own Defense before flat Defense is added", () => {
    const world = wearing({
      ...NAKED,
      equipment: {
        armour: magic(
          "chainMail",
          { kind: "enhancedDefense", value: 50 },
          { kind: "defense", value: 7 },
        ),
      },
    });

    // Chain mail's own 40, 50% more, then +7.
    expect(heroDefense(world)).toBe(60 + 7);
    step(world, [{ type: "LiftItem", from: "armour" }]);
    expect(heroDefense(world)).toBe(0);
  });

  it("roll the new kinds on the Items they suit", () => {
    const rolled = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      for (const type of ["axe", "chainMail", "ring"] as const) {
        for (const a of droppedAt(9, seed, type).affixes) {
          rolled.add(`${type}:${a.kind}`);
        }
      }
    }
    expect(rolled).toContain("axe:enhancedDamage");
    expect(rolled).toContain("chainMail:enhancedDefense");
    expect(rolled).toContain("ring:mana");
    expect(rolled).not.toContain("chainMail:enhancedDamage");
    expect(rolled).not.toContain("axe:enhancedDefense");
  });

  it("stop counting once taken off", () => {
    const world = wearing({
      ...NAKED,
      equipment: { armour: magic("chainMail", { kind: "defense", value: 7 }) },
    });
    const withIt = heroDefense(world);

    step(world, [{ type: "LiftItem", from: "armour" }]);

    expect(heroDefense(world)).toBe(withIt - 7 - 40);
  });

  it("add to a Smith bonus giving the same Bonus", () => {
    const world = wearing({
      ...NAKED,
      equipment: {
        armour: {
          ...magic("chainMail", { kind: "defense", value: 7 }),
          smithBonus: { bonus: "defense", amount: 10 },
        },
      },
    });

    expect(heroDefense(world)).toBe(40 + 7 + 10);
    // The Smith bonus is no Affix: the name is still just the Affix's.
    expect(belongingsOf(world).equipment.armour?.affixes).toHaveLength(1);
    expect(inventoryOf(world)).toEqual([]);
  });
});
