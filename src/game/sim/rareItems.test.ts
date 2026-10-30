import { afterEach, describe, expect, it } from "vitest";
import {
  affixTuning,
  dropTuning,
  ITEM_TYPES,
  type ItemType,
  isPotion,
  itemTuning,
  potionDropTuning,
  rarityTuning,
} from "../tuning/items";
import { itemTitle } from "./affixes";
import { createWorld, FRESH_PROGRESS, step } from "./world";

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
afterEach(() => {
  Object.assign(dropTuning, tuned);
  Object.assign(potionDropTuning, tunedPotions);
});

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

describe("Rare Items", () => {
  const types = ITEM_TYPES.filter((type) => !isPotion(type));
  const drops = Array.from({ length: 900 }, (_, i) =>
    droppedAt(9, i + 1, types[i % types.length]),
  );
  const rares = drops.filter((item) => item.rarity === "rare");

  it("make Normal the most common Rarity and Rare the rarest", () => {
    const count = (r: string) => drops.filter((d) => d.rarity === r).length;

    expect(count("normal")).toBeGreaterThan(count("magic"));
    expect(count("magic")).toBeGreaterThan(count("rare"));
    expect(count("rare")).toBeGreaterThan(10);
    expect(count("rare") / drops.length).toBeLessThan(0.1);
  });

  it("have three or four Affixes, at most two Prefixes and two Suffixes, never two of a kind", () => {
    const counts = new Set<number>();
    for (const item of rares) {
      counts.add(item.affixes.length);
      const sides = item.affixes.map((a) => affixTuning[a.kind].side);
      expect(sides.filter((s) => s === "prefix").length).toBeLessThanOrEqual(2);
      expect(sides.filter((s) => s === "suffix").length).toBeLessThanOrEqual(2);
      const kinds = item.affixes.map((a) => a.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      for (const affix of item.affixes) {
        expect(affixTuning[affix.kind].rollsOn).toContain(
          itemTuning[item.type].kind,
        );
      }
    }

    expect([...counts].sort()).toEqual([3, 4]);
  });

  it("grade their Affixes by the Monster Level like Magic Items", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const item = droppedAt(1, seed);
      if (item.rarity !== "rare") continue;
      for (const { kind, grade } of item.affixes) {
        expect(
          affixTuning[kind].grades[grade].fromMonsterLevel,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("are named by one word from each of the two word lists", () => {
    const names = new Set<string>();
    for (const item of rares) {
      expect(item.rareName).toBeDefined();
      const [first, second, ...rest] = (item.rareName ?? "").split(" ");
      expect(rest).toEqual([]);
      expect(rarityTuning.rareNames.first).toContain(first);
      expect(rarityTuning.rareNames.second).toContain(second);
      names.add(item.rareName ?? "");
    }

    expect(names.size).toBeGreaterThan(5);
  });

  it("leave Normal and Magic Items nameless and Potions Normal", () => {
    for (const item of drops.filter((d) => d.rarity !== "rare")) {
      expect(item.rareName).toBeUndefined();
    }
    for (let seed = 1; seed <= 60; seed++) {
      expect(droppedAt(9, seed, "manaPotion").rarity).toBe("normal");
    }
  });

  it("are titled by their Rare name", () => {
    const item = rares[0];

    expect(itemTitle(item)).toBe(item.rareName);
  });
});
