import { describe, expect, it } from "vitest";
import type { CursorHit } from "../cursor";
import { type FocusDirection, type FocusSpot, moveFocus } from "../input/focus";
import { noPendingPoints, type PendingPoints } from "../menus";
import { emptyBelt } from "../sim/belt";
import { type Belongings, EQUIPMENT_SLOTS } from "../sim/inventory";
import { SKILL_BAR_SLOTS } from "../sim/skillBar";
import {
  ATTRIBUTES,
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  SKILLS,
  step,
  type World,
} from "../sim/world";
import { heroTuning } from "../tuning/hero";
import { inventoryTuning } from "../tuning/items";
import { skillTuning } from "../tuning/skills";
import { type Viewport, viewportOf } from "../viewport";
import { cursorHitAt } from "./cursorHit";
import {
  inventoryHitAt,
  inventoryPanelLayout,
  landingCell,
} from "./inventoryPanel";
import { panelFocusSpots } from "./panelFocus";

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

const world = (belongings?: Belongings, progress?: Partial<Progress>) =>
  createWorld({
    areas: { town },
    seed: 1,
    belongings,
    progress: progress && { ...FRESH_PROGRESS, ...progress },
  });

const WIDE = viewportOf({ width: 1280, height: 800 });
const COMPACT = viewportOf({ width: 800, height: 400 });

/** Belongings with a Belt Equipped, so each Belt Column has four rows. */
const belted: Belongings = {
  inventory: [],
  equipment: { belt: "platedBelt" },
  belt: emptyBelt(),
};

const DIRECTIONS: FocusDirection[] = ["up", "down", "left", "right"];

const key = (hit: CursorHit | null) => JSON.stringify(hit);

/** The spot in `spots` whose hit is `hit`. */
function spotOf(spots: FocusSpot[], hit: CursorHit): FocusSpot {
  const spot = spots.find((one) => key(one.hit) === key(hit));
  if (!spot) throw new Error(`no spot for ${key(hit)}`);
  return spot;
}

/** Where the Focus goes from `hit` going `direction`, as a hit. */
function move(spots: FocusSpot[], hit: CursorHit, direction: FocusDirection) {
  return moveFocus(spots, spotOf(spots, hit), direction).hit;
}

const cell = (column: number, row: number) => ({
  inventory: { column, row },
});
const belt = (beltColumn: number, row: number) => ({
  inventory: { beltColumn, row },
});
const slot = (name: (typeof EQUIPMENT_SLOTS)[number]) => ({ inventory: name });
const close = { button: { type: "close", panel: "inventory" } } as const;

