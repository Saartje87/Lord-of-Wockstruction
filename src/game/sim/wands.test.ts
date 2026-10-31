import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import {
  affixOf,
  dropTuning,
  ITEM_TYPES,
  type ItemType,
  itemOf,
} from "../tuning/items";
import { rollItem } from "./affixes";
import { emptyBelt } from "./belt";
import { type Belongings, equipmentOf, inventoryOf } from "./inventory";
import { createRng } from "./random";
import { createWorld, damageRange, maxMana, step, type World } from "./world";

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

function wearing(
  equipment: Belongings["equipment"],
  inventory: Belongings["inventory"] = [],
): World {
  return createWorld({
    areas: { town },
    seed: 1,
    belongings: { inventory, equipment, belt: emptyBelt() },
  });
}

const worn = (world: World) =>
  Object.fromEntries(
    Object.entries(equipmentOf(world)).map(([slot, item]) => [
      slot,
      item?.type ?? null,
    ]),
  );

const WANDS = ["boneWand", "yewWand"] as const satisfies readonly ItemType[];
const at = { column: 0, row: 0 };

describe("Wand types", () => {
  it("are 1x2 Wands with low damage, + Mana and a Short name", () => {
    for (const type of WANDS) {
      const wand = itemOf(type);
      expect(wand.kind).toBe("wand");
      expect(wand.size).toEqual({ columns: 1, rows: 2 });
      expect(wand.shortName.length).toBeGreaterThan(0);
      expect(wand.damage?.[1]).toBeLessThan(10);
      expect(wand.bonuses.mana).toBeGreaterThan(0);
    }
  });

  it("are among the Items Monsters drop", () => {
    for (const type of WANDS) expect(dropTuning.items).toContain(type);
  });
});

describe("Wands in the Equipment slots", () => {
  it("fit the Weapon slot and the Off-hand", () => {
    const world = wearing({}, [
      { type: "boneWand", cell: at },
      { type: "yewWand", cell: { column: 1, row: 0 } },
    ]);
    for (const { item } of [...inventoryOf(world)]) {
      step(world, [{ type: "EquipItem", item: item.id }]);
    }
    expect(worn(world).weapon).toBe("boneWand");
    expect(worn(world).offHand).toBe("yewWand");
  });

  it("allow Sword + Wand and Wand + Shield", () => {
    const sw = wearing({ weapon: { type: "shortSword" } }, [
      { type: "boneWand", cell: at },
    ]);
    step(sw, [{ type: "EquipItem", item: inventoryOf(sw)[0].item.id }]);
    expect(worn(sw)).toMatchObject({
      weapon: "shortSword",
      offHand: "boneWand",
    });

    const ws = wearing({ offHand: { type: "buckler" } }, [
      { type: "boneWand", cell: at },
    ]);
    step(ws, [{ type: "EquipItem", item: inventoryOf(ws)[0].item.id }]);
    expect(worn(ws)).toMatchObject({ weapon: "boneWand", offHand: "buckler" });
  });

  it("refuse a Sword or Axe in the Off-hand when putting down and when swapping", () => {
    for (const type of ["shortSword", "axe"] as const) {
      const swap = wearing({ offHand: { type: "boneWand" } }, [
        { type, cell: at },
      ]);
      step(swap, [{ type: "LiftItem", from: at }]);
      step(swap, [{ type: "PlaceItem", to: "offHand" }]);
      expect(worn(swap).offHand).toBe("boneWand");

      const empty = wearing({}, [{ type, cell: at }]);
      step(empty, [{ type: "LiftItem", from: at }]);
      step(empty, [{ type: "PlaceItem", to: "offHand" }]);
      expect(worn(empty).offHand).toBeNull();
    }
  });

  it("swap a held Wand with an Equipped Shield in the Off-hand", () => {
    const world = wearing({ offHand: { type: "buckler" } }, [
      { type: "yewWand", cell: at },
    ]);
    step(world, [{ type: "LiftItem", from: at }]);
    step(world, [{ type: "PlaceItem", to: "offHand" }]);
    expect(worn(world).offHand).toBe("yewWand");
  });
});

describe("what Wands give", () => {
  const mana = (type: ItemType) => itemOf(type).bonuses.mana as number;

  it("counts their Mana in either slot, and adds two up", () => {
    const base = maxMana(wearing({}));
    expect(maxMana(wearing({ weapon: { type: "boneWand" } }))).toBe(
      base + mana("boneWand"),
    );
    expect(maxMana(wearing({ offHand: { type: "boneWand" } }))).toBe(
      base + mana("boneWand"),
    );
    expect(
      maxMana(
        wearing({ weapon: { type: "boneWand" }, offHand: { type: "yewWand" } }),
      ),
    ).toBe(base + mana("boneWand") + mana("yewWand"));
  });

  it("sets the attack damage from the Weapon slot, but a Wand alone in the Off-hand punches", () => {
    const unarmed = damageRange(wearing({}));
    expect(damageRange(wearing({ offHand: { type: "boneWand" } }))).toEqual(
      unarmed,
    );
    const inHand = damageRange(wearing({ weapon: { type: "boneWand" } }));
    expect(inHand).not.toEqual(unarmed);
    const [min, max] = itemOf("boneWand").damage as [number, number];
    // 20 Strength at the start: 20% more.
    expect(inHand[0]).toBeCloseTo(min * 1.2);
    expect(inHand[1]).toBeCloseTo(max * 1.2);
  });
});

describe("Weapon Affixes on Wands", () => {
  it("roll on Wands", () => {
    const rng = createRng(3);
    const kinds = new Set<string>();
    for (let i = 0; i < 300; i++) {
      for (const a of rollItem(rng, "boneWand", 9).affixes) kinds.add(a.kind);
    }
    for (const kind of ["brutality", "enhancedDamage", "accuracy"]) {
      expect(kinds).toContain(kind);
    }
    for (const kind of ["brutality", "enhancedDamage", "fireDamage"] as const) {
      expect(affixOf(kind).rollsOn).toContain("wand");
    }
    expect(ITEM_TYPES).toContain("yewWand");
  });
});

describe("the Save", () => {
  it("round-trips a Wand in each hand", () => {
    const world = wearing({
      weapon: { type: "boneWand" },
      offHand: { type: "yewWand" },
    });
    const text = encodeSave(saveOf(world));
    expect(parseSave(text)?.belongings.equipment).toMatchObject({
      weapon: { type: "boneWand" },
      offHand: { type: "yewWand" },
    });
  });

  it("rejects a non-Wand Weapon in the Off-hand", () => {
    const stored = JSON.parse(
      encodeSave(saveOf(wearing({ offHand: { type: "buckler" } }))),
    );
    stored.equipment = { offHand: { type: "axe" } };
    expect(parseSave(JSON.stringify(stored))).toBeNull();
  });
});
