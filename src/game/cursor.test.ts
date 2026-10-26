import { afterEach, describe, expect, it } from "vitest";
import {
  type CursorHit,
  createCursor,
  forTheWorld,
  pressCursor,
  releaseCursor,
  settleCursor,
} from "./cursor";
import { beltStripLayout } from "./render/beltStrip";
import { inventoryPanelLayout } from "./render/inventoryPanel";
import { beltOf, emptyBelt } from "./sim/belt";
import {
  type Belongings,
  cursorItemOf,
  type EquipmentSlot,
  equipmentOf,
  type ItemSpot,
  inventoryItemAt,
} from "./sim/inventory";
import type { Vec } from "./sim/vec";
import { createWorld, groundItemsOf, step, type World } from "./sim/world";
import { beltTuning } from "./tuning/items";

const SCREEN = { width: 1280, height: 800 };

/** A Town of one tile with the Hero's `start` on it. */
const town = {
  orientation: "orthogonal",
  width: 1,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 1, height: 1, data: [1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

/** An axe in the Inventory at (4, 1). */
const belongings: Belongings = {
  inventory: [{ type: "axe", cell: { column: 4, row: 1 } }],
  equipment: {},
  belt: emptyBelt(),
};

function scene() {
  const world = createWorld({ areas: { town }, seed: 1, belongings });
  return { world, screen: SCREEN };
}

const { grid, cell } = inventoryPanelLayout(SCREEN, 1);
const centreOf = (column: number, row: number) => ({
  x: grid.x + (column + 0.5) * cell,
  y: grid.y + (row + 0.5) * cell,
});
const onCell = (column: number, row: number): CursorHit => ({
  inventory: { column, row },
});
const pressOnCell = (column: number, row: number) => ({
  at: centreOf(column, row),
  hit: onCell(column, row),
});
const OVER_THE_WORLD = { at: { x: 640, y: 300 }, hit: null };
const ON_KEY4: CursorHit = { button: { type: "skillBarSlot", slot: "key4" } };
const ON_GOLEM: CursorHit = { button: { type: "dragSkill", skill: "golem" } };

describe("the cursor with Items", () => {
  it("lifts the Item pressed on with nothing held", () => {
    const { orders, taken, cursor } = pressCursor(
      createCursor(),
      pressOnCell(4, 1),
      scene(),
    );

    expect(orders).toEqual([{ type: "LiftItem", from: { column: 4, row: 1 } }]);
    expect(taken).toBe(true);
    expect(cursor.heldSkill).toBeNull();
  });

  it("lifts nothing from an empty cell, still keeping the press from the World", () => {
    const { orders, taken } = pressCursor(
      createCursor(),
      pressOnCell(0, 0),
      scene(),
    );

    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("keeps the lifted Item held when the press is released", () => {
    const at = scene();
    step(at.world, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    const { orders } = releaseCursor(
      createCursor(),
      { at: centreOf(8, 2), hit: onCell(8, 2), dragged: false },
      at,
    );

    expect(orders).toEqual([]);
  });

  it("puts a held Item down centred on the next press", () => {
    const at = scene();
    step(at.world, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);
    const centre = { x: grid.x + 2 * cell, y: grid.y + 1.5 * cell };

    const { orders, taken } = pressCursor(
      createCursor(),
      { at: centre, hit: onCell(2, 1) },
      at,
    );

    expect(orders).toEqual([{ type: "PlaceItem", to: { column: 1, row: 0 } }]);
    expect(taken).toBe(true);
  });

  it("drops a held Item for a press off the panels, ordering nothing else", () => {
    const at = scene();
    step(at.world, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    const { orders, taken } = pressCursor(
      createCursor(),
      { at: { x: 10, y: 10 }, hit: { drop: true } },
      at,
    );

    expect(orders).toEqual([{ type: "DropItem" }]);
    expect(taken).toBe(true);
  });
});

describe("the cursor over the World", () => {
  it("leaves a press there to the World with nothing held", () => {
    const { orders, taken, cursor } = pressCursor(
      createCursor(),
      OVER_THE_WORLD,
      scene(),
    );

    expect(orders).toEqual([]);
    expect(taken).toBe(false);
    expect(cursor).toEqual(createCursor());
  });
});

describe("the cursor on the panels' buttons", () => {
  it("keeps a press on one from the World, leaving the button to the menus", () => {
    const { orders, taken } = pressCursor(
      createCursor(),
      { at: { x: 0, y: 0 }, hit: { button: { type: "levelUp" } } },
      scene(),
    );

    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });
});

describe("the cursor with Skills", () => {
  it("picks up a learned Skill pressed on in the Skill Tree as the Held Skill", () => {
    const { cursor, orders, taken } = pressCursor(
      createCursor(),
      { at: { x: 1000, y: 100 }, hit: ON_GOLEM },
      scene(),
    );

    expect(cursor.heldSkill).toBe("golem");
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("puts the Held Skill into the Skill Bar slot it is released over", () => {
    const at = scene();
    const held = pressCursor(
      createCursor(),
      { at: { x: 1000, y: 100 }, hit: ON_GOLEM },
      at,
    ).cursor;

    const { cursor, orders } = releaseCursor(
      held,
      { at: { x: 600, y: 740 }, hit: ON_KEY4, dragged: true },
      at,
    );

    expect(orders).toEqual([
      { type: "PutSkillOnBar", skill: "golem", slot: "key4" },
    ]);
    expect(cursor.heldSkill).toBeNull();
  });

  it("keeps the Held Skill held when released where it was picked up, for a second click", () => {
    const at = scene();
    const held = pressCursor(
      createCursor(),
      { at: { x: 1000, y: 100 }, hit: ON_GOLEM },
      at,
    ).cursor;

    const { cursor, orders, taken } = releaseCursor(
      held,
      { at: { x: 1002, y: 101 }, hit: ON_GOLEM, dragged: false },
      at,
    );

    expect(cursor.heldSkill).toBe("golem");
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("lets go of the Held Skill released anywhere else, changing nothing", () => {
    const at = scene();
    const held = { ...createCursor(), heldSkill: "golem" as const };

    for (const release of [
      OVER_THE_WORLD,
      { at: null, hit: null },
      { at: centreOf(0, 0), hit: onCell(0, 0) },
    ]) {
      const { cursor, orders } = releaseCursor(
        held,
        { ...release, dragged: true },
        at,
      );

      expect(orders).toEqual([]);
      expect(cursor.heldSkill).toBeNull();
    }
  });

  it("puts the Held Skill into the Skill Bar slot clicked next", () => {
    const { cursor, orders, taken } = pressCursor(
      { ...createCursor(), heldSkill: "golem" },
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
      scene(),
    );

    expect(orders).toEqual([
      { type: "PutSkillOnBar", skill: "golem", slot: "key4" },
    ]);
    expect(cursor.heldSkill).toBeNull();
    expect(taken).toBe(true);
  });

  it("lets go of the Held Skill on a click anywhere else, changing nothing", () => {
    for (const press of [
      OVER_THE_WORLD,
      pressOnCell(4, 1),
      { at: { x: 0, y: 0 }, hit: { button: { type: "levelUp" } } as const },
      { at: { x: 1000, y: 100 }, hit: ON_GOLEM },
    ]) {
      const at = scene();
      const { cursor, orders, taken } = pressCursor(
        { ...createCursor(), heldSkill: "golem" },
        press,
        at,
      );

      expect(orders).toEqual([]);
      expect(cursor.heldSkill).toBeNull();
      // Not for the World either: the click neither walks nor attacks.
      expect(taken).toBe(true);
    }
  });

  it("orders nothing for the release of the click that put down or let go of the Held Skill", () => {
    const at = scene();
    const after = pressCursor(
      { ...createCursor(), heldSkill: "golem" },
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
      at,
    ).cursor;

    const { cursor, orders } = releaseCursor(
      after,
      { at: { x: 600, y: 740 }, hit: ON_KEY4, dragged: false },
      at,
    );

    expect(orders).toEqual([]);
    expect(cursor.heldSkill).toBeNull();
  });

  it("picks up no Skill while an Item is held, keeping the Item", () => {
    const at = scene();
    step(at.world, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    const { cursor, orders, taken } = pressCursor(
      createCursor(),
      { at: { x: 1000, y: 100 }, hit: ON_GOLEM },
      at,
    );

    expect(cursor.heldSkill).toBeNull();
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("orders nothing for a release with nothing held", () => {
    const { cursor, orders } = releaseCursor(
      createCursor(),
      { at: { x: 600, y: 740 }, hit: ON_KEY4, dragged: true },
      scene(),
    );

    expect(orders).toEqual([]);
    expect(cursor).toEqual(createCursor());
  });

  it("lets go of the Held Skill on a pause or the Hero's Death", () => {
    const held = { ...createCursor(), heldSkill: "golem" as const };

    expect(settleCursor(held, { paused: true, heroDead: false })).toEqual(
      createCursor(),
    );
    expect(settleCursor(held, { paused: false, heroDead: true })).toEqual(
      createCursor(),
    );
    expect(settleCursor(held, { paused: false, heroDead: false })).toEqual(
      held,
    );
  });
});

describe("the cursor on the Skill Bar", () => {
  const ON_RIGHT: CursorHit = {
    button: { type: "skillBarSlot", slot: "right" },
  };
  const ON_KEY1: CursorHit = { button: { type: "skillBarSlot", slot: "key1" } };

  /** A Hero with the Golem learned, so in the right-click slot. */
  function learned() {
    const at = scene();
    at.world.hero.progress.skillPoints = 1;
    step(at.world, [{ type: "SpendSkillPoint", skill: "golem" }]);
    return at;
  }

  it("picks up the Skill in a filled slot pressed on as the Held Skill", () => {
    const { cursor, orders, taken } = pressCursor(
      createCursor(),
      { at: { x: 700, y: 740 }, hit: ON_RIGHT },
      learned(),
    );

    expect(cursor.heldSkill).toBe("golem");
    expect(cursor.heldSkillSlot).toBe("right");
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("picks up nothing from an empty slot", () => {
    const { cursor, orders, taken } = pressCursor(
      createCursor(),
      { at: { x: 500, y: 740 }, hit: ON_KEY1 },
      learned(),
    );

    expect(cursor.heldSkill).toBeNull();
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("picks up nothing from a slot while an Item is held", () => {
    const at = learned();
    step(at.world, [{ type: "LiftItem", from: { column: 4, row: 1 } }]);

    const { cursor, orders } = pressCursor(
      createCursor(),
      { at: { x: 700, y: 740 }, hit: ON_RIGHT },
      at,
    );

    expect(cursor.heldSkill).toBeNull();
    expect(orders).toEqual([]);
  });

  it("leaves the Skill Bar as it is while the Skill is held", () => {
    const at = learned();
    pressCursor(createCursor(), { at: { x: 700, y: 740 }, hit: ON_RIGHT }, at);

    expect(at.world.hero.progress.skillBar.right).toBe("golem");
  });

  it("keeps the Skill held when released over the slot it was picked up from, for a second click", () => {
    const at = learned();
    const held = pressCursor(
      createCursor(),
      { at: { x: 700, y: 740 }, hit: ON_RIGHT },
      at,
    ).cursor;

    const { cursor, orders, taken } = releaseCursor(
      held,
      { at: { x: 701, y: 741 }, hit: ON_RIGHT, dragged: false },
      at,
    );

    expect(cursor.heldSkill).toBe("golem");
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("moves it by dragging onto another slot", () => {
    const at = learned();
    const held = pressCursor(
      createCursor(),
      { at: { x: 700, y: 740 }, hit: ON_RIGHT },
      at,
    ).cursor;

    const { cursor, orders } = releaseCursor(
      held,
      { at: { x: 500, y: 740 }, hit: ON_KEY1, dragged: true },
      at,
    );
    step(at.world, orders);

    expect(cursor).toEqual(createCursor());
    expect(at.world.hero.progress.skillBar).toMatchObject({
      right: null,
      key1: "golem",
    });
  });

  it("moves it by clicking another slot", () => {
    const at = learned();
    const press = { at: { x: 700, y: 740 }, hit: ON_RIGHT };
    let { cursor } = pressCursor(createCursor(), press, at);
    cursor = releaseCursor(cursor, { ...press, dragged: false }, at).cursor;

    const landed = pressCursor(
      cursor,
      { at: { x: 500, y: 740 }, hit: ON_KEY1 },
      at,
    );
    step(at.world, landed.orders);

    expect(landed.cursor).toEqual(createCursor());
    expect(at.world.hero.progress.skillBar).toMatchObject({
      right: null,
      key1: "golem",
    });
  });

  it("orders a put onto the slot clicked next, swapping with the Skill there by the Skill Bar's rule", () => {
    const { orders } = pressCursor(
      { ...createCursor(), heldSkill: "golem", heldSkillSlot: "right" },
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
      learned(),
    );

    expect(orders).toEqual([
      { type: "PutSkillOnBar", skill: "golem", slot: "key4" },
    ]);
  });

  it("lets go of it released off the Skill Bar, changing nothing", () => {
    const at = learned();
    const { cursor, orders } = releaseCursor(
      { ...createCursor(), heldSkill: "golem", heldSkillSlot: "right" },
      { ...OVER_THE_WORLD, dragged: true },
      at,
    );

    expect(cursor).toEqual(createCursor());
    expect(orders).toEqual([]);
  });

  it("forgets the slot it came from once landed, let go of, or settled", () => {
    const held = {
      ...createCursor(),
      heldSkill: "golem" as const,
      heldSkillSlot: "right" as const,
    };
    const at = learned();

    expect(
      pressCursor(held, { at: { x: 500, y: 740 }, hit: ON_KEY1 }, at).cursor,
    ).toEqual(createCursor());
    const release = { ...OVER_THE_WORLD, dragged: true };
    expect(releaseCursor(held, release, at).cursor).toEqual(createCursor());
    expect(settleCursor(held, { paused: true, heroDead: false })).toEqual(
      createCursor(),
    );
  });

  it("forgets the slot a Skill came from once picked up from the Skill Tree", () => {
    const { cursor } = pressCursor(
      createCursor(),
      { at: { x: 1000, y: 100 }, hit: ON_GOLEM },
      learned(),
    );

    expect(cursor.heldSkillSlot).toBeNull();
  });
});

describe("the cursor and casting", () => {
  it("leaves a point off the panels to the World while an Item is held, so a right-click there casts", () => {
    expect(forTheWorld({ drop: true })).toBeNull();
  });

  it("keeps the panels and HUD from the World", () => {
    expect(forTheWorld(ON_KEY4)).toEqual(ON_KEY4);
    expect(forTheWorld(onCell(0, 0))).toEqual(onCell(0, 0));
    expect(forTheWorld(null)).toBeNull();
  });
});

/**
 * An axe at (4, 1), a Ring of Strength at (0, 0), a Short Sword Equipped and
 * a Life Potion in the first Belt Column.
 */
const packed: Belongings = {
  inventory: [
    { type: "axe", cell: { column: 4, row: 1 } },
    { type: "ringOfStrength", cell: { column: 0, row: 0 } },
  ],
  equipment: { weapon: "shortSword" },
  belt: [["lifePotion"], [], [], []],
};

const { slots, belt } = inventoryPanelLayout(SCREEN, 1);
const centreOfRect = (rect: {
  x: number;
  y: number;
  w: number;
  h: number;
}) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});
/** Where a spot on the panel is, and what a point there hits. */
const at = (spot: ItemSpot): { at: Vec; hit: CursorHit } => {
  const point =
    typeof spot === "string"
      ? centreOfRect(slots[spot as EquipmentSlot])
      : "beltColumn" in spot
        ? centreOfRect(belt[spot.beltColumn][spot.row])
        : centreOf(spot.column, spot.row);
  return { at: point, hit: { inventory: spot } };
};

const packedWorld = () =>
  createWorld({ areas: { town }, seed: 1, belongings: packed });

/**
 * Presses at `from`, lets a step pass as a frame would, then lets go at
 * `to`, `dragged` past the drag threshold unless told otherwise, and steps
 * the release's orders. Hands back those orders and the World after them.
 */
function drag(
  from: { at: Vec; hit: CursorHit },
  to: { at: Vec | null; hit: CursorHit | null },
  {
    dragged = true,
    world = packedWorld(),
  }: { dragged?: boolean; world?: World } = {},
) {
  const scene = { world, screen: SCREEN };
  const pressed = pressCursor(createCursor(), from, scene);
  step(world, pressed.orders);
  const released = releaseCursor(pressed.cursor, { ...to, dragged }, scene);
  step(world, released.orders);
  return { orders: released.orders, cursor: released.cursor, world };
}

const typeAt = (world: World, column: number, row: number) =>
  inventoryItemAt(world, { column, row })?.item.type;
const heldType = (world: World) => cursorItemOf(world)?.item.type;

describe("dragging an Item", () => {
  it("moves it to a free spot on the grid, centred where it's let go", () => {
    const { world } = drag(
      at({ column: 4, row: 1 }),
      at({ column: 7, row: 2 }),
    );

    expect(typeAt(world, 7, 1)).toBe("axe");
    expect(typeAt(world, 4, 1)).toBeUndefined();
    expect(heldType(world)).toBeUndefined();
  });

  it("Equips it when let go over an empty Equipment slot of its kind", () => {
    const { world } = drag(at({ column: 0, row: 0 }), at("ring1"));

    expect(equipmentOf(world).ring1?.type).toBe("ringOfStrength");
    expect(typeAt(world, 0, 0)).toBeUndefined();
  });

  it("takes it off when dragged from its Equipment slot to the grid", () => {
    const { world } = drag(at("weapon"), at({ column: 9, row: 2 }));

    expect(equipmentOf(world).weapon).toBeNull();
    expect(typeAt(world, 9, 1)).toBe("shortSword");
  });

  it("swaps it with the one Item it's let go over, the other now held", () => {
    const { world } = drag(at({ column: 4, row: 1 }), at("weapon"));

    expect(equipmentOf(world).weapon?.type).toBe("axe");
    expect(heldType(world)).toBe("shortSword");
  });

  it("moves a Potion out of the panel's Belt Columns and back in", () => {
    const { world } = drag(
      at({ beltColumn: 0, row: 0 }),
      at({ column: 9, row: 3 }),
    );

    expect(typeAt(world, 9, 3)).toBe("lifePotion");
    expect(beltOf(world)[0]).toEqual([]);

    drag(at({ column: 9, row: 3 }), at({ beltColumn: 2, row: 0 }), { world });

    expect(beltOf(world)[2].map((item) => item.type)).toEqual(["lifePotion"]);
    expect(typeAt(world, 9, 3)).toBeUndefined();
  });

  it("leaves it held when let go where it can't go", () => {
    const { world, orders } = drag(at({ column: 4, row: 1 }), at("ring1"));

    expect(orders).toEqual([{ type: "PlaceItem", to: "ring1" }]);
    expect(heldType(world)).toBe("axe");
    expect(equipmentOf(world).ring1).toBeNull();
  });

  it("leaves it held when let go between the panel's spots or off the canvas", () => {
    for (const to of [
      { at: { x: 0, y: 0 }, hit: { inventory: null } },
      { at: null, hit: null },
    ]) {
      const { world, orders } = drag(at({ column: 4, row: 1 }), to);

      expect(orders).toEqual([]);
      expect(heldType(world)).toBe("axe");
    }
  });

  it("drops it at the Hero's feet when let go over the World, ordering nothing else", () => {
    const { world, orders } = drag(at({ column: 4, row: 1 }), {
      at: { x: 10, y: 10 },
      hit: { drop: true },
    });

    expect(orders).toEqual([{ type: "DropItem" }]);
    expect(heldType(world)).toBeUndefined();
    expect(groundItemsOf(world).map(({ item }) => item.type)).toEqual(["axe"]);
  });

  it("moves it even when let go within the frame it was pressed", () => {
    const world = packedWorld();
    const scene = { world, screen: SCREEN };

    const pressed = pressCursor(
      createCursor(),
      at({ column: 4, row: 1 }),
      scene,
    );
    const released = releaseCursor(
      pressed.cursor,
      { ...at({ column: 7, row: 2 }), dragged: true },
      scene,
    );
    step(world, [...pressed.orders, ...released.orders]);

    expect(typeAt(world, 7, 1)).toBe("axe");
    expect(heldType(world)).toBeUndefined();
  });

  it("drops it when let go over the World within the frame it was pressed", () => {
    const world = packedWorld();
    const scene = { world, screen: SCREEN };

    const pressed = pressCursor(
      createCursor(),
      at({ column: 4, row: 1 }),
      scene,
    );
    // Nothing was held yet as the release was hit-tested, so it isn't a drop
    // there but a point over the World.
    const released = releaseCursor(
      pressed.cursor,
      { at: { x: 10, y: 10 }, hit: null, dragged: true },
      scene,
    );

    expect(released.orders).toEqual([{ type: "DropItem" }]);
  });
});

describe("clicking an Item", () => {
  it("leaves it held when let go where it was pressed, even after a drag", () => {
    const { world, orders } = drag(
      at({ column: 4, row: 1 }),
      at({ column: 4, row: 1 }),
    );

    expect(orders).toEqual([]);
    expect(heldType(world)).toBe("axe");
  });

  it("leaves it held when let go below the drag threshold, even over another spot", () => {
    const { world, orders } = drag(
      at({ column: 4, row: 1 }),
      at({ column: 5, row: 1 }),
      { dragged: false },
    );

    expect(orders).toEqual([]);
    expect(heldType(world)).toBe("axe");
  });

  it("puts it down on the next press, a drag after it ordering nothing more", () => {
    const { world, cursor } = drag(
      at({ column: 4, row: 1 }),
      at({ column: 4, row: 1 }),
      { dragged: false },
    );
    const scene = { world, screen: SCREEN };

    const pressed = pressCursor(cursor, at({ column: 7, row: 2 }), scene);
    step(world, pressed.orders);
    const released = releaseCursor(
      pressed.cursor,
      { ...at({ column: 0, row: 3 }), dragged: true },
      scene,
    );
    step(world, released.orders);

    expect(typeAt(world, 7, 1)).toBe("axe");
    expect(released.orders).toEqual([]);
  });
});

const stripColumns = beltStripLayout(SCREEN).columns;
/** Where a Belt Column's square of the Belt strip is, and what it hits. */
const onStrip = (beltColumn: number): { at: Vec; hit: CursorHit } => ({
  at: centreOfRect(stripColumns[beltColumn]),
  hit: { button: null, beltColumn },
});

/**
 * A Belt of two rows: two Life Potions and a Mana Potion above them in the
 * first column, a Mana Potion in the third, and the Inventory empty.
 */
const belted: Belongings = {
  inventory: [],
  equipment: {},
  belt: [["lifePotion", "manaPotion"], [], ["manaPotion"], []],
};
const beltedWorld = () => {
  beltTuning.rowsWithoutBelt = 2;
  return createWorld({ areas: { town }, seed: 1, belongings: belted });
};
const beltTypes = (world: World) =>
  beltOf(world).map((column) => column.map((item) => item.type));

const tunedBelt = { ...beltTuning };
afterEach(() => {
  Object.assign(beltTuning, tunedBelt);
});

describe("the cursor on the Belt strip", () => {
  it("lifts the bottom Potion of the Belt Column pressed on, the ones above dropping down a row", () => {
    const world = beltedWorld();

    const { orders, taken } = pressCursor(createCursor(), onStrip(0), {
      world,
      screen: SCREEN,
    });
    step(world, orders);

    expect(taken).toBe(true);
    expect(heldType(world)).toBe("lifePotion");
    expect(beltTypes(world)[0]).toEqual(["manaPotion"]);
  });

  it("lifts nothing from an empty square, still keeping the press from the World", () => {
    const { orders, taken } = pressCursor(createCursor(), onStrip(1), {
      world: beltedWorld(),
      screen: SCREEN,
    });

    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("puts a held Potion into the Belt Column clicked next, at its lowest free row", () => {
    const { world, cursor } = drag(onStrip(0), onStrip(0), {
      dragged: false,
      world: beltedWorld(),
    });
    expect(heldType(world)).toBe("lifePotion");

    const { orders } = pressCursor(cursor, onStrip(2), {
      world,
      screen: SCREEN,
    });
    step(world, orders);

    expect(heldType(world)).toBeUndefined();
    expect(beltTypes(world)).toEqual([
      ["manaPotion"],
      [],
      ["manaPotion", "lifePotion"],
      [],
    ]);
  });

  it("puts a dragged Potion into the Belt Column it's let go over", () => {
    const { world } = drag(onStrip(0), onStrip(1), { world: beltedWorld() });

    expect(heldType(world)).toBeUndefined();
    expect(beltTypes(world)).toEqual([
      ["manaPotion"],
      ["lifePotion"],
      ["manaPotion"],
      [],
    ]);
  });

  it("leaves it held when let go over its own square, for a second click", () => {
    const { world, orders } = drag(onStrip(0), onStrip(0), {
      world: beltedWorld(),
    });

    expect(orders).toEqual([]);
    expect(heldType(world)).toBe("lifePotion");
  });

  it("leaves it held when its Belt Column is full", () => {
    const world = beltedWorld();
    step(world, [{ type: "LiftItem", from: { beltColumn: 2, row: 0 } }]);

    const { orders } = pressCursor(createCursor(), onStrip(0), {
      world,
      screen: SCREEN,
    });
    step(world, orders);

    expect(heldType(world)).toBe("manaPotion");
    expect(beltTypes(world)[0]).toEqual(["lifePotion", "manaPotion"]);
  });

  it("moves a Potion from the Belt strip to the open Inventory panel and back, by drag or click", () => {
    const { world } = drag(onStrip(0), at({ column: 9, row: 3 }));

    expect(typeAt(world, 9, 3)).toBe("lifePotion");
    expect(beltTypes(world)[0]).toEqual([]);

    drag(at({ column: 9, row: 3 }), onStrip(3), { world });

    expect(typeAt(world, 9, 3)).toBeUndefined();
    expect(beltTypes(world)[3]).toEqual(["lifePotion"]);

    const clicked = drag(onStrip(3), onStrip(3), { world, dragged: false });
    const { orders } = pressCursor(clicked.cursor, at({ column: 7, row: 3 }), {
      world,
      screen: SCREEN,
    });
    step(world, orders);

    expect(typeAt(world, 7, 3)).toBe("lifePotion");
    expect(beltTypes(world)[3]).toEqual([]);
  });

  it("moves a Potion between the panel's Belt Columns and the Belt strip", () => {
    const { world } = drag(at({ beltColumn: 0, row: 0 }), onStrip(1));

    expect(beltTypes(world)).toEqual([[], ["lifePotion"], [], []]);

    drag(onStrip(1), at({ beltColumn: 2, row: 0 }), { world });

    expect(beltTypes(world)).toEqual([[], [], ["lifePotion"], []]);
  });

  it("drops a Potion let go over the World with the Inventory panel shut, ordering nothing else", () => {
    const { world, orders } = drag(onStrip(0), OVER_THE_WORLD, {
      world: beltedWorld(),
    });

    expect(orders).toEqual([{ type: "DropItem" }]);
    expect(groundItemsOf(world).map(({ item }) => item.type)).toEqual([
      "lifePotion",
    ]);
  });

  it("drops a held Potion on the next click over the World with the Inventory panel shut, so the Hero doesn't walk", () => {
    const { world, cursor } = drag(onStrip(0), onStrip(0), {
      world: beltedWorld(),
      dragged: false,
    });

    const { orders, taken } = pressCursor(cursor, OVER_THE_WORLD, {
      world,
      screen: SCREEN,
    });

    expect(orders).toEqual([{ type: "DropItem" }]);
    expect(taken).toBe(true);
  });
});
