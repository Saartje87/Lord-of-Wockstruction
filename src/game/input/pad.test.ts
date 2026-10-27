import { afterEach, describe, expect, it } from "vitest";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { inputTuning } from "../tuning/input";
import {
  createPadInput,
  type PadButton,
  type PadInput,
  type PadSnapshot,
  pollPad,
} from "./pad";
import { arenaWith } from "./testArena";

/**
 * Treats canvas points as tile units, so tests can speak in tiles, over
 * `world` (an empty Area unless given).
 */
const tilesOver = (world: World = arenaWith([])) => ({
  toTile: (screen: Vec) => screen,
  world,
});
const asTiles = tilesOver();

const original = { ...inputTuning };
afterEach(() => {
  Object.assign(inputTuning, original);
});

/** A snapshot with the stick at `stick` and no button down. */
const stickAt = (stick: Vec): PadSnapshot => ({
  stick,
  pressed: [],
  held: [],
  released: [],
});

describe("pad input", () => {
  it("orders a walk in the direction the stick points", () => {
    const input = createPadInput();

    const { orders } = pollPad(input, stickAt({ x: 0.6, y: -0.8 }), 0, asTiles);

    expect(orders).toEqual([{ type: "Walk", direction: { x: 0.6, y: -0.8 } }]);
  });

  it("orders the walk again every frame the stick is held", () => {
    const input = createPadInput();
    pollPad(input, stickAt({ x: 1, y: 0 }), 0, asTiles);

    const { orders } = pollPad(input, stickAt({ x: 1, y: 0 }), 16, asTiles);

    expect(orders).toEqual([{ type: "Walk", direction: { x: 1, y: 0 } }]);
  });

  it("orders nothing with the stick let go", () => {
    const input = createPadInput();
    pollPad(input, stickAt({ x: 1, y: 0 }), 0, asTiles);

    const { orders } = pollPad(input, stickAt({ x: 0, y: 0 }), 16, asTiles);

    expect(orders).toEqual([]);
  });

  it("orders nothing inside the dead zone, and walks just past it", () => {
    const input = createPadInput();
    const edge = inputTuning.stickDeadZone;

    const inside = pollPad(input, stickAt({ x: 0, y: edge * 0.9 }), 0, asTiles);
    expect(inside.orders).toEqual([]);
    const diagonal = { x: edge * 0.6, y: edge * 0.6 };
    expect(pollPad(input, stickAt(diagonal), 0, asTiles).orders).toEqual([]);

    const past = pollPad(input, stickAt({ x: 0, y: edge * 1.1 }), 0, asTiles);
    expect(past.orders).toEqual([
      { type: "Walk", direction: { x: 0, y: edge * 1.1 } },
    ]);
  });

  // On screen, up the stick is up the screen; the view turns that into the
  // World's tiles, as an isometric view would.
  it("walks the way the stick points on screen, in tiles", () => {
    const input = createPadInput();
    const turned = {
      world: asTiles.world,
      toTile: (screen: Vec) => ({
        x: 10 + screen.x + screen.y,
        y: 4 + screen.y - screen.x,
      }),
    };

    const { orders } = pollPad(input, stickAt({ x: 0, y: -1 }), 0, turned);

    expect(orders).toEqual([{ type: "Walk", direction: { x: -1, y: -1 } }]);
  });
});

/** A snapshot with the stick at rest, `button` going down this frame. */
const press = (button: PadButton): PadSnapshot => ({
  stick: { x: 0, y: 0 },
  pressed: [button],
  held: [button],
  released: [],
});
/** A snapshot with the stick at rest and `button` held from before. */
const hold = (button: PadButton): PadSnapshot => ({
  ...press(button),
  pressed: [],
});

/** A World with the Hero at (10, 10) facing east, and Skeletons at `at`. */
function facingEast(at: Vec[]): World {
  const world = arenaWith(at);
  world.hero.facing = 0;
  return world;
}

/** Lays a Ground Item with id `id` on the floor at `pos`. */
function lay(world: World, id: number, pos: Vec) {
  world.groundItems.push({ item: { id, type: "shortSword" }, pos });
}

describe("the Target", () => {
  it("is the Monster ahead of the Hero's facing, with the stick at rest", () => {
    const world = facingEast([
      { x: 8, y: 10 },
      { x: 13, y: 10 },
    ]);
    const rest = stickAt({ x: 0, y: 0 });

    const { target } = pollPad(createPadInput(), rest, 0, tilesOver(world));

    expect(target).toBe(world.monsters[1].id);
  });

  it("is the Monster ahead of the stick while it is pushed", () => {
    const world = facingEast([
      { x: 8, y: 10 },
      { x: 13, y: 10 },
    ]);
    const west = stickAt({ x: -1, y: 0 });

    const { target } = pollPad(createPadInput(), west, 0, tilesOver(world));

    expect(target).toBe(world.monsters[0].id);
  });

  it("is none with no Monster ahead", () => {
    const world = facingEast([{ x: 8, y: 10 }]);
    const rest = stickAt({ x: 0, y: 0 });

    const { target } = pollPad(createPadInput(), rest, 0, tilesOver(world));

    expect(target).toBeNull();
  });
});