describe("the Inventory panel's Focus spots", () => {
  const screens: [string, Viewport][] = [
    ["wide", WIDE],
    ["compact", COMPACT],
  ];
  const worlds: [string, () => World][] = [
    ["no Belt", () => world()],
    ["a Belt", () => world(belted)],
  ];

  it.each(
    screens.flatMap(([name, screen]) =>
      worlds.map(([with_, made]) => [name, with_, screen, made] as const),
    ),
  )("are every cell, slot, Belt Column cell and the × (%s, %s)", (_, __, screen, made) => {
    const w = made();
    const rows = w.hero.equipment.belt ? 4 : 1;
    const spots = panelFocusSpots("inventory", w, screen);
    const { columns, rows: gridRows } = inventoryTuning;

    expect(spots).toHaveLength(columns * gridRows + 6 + 4 * rows + 1);
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < gridRows; row++) spotOf(spots, cell(column, row));
    }
    for (const name of EQUIPMENT_SLOTS) spotOf(spots, slot(name));
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < rows; row++) spotOf(spots, belt(column, row));
    }
    spotOf(spots, close);
  });

  it.each(
    screens.flatMap(([name, screen]) =>
      worlds.map(([with_, made]) => [name, with_, screen, made] as const),
    ),
  )("each point where a click hits it (%s, %s)", (_, __, screen, made) => {
    const w = made();
    const rows = w.hero.equipment.belt ? 4 : 1;
    for (const spot of panelFocusSpots("inventory", w, screen)) {
      expect(inventoryHitAt(screen, spot.at, true, false, rows)).toEqual(
        spot.hit,
      );
    }
  });

  it.each(
    screens.flatMap(([name, screen]) =>
      worlds.map(([with_, made]) => [name, with_, screen, made] as const),
    ),
  )("are each reachable from any other (%s, %s)", (_, __, screen, made) => {
    const spots = panelFocusSpots("inventory", made(), screen);
    for (const from of spots) {
      const reached = new Set([key(from.hit)]);
      const next = [from];
      while (next.length > 0) {
        const at = next.pop() as FocusSpot;
        for (const direction of DIRECTIONS) {
          const to = moveFocus(spots, at, direction);
          if (reached.has(key(to.hit))) continue;
          reached.add(key(to.hit));
          next.push(to);
        }
      }
      expect(reached.size).toBe(spots.length);
    }
  });

  it("moves one cell at a time across the grid, staying at its edges", () => {
    const spots = panelFocusSpots("inventory", world(), WIDE);
    const { columns, rows } = inventoryTuning;
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const from = cell(column, row);
        expect(move(spots, from, "left")).toEqual(
          cell(Math.max(0, column - 1), row),
        );
        expect(move(spots, from, "right")).toEqual(
          column === columns - 1 ? from : cell(column + 1, row),
        );
        expect(move(spots, from, "down")).toEqual(
          cell(column, Math.min(rows - 1, row + 1)),
        );
        if (row > 0)
          expect(move(spots, from, "up")).toEqual(cell(column, row - 1));
      }
    }
  });

  it("goes up from the grid's top row to what lies above it", () => {
    const spots = panelFocusSpots("inventory", world(), WIDE);

    expect(move(spots, cell(0, 0), "up")).toEqual(slot("weapon"));
    expect(move(spots, cell(3, 0), "up")).toEqual(belt(0, 0));
    expect(move(spots, cell(6, 0), "up")).toEqual(belt(3, 0));
    expect(move(spots, cell(9, 0), "up")).toEqual(belt(3, 0));
  });

  it("goes up and down a Belt Column, and from it to the grid and the Belt", () => {
    const spots = panelFocusSpots("inventory", world(belted), WIDE);

    expect(move(spots, belt(1, 0), "up")).toEqual(belt(1, 1));
    expect(move(spots, belt(1, 1), "down")).toEqual(belt(1, 0));
    expect(move(spots, belt(1, 3), "up")).toEqual(slot("belt"));
    expect(move(spots, belt(0, 0), "down")).toEqual(cell(3, 0));
    expect(move(spots, belt(0, 2), "right")).toEqual(belt(1, 2));
  });

  it("goes between the Equipment slots as they lie", () => {
    const spots = panelFocusSpots("inventory", world(), WIDE);

    expect(move(spots, slot("weapon"), "right")).toEqual(slot("armour"));
    expect(move(spots, slot("armour"), "left")).toEqual(slot("weapon"));
    expect(move(spots, slot("armour"), "right")).toEqual(slot("amulet"));
    expect(move(spots, slot("armour"), "down")).toEqual(slot("belt"));
    expect(move(spots, slot("belt"), "left")).toEqual(slot("ring1"));
    expect(move(spots, slot("belt"), "right")).toEqual(slot("ring2"));
    expect(move(spots, slot("amulet"), "up")).toEqual(close);
  });

  it("are none for a shut panel, or one with no Focus spots yet", () => {
    expect(panelFocusSpots(null, world(), WIDE)).toEqual([]);
  });

  it("lands a held Item on the focused cell, kept on the grid", () => {
    const w = world({
      inventory: [{ type: "axe", cell: { column: 0, row: 0 } }],
      equipment: {},
      belt: emptyBelt(),
    });
    step(w, [{ type: "LiftItem", from: { column: 0, row: 0 } }]);
    const spots = panelFocusSpots("inventory", w, WIDE);
    const layout = inventoryPanelLayout(WIDE, 1);
    const landsAt = (hit: CursorHit) =>
      landingCell(layout, spotOf(spots, hit).at, "axe");

    // An Axe is 2×3.
    expect(landsAt(cell(4, 1))).toEqual({ column: 4, row: 1 });
    expect(landsAt(cell(9, 3))).toEqual({ column: 8, row: 1 });
  });
});

