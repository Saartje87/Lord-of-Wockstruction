import { describe, expect, it } from "vitest";
import { changesSave } from "../save";
import { ITEM_TYPES, type ItemType, isPotion, itemOf } from "../tuning/items";
import { valueTuning, vendorTuning } from "../tuning/vendor";
import { belongingsOf, cursorItemOf } from "./inventory";
import { itemValue } from "./value";
import { goodsOf } from "./vendor";
import {
  createWorld,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A one-row Area: `H` the Hero's start, `E` an Exit to `exitTo`. */
function row(cells: string, exitTo = "") {
  const objects: object[] = [];
  [...cells].forEach((cell, column) => {
    if (cell === "H") {
      objects.push({
        name: "start",
        type: "entry",
        point: true,
        x: (column + 0.5) * 32,
        y: 16,
      });
    }
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: column * 32,
        y: 0,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "start" },
        ],
      });
    }
  });
  return {
    orientation: "orthogonal",
    width: cells.length,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: cells.length,
        height: 1,
        data: new Array(cells.length).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

function newWorld(seed = 1): World {
  return createWorld({
    areas: {
      town: row("HE..", "field"),
      field: {
        ...row("HE..", "town"),
        properties: [
          { name: "areaLevel", type: "int", value: 1 },
          { name: "act", type: "int", value: 1 },
        ],
      },
    },
    seed,
  });
}

function run(world: World, orders: Order[], steps = 1): SimEvent[] {
  const events = step(world, orders);
  for (let i = 1; i < steps; i += 1) events.push(...step(world, []));
  return events;
}

/** Walks the Hero onto the Exit and through the Area change. */
function leave(world: World): SimEvent[] {
  return run(world, [{ type: "MoveTo", target: { x: 1.5, y: 0.5 } }], 300);
}

/** The cell of the first good of `type`. */
function cellOf(world: World, type: ItemType) {
  const good = goodsOf(world).find(({ item }) => item.type === type);
  if (!good) throw new Error(`No ${type} for sale`);
  return good.cell;
}

/** A non-Potion type the Vendor stocks exactly one of. */
function stockedType(world: World): ItemType {
  const goods = goodsOf(world).filter(({ item }) => !isPotion(item.type));
  const single = goods.find(
    ({ item }) => goods.filter((g) => g.item.type === item.type).length === 1,
  );
  if (!single) throw new Error("No single good for sale");
  return single.item.type;
}

describe("the Vendor's goods", () => {
  it("hold one of every Potion and only Normal Weapons, Armour and Belts", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const goods = goodsOf(newWorld(seed));
      for (const type of ITEM_TYPES.filter(isPotion)) {
        expect(goods.filter(({ item }) => item.type === type)).toHaveLength(1);
      }
      for (const { item } of goods.filter(({ item }) => !isPotion(item.type))) {
        expect(item.rarity).toBe("normal");
        expect(item.affixes).toEqual([]);
        expect(["weapon", "armour", "belt"]).toContain(itemOf(item.type).kind);
      }
    }
  });

  it("stock as many Weapons, Armour and Belts as tuning says, never overlapping", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const goods = goodsOf(newWorld(seed));
      for (const [kind, [min, max]] of Object.entries(vendorTuning.stock)) {
        const count = goods.filter(
          ({ item }) => itemOf(item.type).kind === kind,
        ).length;
        expect(count).toBeGreaterThanOrEqual(min);
        expect(count).toBeLessThanOrEqual(max);
      }
      const taken = new Set<string>();
      for (const { item, cell } of goods) {
        const { columns, rows } = itemOf(item.type).size;
        expect(cell.column + columns).toBeLessThanOrEqual(
          vendorTuning.grid.columns,
        );
        expect(cell.row + rows).toBeLessThanOrEqual(vendorTuning.grid.rows);
        for (let c = 0; c < columns; c++) {
          for (let r = 0; r < rows; r++) {
            const key = `${cell.column + c},${cell.row + r}`;
            expect(taken.has(key)).toBe(false);
            taken.add(key);
          }
        }
      }
    }
  });

  it("are the same for the same seed", () => {
    const types = (world: World) => goodsOf(world).map((g) => g.item.type);
    expect(types(newWorld(7))).toEqual(types(newWorld(7)));
  });

  it("restock on each arrival in Town and stay while the Hero stays", () => {
    const world = newWorld(3);
    const before = goodsOf(world).map(({ item }) => item.id);
    run(world, [], 50);
    expect(goodsOf(world).map(({ item }) => item.id)).toEqual(before);
    leave(world);
    expect(world.areaName).toBe("field");
    leave(world);
    expect(world.areaName).toBe("town");
    const after = goodsOf(world).map(({ item }) => item.id);
    expect(after).not.toEqual(before);
    expect(after.length).toBeGreaterThan(0);
  });

  it("report each restock", () => {
    const world = newWorld(3);
    const out = leave(world);
    expect(out.filter((e) => e.type === "VendorRestocked")).toHaveLength(0);
    const back = leave(world);
    expect(back.filter((e) => e.type === "VendorRestocked")).toHaveLength(1);
  });

  it("are not in the Belongings the Save keeps", () => {
    const world = newWorld();
    world.hero.progress.gold = 10_000;
    const cell = cellOf(world, stockedType(world));
    const before = belongingsOf(world);
    run(world, [{ type: "LiftGood", from: cell }]);
    expect(cursorItemOf(world)).not.toBeNull();
    expect(belongingsOf(world)).toEqual(before);
  });
});

