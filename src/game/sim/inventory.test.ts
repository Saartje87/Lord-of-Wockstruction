import { describe, expect, it } from "vitest";
import {
  createWorld,
  damageRange,
  equipmentOf,
  type Gear,
  gearOf,
  inventoryItemAt,
  inventoryOf,
  type Progress,
  type World,
} from "./world";

/** A Town of open floor three tiles wide, the Hero's `start` on the first. */
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

function world(
  options: { progress?: Progress; gear?: Gear | null } = {},
): World {
  return createWorld({ areas: { town }, seed: 1, ...options });
}

/** A Level 3 Hero at 20/20/20 with `strength` more Strength. */
function strongerBy(strength: number): Progress {
  return {
    level: 3,
    experience: 1_500,
    strength: 20 + strength,
    dexterity: 20,
    vitality: 20,
    attributePoints: 10 - strength,
  };
}

describe("a fresh Hero's Equipment and Inventory", () => {
  it("has a Short Sword Equipped and nothing else", () => {
    const equipment = equipmentOf(world());

    expect(equipment.weapon?.type).toBe("shortSword");
    expect(equipment.armour).toBeNull();
    expect(equipment.amulet).toBeNull();
    expect(equipment.ring1).toBeNull();
    expect(equipment.ring2).toBeNull();
  });

  it("has an empty Inventory", () => {
    const w = world();

    expect(inventoryOf(w)).toEqual([]);
    expect(inventoryItemAt(w, { column: 0, row: 0 })).toBeNull();
  });

  it("deals 20–30 with the Short Sword", () => {
    expect(damageRange(world())).toEqual([20, 30]);
  });

  it("is the same with no gear given", () => {
    expect(gearOf(world({ gear: null }))).toEqual(gearOf(world()));
  });
});

describe("gear given to a new World", () => {
  const gear: Gear = {
    inventory: [
      { type: "axe", cell: { column: 0, row: 0 } },
      { type: "ringOfLife", cell: { column: 9, row: 3 } },
    ],
    equipment: { weapon: "shortSword", armour: "leatherArmour" },
  };

  it("comes back as it was given", () => {
    expect(gearOf(world({ gear }))).toEqual(gear);
  });

  it("puts each Inventory Item in every cell it covers", () => {
    const w = world({ gear });

    // The Axe is 2×3.
    for (const cell of [
      { column: 0, row: 0 },
      { column: 1, row: 2 },
    ]) {
      expect(inventoryItemAt(w, cell)?.item.type).toBe("axe");
    }
    expect(inventoryItemAt(w, { column: 2, row: 0 })).toBeNull();
    expect(inventoryItemAt(w, { column: 0, row: 3 })).toBeNull();
    expect(inventoryItemAt(w, { column: 9, row: 3 })).toMatchObject({
      item: { type: "ringOfLife" },
      cell: { column: 9, row: 3 },
    });
  });

  it("gives every Item its own id", () => {
    const w = world({ gear });
    const ids = [
      ...inventoryOf(w).map((placed) => placed.item.id),
      ...Object.values(equipmentOf(w)).flatMap((item) =>
        item ? [item.id] : [],
      ),
    ];

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("damage", () => {
  it("comes from the Equipped Weapon, scaled by Strength", () => {
    const sword = world({ progress: strongerBy(10) });
    const axe = world({
      progress: strongerBy(10),
      gear: { inventory: [], equipment: { weapon: "axe" } },
    });

    // 130% of the Short Sword's 16.67–25 and the Axe's 25–40.
    const [swordMin, swordMax] = damageRange(sword);
    expect(swordMin).toBeCloseTo(21.67, 2);
    expect(swordMax).toBeCloseTo(32.5, 2);
    const [axeMin, axeMax] = damageRange(axe);
    expect(axeMin).toBeCloseTo(32.5, 2);
    expect(axeMax).toBeCloseTo(52, 2);
  });

  it("is a punch's 1–4 with no Weapon", () => {
    const w = world({ gear: { inventory: [], equipment: {} } });

    const [min, max] = damageRange(w);
    expect(min).toBeCloseTo(1, 5);
    expect(max).toBeCloseTo(4, 5);
  });
});
