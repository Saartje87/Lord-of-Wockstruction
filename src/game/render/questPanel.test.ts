import { describe, expect, it } from "vitest";
import { type FocusSpot, moveFocus } from "../input/focus";
import { DIRECTIONS } from "../input/pad";
import { createMenus } from "../menus";
import { QUEST_IDS } from "../sim/quests";
import { inside, middleOf } from "../sim/rect";
import { createWorld, type World } from "../sim/world";
import { questTuning } from "../tuning/quests";
import { type Viewport, viewportOf } from "../viewport";
import { compactPanelRect } from "./compactLayout";
import { cursorHitAt } from "./cursorHit";
import { panelFocusSpots } from "./panelFocus";
import {
  QUEST_PANEL,
  questFocusSpots,
  questPanelHitAt,
  questPanelLayout,
  questPanelSheet,
} from "./questPanel";
import { skillTreePanelRect } from "./skillTreePanel";

/** A one-tile Town. */
function world(): World {
  const town = {
    orientation: "orthogonal",
    width: 1,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    properties: [{ name: "act", type: "int", value: 1 }],
    layers: [
      { type: "tilelayer", name: "floor", width: 1, height: 1, data: [1] },
      {
        type: "objectgroup",
        name: "objects",
        objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
      },
    ],
  };
  return createWorld({ areas: { town }, seed: 1 });
}

const WIDE = viewportOf({ width: 1280, height: 800 });
const COMPACT = viewportOf({ width: 800, height: 400 });
const SCREENS: [string, Viewport][] = [
  ["wide", WIDE],
  ["compact", COMPACT],
];
const ROWS = QUEST_IDS.length;

describe("the Quest panel's sheet", () => {
  it("lists Act 1's Quests in order, each Not given at first, with no next step", () => {
    const sheet = questPanelSheet(world());

    expect(sheet.map(({ name }) => name)).toEqual([
      "Bog Off",
      "Lost Wanderer",
      "Spa Day",
      "Wock the Dead",
    ]);
    expect(sheet.map(({ stateName }) => stateName)).toEqual([
      "Not given",
      "Not given",
      "Not given",
      "Not given",
    ]);
    expect(sheet.map(({ nextStep }) => nextStep)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("words each state, and gives a next step only for a Quest that is Given", () => {
    const w = world();
    const { quests } = w.hero.progress;
    quests["lost-wanderer"].state = "given";
    quests["spa-day"].state = "ready";
    quests["act-boss"].state = "done";

    const sheet = questPanelSheet(w);

    expect(sheet.map(({ stateName }) => stateName)).toEqual([
      "Not given",
      "Given",
      "Ready to hand in",
      "Done",
    ]);
    expect(sheet[1].nextStep).toBe(questTuning["lost-wanderer"].nextStep);
    expect(sheet[0].nextStep).toBeNull();
    expect(sheet[2].nextStep).toBeNull();
    expect(sheet[3].nextStep).toBeNull();
  });

  it("counts the parts left of a Quest that asks for several", () => {
    const w = world();
    w.hero.progress.quests["bog-off"] = { state: "given", count: 2 };

    expect(questPanelSheet(w)[0].nextStep).toBe(
      `${questTuning["bog-off"].nextStep} (1 left)`,
    );
  });
});

describe("the Quest panel's layout", () => {
  it("sits at the top right where the Skill Tree panel does, and fills a compact screen", () => {
    const wide = questPanelLayout(WIDE, ROWS).panel;
    expect(wide.x).toBe(skillTreePanelRect(WIDE).x);
    expect(wide.y).toBe(skillTreePanelRect(WIDE).y);
    expect(questPanelLayout(COMPACT, ROWS).panel).toEqual(
      compactPanelRect(COMPACT),
    );
  });

  it.each(
    SCREENS,
  )("keeps every row inside the panel, apart and under the × (%s)", (_, screen) => {
    const { panel, rows, closeButton } = questPanelLayout(screen, ROWS);
    expect(rows).toHaveLength(ROWS);
    for (const row of rows) {
      expect(row.x).toBeGreaterThanOrEqual(panel.x);
      expect(row.x + row.w).toBeLessThanOrEqual(panel.x + panel.w);
    }
    rows.slice(1).forEach((row, i) => {
      expect(row.y).toBeGreaterThanOrEqual(rows[i].y + rows[i].h);
    });
    expect(closeButton.y + closeButton.h).toBeLessThan(rows[0].y);
  });

  it("gives each row room for a name and two lines of next step", () => {
    expect(QUEST_PANEL.rowHeight).toBeGreaterThanOrEqual(60);
  });
});

describe("a click on the Quest panel", () => {
  const w = world();
  const { closeButton, rows } = questPanelLayout(WIDE, ROWS);

  it("shuts with the ×", () => {
    expect(questPanelHitAt(WIDE, middleOf(closeButton), w, true)).toEqual({
      button: { type: "close", panel: "quest" },
    });
  });

  it("does nothing on a row, but is not for the World", () => {
    expect(questPanelHitAt(WIDE, middleOf(rows[0]), w, true)).toEqual({
      button: null,
    });
  });

  it("is for the World off the panel, or while shut", () => {
    expect(questPanelHitAt(WIDE, { x: 1, y: 1 }, w, true)).toBeNull();
    expect(questPanelHitAt(WIDE, middleOf(rows[0]), w, false)).toBeNull();
  });
});

describe("the Quest panel's Focus spots", () => {
  const w = world();
  const open = { ...createMenus(), questOpen: true };

  it.each(SCREENS)("are the × alone (%s)", (_, screen) => {
    expect(panelFocusSpots("quest", w, screen).map((spot) => spot.hit)).toEqual(
      [{ button: { type: "close", panel: "quest" } }],
    );
  });

  it.each(SCREENS)("each point where a click hits it (%s)", (_, screen) => {
    for (const spot of questFocusSpots(w, screen)) {
      expect(cursorHitAt(screen, spot.at, w, open)).toEqual(spot.hit);
    }
  });

  it.each(SCREENS)("stay put when moved from (%s)", (_, screen) => {
    const spots: FocusSpot[] = questFocusSpots(w, screen);
    for (const direction of DIRECTIONS) {
      expect(moveFocus(spots, spots[0], direction)).toBe(spots[0]);
    }
  });
});

describe("the Quest panel on touch", () => {
  const w = world();
  const open = { ...createMenus(), questOpen: true };

  it.each(
    SCREENS,
  )("closes from a near miss on the × without reaching a row (%s)", (_, screen) => {
    const { closeButton } = questPanelLayout(screen, ROWS);
    const near = { x: closeButton.x - 5, y: middleOf(closeButton).y };
    expect(cursorHitAt(screen, near, w, open, true)).toEqual({
      button: { type: "close", panel: "quest" },
    });
  });

  it.each(SCREENS)("hits the panel itself on a row (%s)", (_, screen) => {
    const { rows, panel } = questPanelLayout(screen, ROWS);
    const point = middleOf(rows[0]);
    expect(inside(panel, point)).toBe(true);
    expect(cursorHitAt(screen, point, w, open, true)).toEqual({ button: null });
  });
});