describe("Value", () => {
  const sword = { type: "shortSword" } as const;
  const affix = (grade: number) => ({
    kind: "defense" as const,
    grade,
    value: 1,
  });

  it("is the type's base Value for a Normal Item", () => {
    expect(itemValue(sword)).toBe(valueTuning.base.shortSword);
  });

  it("rises with Rarity", () => {
    const normal = itemValue(sword);
    const magic = itemValue({ ...sword, rarity: "magic" });
    const rare = itemValue({ ...sword, rarity: "rare" });
    expect(magic).toBeGreaterThan(normal);
    expect(rare).toBeGreaterThan(magic);
  });

  it("rises with each Affix and more for higher grades", () => {
    const some = (grades: number[]) =>
      itemValue({ ...sword, rarity: "magic", affixes: grades.map(affix) });
    expect(some([0, 0])).toBeGreaterThan(some([0]));
    expect(some([1])).toBeGreaterThan(some([0]));
    expect(some([2])).toBeGreaterThan(some([1]));
  });

  it("has a share for every grade an Affix can have", () => {
    expect(valueTuning.affixShare).toHaveLength(3);
  });
});

describe("buying", () => {
  it("refuses to lift a good the Hero can't afford", () => {
    const world = newWorld();
    const type = stockedType(world);
    world.hero.progress.gold = itemValue({ type }) - 1;
    const cell = cellOf(world, type);
    const events = run(world, [{ type: "LiftGood", from: cell }]);
    expect(cursorItemOf(world)).toBeNull();
    expect(events.some((e) => e.type === "CantAfford")).toBe(true);
  });

  it("lifts a good the Hero can afford exactly", () => {
    const world = newWorld();
    const type = stockedType(world);
    world.hero.progress.gold = itemValue({ type });
    run(world, [{ type: "LiftGood", from: cellOf(world, type) }]);
    expect(cursorItemOf(world)?.item.type).toBe(type);
  });

  it("takes the Value once and adds the good to the Inventory when put down there", () => {
    const world = newWorld();
    const type = stockedType(world);
    const value = itemValue({ type });
    world.hero.progress.gold = value + 5;
    run(world, [{ type: "LiftGood", from: cellOf(world, type) }]);
    expect(world.hero.progress.gold).toBe(value + 5);
    const events = run(world, [
      { type: "PlaceItem", to: { column: 0, row: 0 } },
    ]);
    expect(world.hero.progress.gold).toBe(5);
    expect(cursorItemOf(world)).toBeNull();
    expect(belongingsOf(world).inventory).toEqual([
      { type, cell: { column: 0, row: 0 } },
    ]);
    expect(goodsOf(world).some((g) => g.item.type === type)).toBe(false);
    expect(events.filter((e) => e.type === "ItemBought")).toHaveLength(1);
    // The new Gold and Belongings are for the Save to keep.
    expect(changesSave(events)).toBe(true);
    // A second put down does nothing.
    run(world, [{ type: "PlaceItem", to: { column: 5, row: 0 } }]);
    expect(world.hero.progress.gold).toBe(5);
  });

  it("never runs out of Potions", () => {
    const world = newWorld();
    world.hero.progress.gold = 1000;
    for (let bought = 0; bought < 3; bought++) {
      run(world, [{ type: "LiftGood", from: cellOf(world, "manaPotion") }]);
      run(world, [{ type: "PlaceItem", to: { column: bought, row: 0 } }]);
    }
    expect(world.hero.progress.gold).toBe(
      1000 - 3 * itemValue({ type: "manaPotion" }),
    );
    expect(belongingsOf(world).inventory).toHaveLength(3);
    expect(
      goodsOf(world).filter((g) => g.item.type === "manaPotion"),
    ).toHaveLength(1);
  });

  it("puts a bought Potion on a Belt Column", () => {
    const world = newWorld();
    world.hero.progress.gold = 100;
    world.hero.belt[0] = [];
    run(world, [{ type: "LiftGood", from: cellOf(world, "manaPotion") }]);
    run(world, [{ type: "PlaceItem", to: { beltColumn: 0, row: 0 } }]);
    expect(world.hero.progress.gold).toBe(
      100 - itemValue({ type: "manaPotion" }),
    );
    expect(belongingsOf(world).belt[0]).toContain("manaPotion");
  });

  it("stays held and costs nothing when it won't fit where it's put down", () => {
    const world = newWorld();
    world.hero.progress.gold = 1000;
    world.hero.inventory.push({
      item: { id: 900, type: "shortSword", rarity: "normal", affixes: [] },
      cell: { column: 0, row: 0 },
    });
    const type = stockedType(world);
    run(world, [{ type: "LiftGood", from: cellOf(world, type) }]);
    run(world, [{ type: "PlaceItem", to: { column: 0, row: 0 } }]);
    expect(world.hero.progress.gold).toBe(1000);
    expect(cursorItemOf(world)?.item.type).toBe(type);
    // Nor into an Equipment slot.
    run(world, [{ type: "PlaceItem", to: "weapon" }]);
    expect(world.hero.progress.gold).toBe(1000);
    expect(cursorItemOf(world)?.item.type).toBe(type);
  });

  it("puts a Potion nowhere but a cell or a Belt Column", () => {
    const world = newWorld();
    world.hero.progress.gold = 1000;
    run(world, [{ type: "LiftGood", from: cellOf(world, "lifePotion") }]);
    run(world, [{ type: "PlaceItem", to: "weapon" }]);
    expect(cursorItemOf(world)).not.toBeNull();
    expect(world.hero.progress.gold).toBe(1000);
  });

  it("returns a held good at no cost when it is let go or the panel shuts", () => {
    for (const order of [
      { type: "DropItem" },
      { type: "ReturnCursorItem" },
    ] as const) {
      const world = newWorld();
      world.hero.progress.gold = 1000;
      const type = stockedType(world);
      const before = goodsOf(world);
      run(world, [{ type: "LiftGood", from: cellOf(world, type) }]);
      run(world, [order]);
      expect(cursorItemOf(world)).toBeNull();
      expect(world.hero.progress.gold).toBe(1000);
      expect(world.groundItems).toHaveLength(0);
      expect(
        goodsOf(world)
          .map((g) => g.item.type)
          .sort(),
      ).toEqual(before.map((g) => g.item.type).sort());
      expect(belongingsOf(world).inventory).toEqual([]);
    }
  });

  it("returns a held good when the Hero leaves Town", () => {
    const world = newWorld();
    world.hero.progress.gold = 1000;
    run(world, [{ type: "LiftGood", from: cellOf(world, stockedType(world)) }]);
    leave(world);
    expect(cursorItemOf(world)).toBeNull();
    expect(world.hero.progress.gold).toBe(1000);
  });

  it("ignores a lift at an empty cell", () => {
    const world = newWorld();
    world.hero.progress.gold = 1000;
    run(world, [{ type: "LiftGood", from: { column: 7, row: 5 } }]);
    expect(cursorItemOf(world)).toBeNull();
  });
});