/** Every spot of `spots` reached from each by moving the Focus about. */
function expectAllReachable(spots: FocusSpot[]) {
  for (const from of spots) {
    const reached = new Set([from]);
    const next = [from];
    while (next.length > 0) {
      const at = next.pop() as FocusSpot;
      for (const direction of DIRECTIONS) {
        const to = moveFocus(spots, at, direction);
        if (reached.has(to)) continue;
        reached.add(to);
        next.push(to);
      }
    }
    expect(reached.size).toBe(spots.length);
  }
}

const SCREENS: [string, Viewport][] = [
  ["wide", WIDE],
  ["compact", COMPACT],
];

describe("the Hero panel's Focus spots", () => {
  const raise = (attribute: (typeof ATTRIBUTES)[number]) =>
    ({ button: { type: "raise", attribute } }) as const;
  const lower = (attribute: (typeof ATTRIBUTES)[number]) =>
    ({ button: { type: "lower", attribute } }) as const;
  const accept = { button: { type: "accept" } } as const;
  const heroClose = { button: { type: "close", panel: "hero" } } as const;
  /** A Hero with 5 Attribute Points, 2 of them pending on Strength. */
  const leveled = () => world(undefined, { level: 2, attributePoints: 5 });
  const pending = (): PendingPoints => ({ ...noPendingPoints(), strength: 2 });
  const shown = (pendingPoints: PendingPoints) => ({
    heroPanelOpen: true,
    inventoryOpen: false,
    skillTreeOpen: false,
    pendingPoints,
  });

  it.each(SCREENS)("are every + and −, Accept and the × (%s)", (_, screen) => {
    const spots = panelFocusSpots("hero", leveled(), screen, pending());

    expect(spots).toHaveLength(ATTRIBUTES.length + 1 + 1 + 1);
    for (const attribute of ATTRIBUTES) spotOf(spots, raise(attribute));
    spotOf(spots, lower("strength"));
    spotOf(spots, accept);
    spotOf(spots, heroClose);
  });

  it("are only the buttons shown: the × with no points to place", () => {
    expect(panelFocusSpots("hero", world(), WIDE).map((s) => s.hit)).toEqual([
      heroClose,
    ]);
  });

  it.each(SCREENS)("each point where a click hits it (%s)", (_, screen) => {
    const w = leveled();
    for (const spot of panelFocusSpots("hero", w, screen, pending())) {
      expect(cursorHitAt(screen, spot.at, w, shown(pending()))).toEqual(
        spot.hit,
      );
    }
  });

  it.each(SCREENS)("are each reachable from any other (%s)", (_, screen) => {
    expectAllReachable(panelFocusSpots("hero", leveled(), screen, pending()));
  });

  it("goes down the + buttons, across to a −, and down to Accept", () => {
    const spots = panelFocusSpots("hero", leveled(), WIDE, pending());

    expect(move(spots, raise("strength"), "down")).toEqual(raise("dexterity"));
    expect(move(spots, raise("dexterity"), "up")).toEqual(raise("strength"));
    expect(move(spots, raise("strength"), "left")).toEqual(lower("strength"));
    expect(move(spots, lower("strength"), "right")).toEqual(raise("strength"));
    expect(move(spots, raise("energy"), "down")).toEqual(accept);
  });
});

