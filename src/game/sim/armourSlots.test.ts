import { describe, expect, it } from "vitest";
import { dropTuning, ITEM_TYPES, type ItemType, itemOf } from "../tuning/items";
import { rollItem } from "./affixes";
import { emptyBelt } from "./belt";
import {
  type Belongings,
  cursorItemOf,
  EQUIPMENT_SLOTS,
  equipmentOf,
  inventoryOf,
} from "./inventory";
import { createRng } from "./random";
import { createWorld, heroDefense, step, type World } from "./world";

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

const idOf = (world: World, type: ItemType) => {
  const placed = inventoryOf(world).find(({ item }) => item.type === type);
  if (!placed) throw new Error(`No ${type}`);
  return placed.item.id;
};

const NEW_TYPES = [
  "leatherCap",
  "ironHelm",
  "leatherGloves",
  "chainGloves",
  "leatherBoots",
  "chainBoots",
  "buckler",
  "towerShield",
] as const satisfies readonly ItemType[];

const own = (type: ItemType) => itemOf(type).defense as number;

describe("the ten Equipment slots", () => {
  it("are Weapon, Off-hand, Helm, Armour, Gloves, Boots, Belt, Amulet and two Rings", () => {
    expect([...EQUIPMENT_SLOTS].sort()).toEqual(
      [
        "weapon",
        "offHand",
        "helm",
        "armour",
        "gloves",
        "boots",
        "belt",
        "amulet",
        "ring1",
        "ring2",
      ].sort(),
    );
  });

  it("take each new piece only into its own slot", () => {
    const expected: Record<string, string> = {
      leatherCap: "helm",
      ironHelm: "helm",
      leatherGloves: "gloves",
      chainGloves: "gloves",
      leatherBoots: "boots",
      chainBoots: "boots",
      buckler: "offHand",
      towerShield: "offHand",
    };
    for (const type of NEW_TYPES) {
      const world = wearing({}, [{ type, cell: { column: 0, row: 0 } }]);
      step(world, [{ type: "EquipItem", item: idOf(world, type) }]);
      const slots = Object.entries(worn(world))
        .filter(([, t]) => t === type)
        .map(([slot]) => slot);
      expect(slots).toEqual([expected[type]]);
    }
  });

  it("refuse a held piece in a slot of another kind", () => {
    const world = wearing({}, [
      { type: "leatherCap", cell: { column: 0, row: 0 } },
    ]);
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    for (const to of [
      "boots",
      "gloves",
      "offHand",
      "armour",
      "weapon",
    ] as const) {
      step(world, [{ type: "PlaceItem", to }]);
    }
    expect(worn(world).helm).toBeNull();
    step(world, [{ type: "PlaceItem", to: "helm" }]);
    expect(worn(world).helm).toBe("leatherCap");
  });

  it("refuse a Sword in the Off-hand", () => {
    const world = wearing({}, [
      { type: "shortSword", cell: { column: 0, row: 0 } },
    ]);
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    step(world, [{ type: "PlaceItem", to: "offHand" }]);
    expect(worn(world).offHand).toBeNull();
  });

  it("swap a held Shield with the Equipped one", () => {
    const world = wearing({ offHand: { type: "buckler" } }, [
      { type: "towerShield", cell: { column: 0, row: 0 } },
    ]);
    step(world, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    step(world, [{ type: "PlaceItem", to: "offHand" }]);
    expect(worn(world).offHand).toBe("towerShield");
    // The Buckler comes out onto the cursor, to go back where the Shield was.
    expect(cursorItemOf(world)?.item.type).toBe("buckler");
  });
});

describe("the new armour types", () => {
  it("each have a Short name, a size and an own Defense", () => {
    for (const type of NEW_TYPES) {
      const tuning = itemOf(type);
      expect(tuning.shortName.length).toBeGreaterThan(0);
      expect(tuning.size.columns).toBeGreaterThan(0);
      expect(tuning.defense).toBeGreaterThan(0);
    }
  });

  it("are among the non-Potion drops and roll every Rarity", () => {
    for (const type of NEW_TYPES) {
      expect(dropTuning.items).toContain(type);
      expect(ITEM_TYPES).toContain(type);
    }
    const rarities = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      rarities.add(rollItem(createRng(seed), "ironHelm", 5).rarity);
    }
    expect(rarities).toEqual(new Set(["normal", "magic", "rare"]));
  });

  it("roll Defense, enhanced Defense, Life and Attribute Affixes, never Weapon ones", () => {
    const rolled = new Set<string>();
    for (let seed = 1; seed <= 600; seed++) {
      for (const type of NEW_TYPES) {
        for (const a of rollItem(createRng(seed), type, 9).affixes) {
          rolled.add(`${type}:${a.kind}`);
        }
      }
    }
    for (const type of NEW_TYPES) {
      for (const kind of ["defense", "enhancedDefense", "life", "strength"]) {
        expect(rolled).toContain(`${type}:${kind}`);
      }
      for (const kind of ["brutality", "enhancedDamage", "accuracy"]) {
        expect(rolled).not.toContain(`${type}:${kind}`);
      }
    }
  });
});

describe("Hero Defense with the new pieces", () => {
  it("adds each Equipped piece's own Defense, undone on taking it off", () => {
    const world = wearing({
      armour: { type: "chainMail" },
      helm: { type: "ironHelm" },
      gloves: { type: "chainGloves" },
      boots: { type: "chainBoots" },
      offHand: { type: "towerShield" },
    });
    expect(heroDefense(world)).toBe(
      40 +
        own("ironHelm") +
        own("chainGloves") +
        own("chainBoots") +
        own("towerShield"),
    );
    step(world, [{ type: "UnequipItem", slot: "helm" }]);
    expect(heroDefense(world)).toBe(
      40 + own("chainGloves") + own("chainBoots") + own("towerShield"),
    );
  });

  it("scales enhanced Defense % only on the piece it's on", () => {
    const world = wearing({
      armour: { type: "chainMail" },
      helm: {
        type: "ironHelm",
        rarity: "magic",
        affixes: [
          { kind: "enhancedDefense", grade: 0, value: 20 },
          { kind: "defense", grade: 0, value: 7 },
        ],
      },
    });
    expect(heroDefense(world)).toBe(40 + Math.round(own("ironHelm") * 1.2) + 7);
  });
});
