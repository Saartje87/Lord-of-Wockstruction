import { describe, expect, it } from "vitest";
import {
  affixTuning,
  dropTuning,
  ITEM_TYPES,
  type ItemType,
  itemTuning,
  potionDropTuning,
} from "../tuning/items";
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

/** The Item one kill of a Monster of level 1 drops, seeded `seed`. */
function droppedAt(seed: number, type: ItemType) {
  dropTuning.chance = 1;
  dropTuning.items = [type];
  potionDropTuning.chance = 0;
  const world = createWorld({
    areas: { town: map() },
    seed,
    progress: { ...FRESH_PROGRESS, vitality: 200 },
  });
  for (let i = 0; i < 60 * 60; i++) {
    const events = step(world, [
      { type: "Attack", monster: world.monsters[0]?.id ?? 0 },
    ]);
    const dropped = events.find((event) => event.type === "ItemDropped");
    if (dropped?.type === "ItemDropped") return dropped.item;
  }
  throw new Error("Nothing dropped");
}

describe("the plain Ring and Amulet", () => {
  it("replace the four named ones, with no bonuses of their own", () => {
    expect(ITEM_TYPES).toContain("ring");
    expect(ITEM_TYPES).toContain("amulet");
    expect(ITEM_TYPES.filter((t) => /^(ringOf|amuletOf)/.test(t))).toEqual([]);
    expect(itemTuning.ring.bonuses).toEqual({});
    expect(itemTuning.amulet.bonuses).toEqual({});
  });

  it("never drop Normal", () => {
    const rarities = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const type of ["ring", "amulet"] as const) {
        const item = droppedAt(seed, type);
        rarities.add(item.rarity);
        expect(item.affixes.length).toBeGreaterThan(0);
      }
    }
    expect(rarities).toEqual(new Set(["magic", "rare"]));
  });

  it("have each old bonus inside exactly one grade's range", () => {
    for (const [kind, value] of [
      ["strength", 5],
      ["dexterity", 5],
      ["life", 10],
      ["vitality", 5],
    ] as const) {
      const holding = affixTuning[kind].grades.filter(
        ({ range }) => value >= range[0] && value <= range[1],
      );
      expect(holding).toHaveLength(1);
    }
  });
});