describe("the Skill Tree panel's Focus spots", () => {
  const learn = (skill: (typeof SKILLS)[number]) =>
    ({ button: { type: "learn", skill } }) as const;
  const pickUp = (skill: (typeof SKILLS)[number]) =>
    ({ button: { type: "pickUpSkill", skill } }) as const;
  const barSlot = (slot: (typeof SKILL_BAR_SLOTS)[number]) =>
    ({ button: { type: "skillBarSlot", slot } }) as const;
  const treeClose = { button: { type: "close", panel: "skillTree" } } as const;
  const shown = {
    heroPanelOpen: false,
    inventoryOpen: false,
    skillTreeOpen: true,
    pendingPoints: noPendingPoints(),
  };
  const learnedSkills = Object.fromEntries(SKILLS.map((s) => [s, 1])) as Record<
    (typeof SKILLS)[number],
    number
  >;
  /** The Level from which a Skill Point can be spent on every Skill. */
  const everySkillOpen = Math.max(
    ...SKILLS.map((skill) => skillTuning[skill].requiredLevel),
  );
  const worlds: [string, () => World][] = [
    [
      "Skill Points to spend",
      () =>
        world(undefined, {
          level: everySkillOpen,
          experience: heroTuning.experienceTable[everySkillOpen - 1],
          skillPoints: 1,
        }),
    ],
    ["learned Skills", () => world(undefined, { skillLevels: learnedSkills })],
  ];
  const cases = SCREENS.flatMap(([name, screen]) =>
    worlds.map(([with_, made]) => [name, with_, screen, made] as const),
  );

  it.each(
    cases,
  )("are every Skill, Skill Bar slot and the × (%s, %s)", (_, __, screen, made) => {
    const spots = panelFocusSpots("skillTree", made(), screen);

    expect(spots).toHaveLength(SKILLS.length + SKILL_BAR_SLOTS.length + 1);
    for (const slot of SKILL_BAR_SLOTS) spotOf(spots, barSlot(slot));
    spotOf(spots, treeClose);
  });

  it("puts each Skill's spot on its +, spending a point, while it can", () => {
    const spots = panelFocusSpots("skillTree", worlds[0][1](), WIDE);
    for (const skill of SKILLS) spotOf(spots, learn(skill));
  });

  it("picks a learned Skill up with the second face button", () => {
    const spots = panelFocusSpots("skillTree", worlds[1][1](), WIDE);
    for (const skill of SKILLS) {
      expect(spotOf(spots, pickUp(skill)).secondHit).toEqual(pickUp(skill));
    }
  });

  it("is a Skill not yet learned, with nothing to press, while no point can be spent", () => {
    const spots = panelFocusSpots("skillTree", world(), WIDE);

    expect(spots).toHaveLength(SKILLS.length + SKILL_BAR_SLOTS.length + 1);
    expect(spots[0].hit).toEqual({ button: null });
    expect(spots[0].secondHit).toBeUndefined();
  });

  it.each(
    cases,
  )("each point where a click hits it (%s, %s)", (_, __, screen, made) => {
    const w = made();
    for (const spot of panelFocusSpots("skillTree", w, screen)) {
      expect(cursorHitAt(screen, spot.at, w, shown)).toEqual(spot.hit);
    }
  });

  it.each(
    cases,
  )("are each reachable from any other (%s, %s)", (_, __, screen, made) => {
    expectAllReachable(panelFocusSpots("skillTree", made(), screen));
  });

  it("goes down from the last Skill to the Skill Bar, and up to the ×", () => {
    const spots = panelFocusSpots("skillTree", worlds[1][1](), WIDE);
    const last = pickUp(SKILLS[SKILLS.length - 1]);
    const first = pickUp(SKILLS[0]);

    expect(SKILL_BAR_SLOTS.map(barSlot)).toContainEqual(
      move(spots, last, "down"),
    );
    expect(move(spots, first, "up")).toEqual(treeClose);
    expect(move(spots, barSlot("key1"), "right")).toEqual(barSlot("key2"));
  });
});
