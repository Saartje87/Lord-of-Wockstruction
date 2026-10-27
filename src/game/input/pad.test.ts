import { afterEach, describe, expect, it } from "vitest";
import { createMenus, type Menus } from "../menus";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import { type SimEvent, step, type World } from "../sim/world";
import { inputTuning } from "../tuning/input";
import type { FocusSpot } from "./focus";
import {
  bothPads,
  createPadInput,
  hideFocus,
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
const tilesOver = (world: World = arenaWith([]), menus = createMenus()) => ({
  toTile: (screen: Vec) => screen,
  world,
  menus,
  focusSpots: [] as FocusSpot[],
});
const asTiles = tilesOver();

/** A snapshot of the pad left alone. */
const restAt: PadSnapshot = {
  stick: { x: 0, y: 0 },
  pressed: [],
  held: [],
  released: [],
};

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
      ...asTiles,
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
  const rest = stickAt({ x: 0, y: 0 });
  const targetOf = (world: World, snapshot: PadSnapshot) =>
    pollPad(createPadInput(), snapshot, 0, tilesOver(world)).target;

  it("is a Monster behind the Hero, with the stick at rest", () => {
    const world = facingEast([{ x: 8, y: 10 }]);

    expect(targetOf(world, rest)).toBe(world.monsters[0].id);
  });

  it("is a Monster beside the Hero, with the stick at rest", () => {
    const world = facingEast([{ x: 10, y: 12 }]);

    expect(targetOf(world, rest)).toBe(world.monsters[0].id);
  });

  it("is the nearest of the Monsters around the Hero, with the stick at rest", () => {
    const world = facingEast([
      { x: 14, y: 10 },
      { x: 8, y: 10 },
      { x: 10, y: 5 },
    ]);

    expect(targetOf(world, rest)).toBe(world.monsters[1].id);
  });

  it("is the nearest Monster ahead of the stick while it is pushed, even with a nearer one behind", () => {
    const world = facingEast([
      { x: 8, y: 10 },
      { x: 13, y: 10 },
    ]);

    expect(targetOf(world, stickAt({ x: 1, y: 0 }))).toBe(world.monsters[1].id);
    expect(targetOf(world, stickAt({ x: -1, y: 0 }))).toBe(
      world.monsters[0].id,
    );
  });

  it("counts a stick inside the dead zone as at rest", () => {
    inputTuning.stickDeadZone = 0.2;
    const world = facingEast([
      { x: 8, y: 10 },
      { x: 13, y: 10 },
    ]);

    expect(targetOf(world, stickAt({ x: 0.1, y: 0 }))).toBe(
      world.monsters[0].id,
    );
  });

  it("is none beyond reach, with the stick at rest", () => {
    inputTuning.targetRange = 6;
    const world = facingEast([{ x: 3.9, y: 10 }]);

    expect(targetOf(world, rest)).toBeNull();
  });

  it("is never a dead Monster or a Corpse, with the stick at rest", () => {
    const world = facingEast([
      { x: 9, y: 10 },
      { x: 5, y: 10 },
    ]);
    world.monsters[0].life = 0;
    world.corpses.push({ id: 99, type: "skeleton", pos: { x: 10, y: 9 } });

    expect(targetOf(world, rest)).toBe(world.monsters[1].id);
  });

  it("is none with no Monster in reach", () => {
    expect(targetOf(facingEast([]), rest)).toBeNull();
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

  it("attacks a Monster behind the Hero, with the stick at rest", () => {
    const world = facingEast([{ x: 8, y: 10 }]);

    const { orders } = pollPad(
      createPadInput(),
      press("a"),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([{ type: "Attack", monster: world.monsters[0].id }]);
  });

  it("attacks a Monster in reach rather than picking up a Ground Item at the Hero's feet", () => {
    const world = facingEast([{ x: 8, y: 10 }]);
    lay(world, 1, { x: 10, y: 10 });

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
    const world = facingEast([{ x: 3, y: 10 }]);
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

  it("walks with the stick and attacks the Target ahead of it", () => {
    const world = facingEast([{ x: 10, y: 13 }]);
    const aimed = { ...press("a"), stick: { x: 0, y: 1 } };

    const { orders } = pollPad(createPadInput(), aimed, 0, tilesOver(world));

    expect(orders).toEqual([
      { type: "Walk", direction: { x: 0, y: 1 } },
      { type: "Attack", monster: world.monsters[0].id },
    ]);
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

  it("moves on to the nearest Monster in any direction when one dies, with the stick at rest", () => {
    const world = facingEast([
      { x: 8, y: 10 },
      { x: 10, y: 14 },
    ]);
    const input = pressedAt1000(world);
    const next = world.monsters[1].id;
    world.monsters.splice(0, 1);

    const later = 1000 + inputTuning.retargetMs;
    const { orders } = pollPad(input, hold("a"), later, tilesOver(world));

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

/** `world` with the Golem in every Skill Bar slot. */
function golemEverywhere(world: World): World {
  for (const slot of SKILL_BAR_SLOTS) {
    world.hero.progress.skillBar[slot] = "golem";
  }
  return world;
}

describe("the Skill buttons", () => {
  it.each([
    ["x", "key1"],
    ["y", "key2"],
    ["b", "key3"],
    ["rb", "key4"],
    ["rt", "right"],
  ] as const)("%s casts slot %s's Skill at the Target", (button, slot) => {
    const world = golemEverywhere(facingEast([{ x: 13, y: 10 }]));

    const { orders } = pollPad(
      createPadInput(),
      press(button),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([{ type: "Cast", slot, target: { x: 13, y: 10 } }]);
  });

  it("casts at a Monster behind the Hero, with the stick at rest", () => {
    const world = golemEverywhere(facingEast([{ x: 8, y: 10 }]));

    const { orders } = pollPad(
      createPadInput(),
      press("x"),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([
      { type: "Cast", slot: "key1", target: { x: 8, y: 10 } },
    ]);
  });

  it("with no Target casts the tuned distance ahead of the Hero's facing", () => {
    inputTuning.castDistance = 3;
    const world = golemEverywhere(facingEast([{ x: 3, y: 10 }]));
    world.hero.facing = Math.PI / 2;

    const { orders } = pollPad(
      createPadInput(),
      press("x"),
      0,
      tilesOver(world),
    );

    expect(orders).toHaveLength(1);
    const [cast] = orders;
    if (cast.type !== "Cast") throw new Error("No Cast");
    expect(cast.target.x).toBeCloseTo(10);
    expect(cast.target.y).toBeCloseTo(13);
  });

  it("with no Target casts the tuned distance ahead of the stick, walking", () => {
    inputTuning.castDistance = 3;
    const world = golemEverywhere(facingEast([]));
    const aimed = { ...press("rt"), stick: { x: -0.3, y: -0.4 } };

    const { orders } = pollPad(createPadInput(), aimed, 0, tilesOver(world));

    expect(orders).toEqual([
      { type: "Walk", direction: { x: -0.3, y: -0.4 } },
      { type: "Cast", slot: "right", target: { x: 8.2, y: 7.6 } },
    ]);
  });

  it("with no Target casts a Skill that uses a Corpse up at the Hero, walking or not", () => {
    inputTuning.castDistance = 3;
    const world = facingEast([]);
    world.hero.progress.skillBar.right = "raiseSkeleton";
    const aimed = { ...press("rt"), stick: { x: -0.3, y: -0.4 } };

    const standing = pollPad(
      createPadInput(),
      press("rt"),
      0,
      tilesOver(world),
    );
    const walking = pollPad(createPadInput(), aimed, 0, tilesOver(world));

    expect(standing.orders).toEqual([
      { type: "Cast", slot: "right", target: { x: 10, y: 10 } },
    ]);
    expect(walking.orders).toContainEqual({
      type: "Cast",
      slot: "right",
      target: { x: 10, y: 10 },
    });
  });

  it("casts a Skill that uses a Corpse up at the Target", () => {
    const world = facingEast([{ x: 13, y: 10 }]);
    world.hero.progress.skillBar.right = "raiseSkeleton";

    const { orders } = pollPad(
      createPadInput(),
      press("rt"),
      0,
      tilesOver(world),
    );

    expect(orders).toEqual([
      { type: "Cast", slot: "right", target: { x: 13, y: 10 } },
    ]);
  });

  it("casts nothing from an empty slot, and the stick walks", () => {
    const world = facingEast([{ x: 13, y: 10 }]);
    const held = { ...press("x"), stick: { x: 1, y: 0 } };

    const { orders } = pollPad(createPadInput(), held, 0, tilesOver(world));

    expect(orders).toEqual([{ type: "Walk", direction: { x: 1, y: 0 } }]);
  });

  it("casts again on the retarget interval while held", () => {
    inputTuning.retargetMs = 120;
    const world = golemEverywhere(facingEast([{ x: 13, y: 10 }]));
    const input = createPadInput();
    const cast = { type: "Cast", slot: "key2", target: { x: 13, y: 10 } };
    expect(pollPad(input, press("y"), 1000, tilesOver(world)).orders).toEqual([
      cast,
    ]);
    const at = (nowMs: number) =>
      pollPad(input, hold("y"), nowMs, tilesOver(world)).orders;

    expect(at(1119)).toEqual([]);
    expect(at(1120)).toEqual([cast]);
    expect(at(1239)).toEqual([]);
    expect(at(1240)).toEqual([cast]);
  });

  it("keeps each held button's interval apart", () => {
    inputTuning.retargetMs = 120;
    const world = golemEverywhere(facingEast([{ x: 13, y: 10 }]));
    const input = createPadInput();
    pollPad(input, press("x"), 1000, tilesOver(world));
    const both: PadSnapshot = { ...restAt, pressed: ["y"], held: ["x", "y"] };

    const { orders } = pollPad(input, both, 1060, tilesOver(world));

    expect(orders).toEqual([
      { type: "Cast", slot: "key2", target: { x: 13, y: 10 } },
    ]);
  });

  it("summons the Golem as a key does", () => {
    inputTuning.castDistance = 3;
    const world = golemEverywhere(arenaWith([], { combat: true }));
    world.hero.progress.skillLevels.golem = 1;
    world.hero.facing = 0;

    const { orders } = pollPad(
      createPadInput(),
      press("rt"),
      0,
      tilesOver(world),
    );
    for (let i = 0; i < 120; i++) step(world, i === 0 ? orders : []);

    expect(world.minions[0]?.type).toBe("golem");
    expect(world.minions[0]?.pos.x).toBeCloseTo(13, 0);
    expect(world.minions[0]?.pos.y).toBeCloseTo(10, 0);
  });
});

/**
 * Plays `frames` frames of 60 Hz over `world`, holding `held` with the stick
 * at `stick`, stepping the World once a frame. Returns the events.
 */
function play(
  world: World,
  held: PadButton,
  stick: Vec,
  frames: number,
): SimEvent[] {
  const input = createPadInput();
  const events: SimEvent[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const snapshot: PadSnapshot = {
      stick,
      pressed: frame === 0 ? [held] : [],
      held: [held],
      released: [],
    };
    const nowMs = (frame * 1000) / 60;
    const { orders } = pollPad(input, snapshot, nowMs, tilesOver(world));
    events.push(...step(world, orders));
  }
  return events;
}

describe("kiting, the stick walking while a button acts", () => {
  it("walks the Hero and keeps casting while a Skill button is held", () => {
    const world = golemEverywhere(arenaWith([], { combat: true }));
    world.hero.progress.skillLevels.golem = 1;
    world.hero.mana = 1000;

    const events = play(world, "x", { x: 1, y: 0 }, 120);

    const casts = events.filter(({ type }) => type === "SkillCast");
    expect(casts.length).toBeGreaterThanOrEqual(2);
    expect(world.hero.pos.x).toBeGreaterThan(11);
  });

  it("walks the Hero into reach of the Target and swings at it", () => {
    const world = arenaWith([{ x: 13, y: 10 }], { combat: true });

    const events = play(world, "a", { x: 1, y: 0 }, 90);

    const swings = events.filter(
      (event) =>
        (event.type === "HitLanded" && event.attacker === "hero") ||
        (event.type === "Missed" && event.target !== "hero"),
    );
    expect(swings.length).toBeGreaterThanOrEqual(1);
  });
});

describe("the D-pad", () => {
  it.each([
    ["left", 0],
    ["up", 1],
    ["right", 2],
    ["down", 3],
  ] as const)("%s drinks from Belt Column %i (from 0)", (button, column) => {
    const { orders } = pollPad(createPadInput(), press(button), 0, asTiles);

    expect(orders).toEqual([{ type: "DrinkFromBelt", column }]);
  });

  it("drinks once a press, however long it is held", () => {
    const input = createPadInput();
    pollPad(input, press("left"), 0, asTiles);

    const later = 10 * inputTuning.retargetMs;
    expect(pollPad(input, hold("left"), later, asTiles).orders).toEqual([]);
  });
});

describe("LB", () => {
  it("opens a Town Portal", () => {
    const { orders } = pollPad(createPadInput(), press("lb"), 0, asTiles);

    expect(orders).toEqual([{ type: "OpenTownPortal" }]);
  });

  it("opens one once a press, however long it is held", () => {
    const input = createPadInput();
    pollPad(input, press("lb"), 0, asTiles);

    const later = 10 * inputTuning.retargetMs;
    expect(pollPad(input, hold("lb"), later, asTiles).orders).toEqual([]);
  });
});

/** Menus with the Inventory panel open. */
function inventoryOpen(): Menus {
  const menus = createMenus();
  menus.inventoryOpen = true;
  return menus;
}

describe("with a panel open", () => {
  it("the stick walks nothing", () => {
    const view = tilesOver(arenaWith([]), inventoryOpen());

    const { orders } = pollPad(
      createPadInput(),
      stickAt({ x: 1, y: 0 }),
      0,
      view,
    );

    expect(orders).toEqual([]);
  });

  it.each([
    "left",
    "up",
    "right",
    "down",
    "a",
    "b",
    "x",
    "y",
    "rb",
    "rt",
    "lb",
  ] as const)("%s orders nothing in the World", (button) => {
    const world = golemEverywhere(facingEast([{ x: 13, y: 10 }]));
    const view = tilesOver(world, inventoryOpen());

    const { orders } = pollPad(createPadInput(), press(button), 0, view);

    expect(orders).toEqual([]);
  });

  it("shows no Target", () => {
    const view = tilesOver(facingEast([{ x: 13, y: 10 }]), inventoryOpen());

    expect(pollPad(createPadInput(), restAt, 0, view).target).toBeNull();
  });
});

/** A 3×2 grid of unit Focus spots, each clicked at its middle. */
const SPOTS: FocusSpot[] = [0, 1].flatMap((row) =>
  [0, 1, 2].map((column) => ({
    rect: { x: column, y: row, w: 1, h: 1 },
    at: { x: column + 0.5, y: row + 0.5 },
    hit: { inventory: { column, row } },
  })),
);
const spotAt = (column: number, row: number) =>
  SPOTS[row * 3 + column] as FocusSpot;

/** The Inventory panel open over `spots`. */
const focusView = (spots: FocusSpot[] = SPOTS) => ({
  ...tilesOver(arenaWith([]), inventoryOpen()),
  focusSpots: spots,
});

/** Pad input that has shown the Focus on its first spot. */
function focused(): PadInput {
  const input = createPadInput();
  pollPad(input, press("right"), 0, focusView());
  return input;
}

describe("the Focus", () => {
  it("isn't shown until the pad is pressed, then rests on the first spot", () => {
    const input = createPadInput();

    expect(pollPad(input, restAt, 0, focusView()).focus).toBeNull();
    expect(pollPad(input, press("right"), 16, focusView()).focus).toEqual(
      spotAt(0, 0),
    );
  });

  it("is shown in a panel after the pad was pressed with none open", () => {
    const input = createPadInput();
    pollPad(input, press("view"), 0, asTiles);

    expect(pollPad(input, restAt, 16, focusView()).focus).toEqual(spotAt(0, 0));
  });

  it("isn't shown with no panel open", () => {
    const input = focused();

    expect(pollPad(input, restAt, 16, asTiles).focus).toBeNull();
  });

  it("moves with the D-pad and a push of the stick", () => {
    const input = focused();

    pollPad(input, press("right"), 16, focusView());
    pollPad(input, stickAt({ x: 0, y: 1 }), 32, focusView());

    expect(pollPad(input, restAt, 48, focusView()).focus).toEqual(spotAt(1, 1));
  });

  it("stays on its spot as the spots are laid out afresh", () => {
    const input = focused();
    pollPad(input, press("down"), 16, focusView());
    const moved = SPOTS.map((spot) => ({
      ...spot,
      at: { x: spot.at.x + 0.25, y: spot.at.y },
    }));

    expect(pollPad(input, restAt, 32, focusView(moved)).focus).toEqual(
      moved[3],
    );
  });

  it("goes back to the first spot when its own is gone", () => {
    const input = focused();
    pollPad(input, press("down"), 16, focusView());

    const { focus } = pollPad(input, restAt, 32, focusView(SPOTS.slice(0, 3)));

    expect(focus).toEqual(spotAt(0, 0));
  });

  it("A clicks the focused spot, once a press", () => {
    const input = focused();
    pollPad(input, press("right"), 16, focusView());

    const { click } = pollPad(input, press("a"), 32, focusView());
    expect(click).toEqual({ at: { x: 1.5, y: 0.5 }, hit: spotAt(1, 0).hit });
    expect(pollPad(input, hold("a"), 1000, focusView()).click).toBeNull();
  });

  it("X right-clicks the focused spot", () => {
    const { rightClick, click } = pollPad(
      focused(),
      press("x"),
      16,
      focusView(),
    );

    expect(rightClick).toEqual({
      at: { x: 0.5, y: 0.5 },
      hit: spotAt(0, 0).hit,
    });
    expect(click).toBeNull();
  });

  it("X clicks a spot's second hit where it has one, as on a learned Skill", () => {
    const pickUp = { button: { type: "pickUpSkill", skill: "golem" } } as const;
    const spots = SPOTS.map((spot) => ({ ...spot, secondHit: pickUp }));
    const input = createPadInput();
    pollPad(input, press("right"), 0, focusView(spots));

    const { rightClick, click } = pollPad(
      input,
      press("x"),
      16,
      focusView(spots),
    );

    expect(click).toEqual({ at: { x: 0.5, y: 0.5 }, hit: pickUp });
    expect(rightClick).toBeNull();
  });

  it("goes to the nearest spot when its own is gone", () => {
    const input = focused();
    pollPad(input, press("right"), 16, focusView());
    pollPad(input, press("down"), 32, focusView());

    const { focus } = pollPad(input, restAt, 48, focusView(SPOTS.slice(0, 3)));

    expect(focus).toEqual(spotAt(1, 0));
  });

  it("keeps to its own spot among spots with the same hit", () => {
    const blank = SPOTS.map((spot) => ({ ...spot, hit: { button: null } }));
    const input = createPadInput();
    pollPad(input, press("right"), 0, focusView(blank));
    pollPad(input, press("right"), 16, focusView(blank));

    const { focus } = pollPad(input, restAt, 32, focusView(blank));

    expect(focus).toEqual(blank[1]);
  });

  it("Y clicks off the panel at the Focus, dropping a Held Item", () => {
    const { click } = pollPad(focused(), press("y"), 16, focusView());

    expect(click).toEqual({ at: { x: 0.5, y: 0.5 }, hit: { drop: true } });
  });

  it("the first press only shows it, clicking nothing", () => {
    const { click, focus } = pollPad(
      createPadInput(),
      press("a"),
      0,
      focusView(),
    );

    expect(focus).toEqual(spotAt(0, 0));
    expect(click).toBeNull();
  });

  it("is hidden by other input until the pad is pressed again", () => {
    const input = focused();
    hideFocus(input);

    expect(pollPad(input, restAt, 16, focusView()).focus).toBeNull();
    expect(pollPad(input, press("a"), 32, focusView()).click).toBeNull();
  });
});

describe("during Death", () => {
  /** A World with the Hero lying dead, a Skeleton ahead of them. */
  function deadAhead(): World {
    const world = golemEverywhere(facingEast([{ x: 13, y: 10 }]));
    world.death = { elapsed: 0 };
    return world;
  }

  it("A goes back to Town and orders nothing else", () => {
    const pushed = { ...press("a"), stick: { x: 1, y: 0 } };

    const { orders } = pollPad(
      createPadInput(),
      pushed,
      0,
      tilesOver(deadAhead()),
    );

    expect(orders).toEqual([{ type: "Continue" }]);
  });

  it("A goes back to Town once a press, however long it is held", () => {
    const input = createPadInput();
    pollPad(input, press("a"), 0, tilesOver(deadAhead()));

    const later = 10 * inputTuning.retargetMs;
    const { orders } = pollPad(input, hold("a"), later, tilesOver(deadAhead()));

    expect(orders).toEqual([]);
  });

  it.each([
    "x",
    "rt",
    "left",
    "lb",
  ] as const)("%s and the stick order nothing", (button) => {
    const pushed = { ...press(button), stick: { x: 1, y: 0 } };

    const { orders } = pollPad(
      createPadInput(),
      pushed,
      0,
      tilesOver(deadAhead()),
    );

    expect(orders).toEqual([]);
  });

  it("shows no Target", () => {
    const { target } = pollPad(
      createPadInput(),
      restAt,
      0,
      tilesOver(deadAhead()),
    );

    expect(target).toBeNull();
  });
});

describe("the presses for the menus", () => {
  it("are the buttons pressed this frame", () => {
    const snapshot: PadSnapshot = {
      ...restAt,
      pressed: ["menu", "lb"],
      held: ["menu", "lb", "a"],
    };

    const { presses } = pollPad(createPadInput(), snapshot, 0, asTiles);

    expect(presses).toEqual(["menu", "lb"]);
  });

  it.each([
    [{ x: 0.9, y: 0.2 }, "right"],
    [{ x: -0.9, y: 0.2 }, "left"],
    [{ x: 0.2, y: -0.9 }, "up"],
    [{ x: -0.2, y: 0.9 }, "down"],
  ] as const)("count a push of the stick to %o as %s", (stick, button) => {
    const { presses } = pollPad(createPadInput(), stickAt(stick), 0, asTiles);

    expect(presses).toEqual([button]);
  });

  it("count a push of the stick once, until it comes back to rest", () => {
    const input = createPadInput();
    const pushed = stickAt({ x: 1, y: 0 });
    pollPad(input, pushed, 0, asTiles);

    expect(pollPad(input, pushed, 16, asTiles).presses).toEqual([]);
    expect(pollPad(input, restAt, 32, asTiles).presses).toEqual([]);
    expect(pollPad(input, pushed, 48, asTiles).presses).toEqual(["right"]);
  });

  it("count nothing for the stick inside the dead zone", () => {
    const edge = inputTuning.stickDeadZone;
    const { presses } = pollPad(
      createPadInput(),
      stickAt({ x: edge * 0.9, y: 0 }),
      0,
      asTiles,
    );

    expect(presses).toEqual([]);
  });
});

describe("two pads at once, the controller and the touch controls", () => {
  it("take the stick pushed further", () => {
    const pad = bothPads(stickAt({ x: 0.3, y: 0 }), stickAt({ x: 0, y: -0.9 }));

    expect(pad.stick).toEqual({ x: 0, y: -0.9 });
  });

  it("give the buttons of both", () => {
    const pad = bothPads(
      { ...restAt, pressed: ["a"], held: ["a", "x"], released: ["y"] },
      { ...restAt, pressed: ["rt"], held: ["rt", "a"], released: ["b"] },
    );

    expect(pad).toEqual({
      stick: { x: 0, y: 0 },
      pressed: ["a", "rt"],
      held: ["a", "x", "rt"],
      released: ["y", "b"],
    });
  });

  it("let go of a button only once neither holds it", () => {
    const pad = bothPads(
      { ...restAt, released: ["a"] },
      { ...restAt, held: ["a"] },
    );

    expect(pad).toMatchObject({ held: ["a"], released: [] });
  });
});
