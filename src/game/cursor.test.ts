import { describe, expect, it } from "vitest";
import {
  type CursorHit,
  createCursor,
  forTheWorld,
  pressCursor,
  releaseCursor,
  settleCursor,
} from "./cursor";
import { inventoryPanelLayout } from "./render/inventoryPanel";
import { emptyBelt } from "./sim/belt";
import type { Belongings } from "./sim/inventory";
import { createWorld, step } from "./sim/world";

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
      { at: centreOf(8, 2), hit: onCell(8, 2) },
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
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
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
      { at: { x: 1002, y: 101 }, hit: ON_GOLEM },
      at,
    );

    expect(cursor.heldSkill).toBe("golem");
    expect(orders).toEqual([]);
    expect(taken).toBe(true);
  });

  it("lets go of the Held Skill released anywhere else, changing nothing", () => {
    const at = scene();
    const held = { heldSkill: "golem" as const };

    for (const release of [
      OVER_THE_WORLD,
      { at: null, hit: null },
      { at: centreOf(0, 0), hit: onCell(0, 0) },
    ]) {
      const { cursor, orders } = releaseCursor(held, release, at);

      expect(orders).toEqual([]);
      expect(cursor.heldSkill).toBeNull();
    }
  });

  it("puts the Held Skill into the Skill Bar slot clicked next", () => {
    const { cursor, orders, taken } = pressCursor(
      { heldSkill: "golem" },
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
        { heldSkill: "golem" },
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
      { heldSkill: "golem" },
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
      at,
    ).cursor;

    const { cursor, orders } = releaseCursor(
      after,
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
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
      { at: { x: 600, y: 740 }, hit: ON_KEY4 },
      scene(),
    );

    expect(orders).toEqual([]);
    expect(cursor).toEqual(createCursor());
  });

  it("lets go of the Held Skill on a pause or the Hero's Death", () => {
    const held = { heldSkill: "golem" as const };

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