describe("A", () => {
  it("attacks the Target", () => {
    const world = facingEast([{ x: 13, y: 10 }]);

    const { orders } = pollPad(
      createPadInput(),
      press("a"),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([{ type: "Attack", monster: world.monsters[0].id }]);
  });

  it("with no Target picks up the nearest Ground Item within reach", () => {
    inputTuning.groundItemReach = 1.5;
    const world = facingEast([{ x: 8, y: 10 }]);
    lay(world, 1, { x: 11.2, y: 10 });
    lay(world, 2, { x: 10, y: 9 });
    lay(world, 3, { x: 9.5, y: 10 });

    const { orders } = pollPad(
      createPadInput(),
      press("a"),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([{ type: "PickUp", groundItem: 3 }]);
  });

  it("with no Target and every Ground Item out of reach does nothing", () => {
    inputTuning.groundItemReach = 1.5;
    const world = facingEast([]);
    lay(world, 1, { x: 11.6, y: 10 });

    const { orders } = pollPad(
      createPadInput(),
      press("a"),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([]);
  });

  it("with neither a Target nor a Ground Item does nothing", () => {
    const { orders } = pollPad(createPadInput(), press("a"), 0, asTiles);

    expect(orders).toEqual([]);
  });

  it("aims with the stick instead of walking while it attacks", () => {
    const world = facingEast([{ x: 10, y: 13 }]);
    const aimed = { ...press("a"), stick: { x: 0, y: 1 } };

    const { orders } = pollPad(createPadInput(), aimed, 0, tilesOver(world));

    expect(orders).toEqual([{ type: "Attack", monster: world.monsters[0].id }]);
  });

  it("walks with the stick when held with nothing to act on", () => {
    const held = { ...hold("a"), stick: { x: 1, y: 0 } };

    const { orders } = pollPad(createPadInput(), held, 0, asTiles);

    expect(orders).toEqual([{ type: "Walk", direction: { x: 1, y: 0 } }]);
  });
});

describe("holding A", () => {
  /** Presses A at 1000 ms over `world`, returning the pad's input. */
  function pressedAt1000(world: World): PadInput {
    const input = createPadInput();
    pollPad(input, press("a"), 1000, tilesOver(world));
    return input;
  }

  it("attacks again on the retarget interval", () => {
    inputTuning.retargetMs = 120;
    const world = facingEast([{ x: 13, y: 10 }]);
    const input = pressedAt1000(world);
    const attack = { type: "Attack", monster: world.monsters[0].id };
    const at = (nowMs: number) =>
      pollPad(input, hold("a"), nowMs, tilesOver(world)).orders;

    expect(at(1119)).toEqual([]);
    expect(at(1120)).toEqual([attack]);
    expect(at(1200)).toEqual([]);
    expect(at(1240)).toEqual([attack]);
  });

  it("moves on to a new Target when the old one dies", () => {
    const world = facingEast([
      { x: 12, y: 10 },
      { x: 14, y: 10 },
    ]);
    const input = pressedAt1000(world);
    const next = world.monsters[1].id;
    world.monsters.splice(0, 1);

    const later = 1000 + inputTuning.retargetMs;
    const { orders, target } = pollPad(
      input,
      hold("a"),
      later,
      tilesOver(world),
    );

    expect(target).toBe(next);
    expect(orders).toEqual([{ type: "Attack", monster: next }]);
  });

  it("stops once let go", () => {
    const world = facingEast([{ x: 13, y: 10 }]);
    const input = pressedAt1000(world);
    const letGo: PadSnapshot = { ...stickAt({ x: 0, y: 0 }), released: ["a"] };

    const later = 1000 + inputTuning.retargetMs;
    expect(pollPad(input, letGo, later, tilesOver(world)).orders).toEqual([]);
  });

  it("acts at once on a fresh press, however soon", () => {
    const world = facingEast([{ x: 13, y: 10 }]);
    const input = pressedAt1000(world);
    pollPad(input, stickAt({ x: 0, y: 0 }), 1016, tilesOver(world));

    const { orders } = pollPad(input, press("a"), 1032, tilesOver(world));

    expect(orders).toEqual([{ type: "Attack", monster: world.monsters[0].id }]);
  });
});
