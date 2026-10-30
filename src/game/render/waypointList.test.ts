import { describe, expect, it } from "vitest";
import { type FocusSpot, moveFocus } from "../input/focus";
import { DIRECTIONS } from "../input/pad";
import { createMenus } from "../menus";
import { inside, middleOf, type Rect } from "../sim/rect";
import { combatArea } from "../sim/testAreas";
import { createWorld, FRESH_PROGRESS, type World } from "../sim/world";
import { type Viewport, viewportOf } from "../viewport";
import { compactPanelRect } from "./compactLayout";
import { cursorHitAt } from "./cursorHit";
import { panelFocusSpots } from "./panelFocus";
import {
  WAYPOINT_LIST,
  waypointListFocusSpots,
  waypointListHitAt,
  waypointListLayout,
  waypointListSheet,
} from "./waypointList";

/** A one-row Area with the Hero's `start` and a Waypoint on its tiles. */
function area(properties: object[] = []) {
  const point = (name: string, type: string, x: number) => ({
    name,
    type,
    point: true,
    x: x * 32 + 16,
    y: 16,
  });
  return {
    orientation: "orthogonal",
    width: 3,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 3,
        height: 1,
        data: [1, 1, 1],
      },
      {
        type: "objectgroup",
        name: "objects",
        objects: [point("start", "entry", 0), point("waypoint", "waypoint", 1)],
      },
    ],
    properties: [{ name: "act", type: "int", value: 1 }, ...properties],
  };
}

const NAMES = { town: "Wockville", bog: "Soggy Bog", cave: "Catacombs" };

/** Wockville, then the Bog and the Catacombs, with `touched` Waypoints touched. */
function world(touched: string[]): World {
  return createWorld({
    areas: {
      town: area(),
      bog: combatArea(area(), 3),
      cave: combatArea(area(), 7),
    },
    seed: 1,
    progress: { ...FRESH_PROGRESS, touchedWaypoints: touched },
  });
}

const WIDE = viewportOf({ width: 1280, height: 800 });
const COMPACT = viewportOf({ width: 800, height: 400 });
const SCREENS: [string, Viewport][] = [
  ["wide", WIDE],
  ["compact", COMPACT],
];

describe("the Waypoint list's sheet", () => {
  it("names Act 1's Waypoints in Main Path order and greys the untouched", () => {
    expect(waypointListSheet(world(["town", "bog"]), NAMES)).toEqual([
      { area: "town", name: "Wockville", touched: true, here: true },
      { area: "bog", name: "Soggy Bog", touched: true, here: false },
      { area: "cave", name: "Catacombs", touched: false, here: false },
    ]);
  });
});

describe("the Waypoint list's layout", () => {
  it("centres the panel on a wide screen and fills a compact one", () => {
    const wide = waypointListLayout(WIDE, 3).panel;
    expect(wide.x + wide.w / 2).toBeCloseTo(WIDE.width / 2);
    expect(wide.y + wide.h / 2).toBeCloseTo(WIDE.height / 2);
    expect(waypointListLayout(COMPACT, 3).panel).toEqual(
      compactPanelRect(COMPACT),
    );
  });

  it.each(
    SCREENS,
  )("keeps the rows inside the panel and apart (%s)", (_, screen) => {
    const { panel, rows, closeButton } = waypointListLayout(screen, 3);
    for (const row of rows) {
      expect(inside(panel, middleOf(row))).toBe(true);
      expect(row.x).toBeGreaterThanOrEqual(panel.x);
      expect(row.x + row.w).toBeLessThanOrEqual(panel.x + panel.w);
    }
    expect(rows[1].y).toBeGreaterThanOrEqual(rows[0].y + rows[0].h);
    expect(closeButton.y + closeButton.h).toBeLessThan(rows[0].y);
  });

  it("makes each row at least a fingertip tall at a UI Scale of 1", () => {
    expect(WAYPOINT_LIST.rowHeight).toBeGreaterThanOrEqual(44);
  });
});

describe("a click on the Waypoint list", () => {
  const sheet = waypointListSheet(world(["town", "bog"]), NAMES);
  const rows = waypointListLayout(WIDE, 3).rows;

  it("travels to a touched Waypoint", () => {
    expect(waypointListHitAt(WIDE, middleOf(rows[1]), sheet, true)).toEqual({
      button: { type: "travel", area: "bog" },
    });
  });

  it("does nothing on an untouched Waypoint or the one the Hero is on", () => {
    expect(waypointListHitAt(WIDE, middleOf(rows[2]), sheet, true)).toEqual({
      button: null,
    });
    expect(waypointListHitAt(WIDE, middleOf(rows[0]), sheet, true)).toEqual({
      button: null,
    });
  });

  it("shuts with the ×", () => {
    const { closeButton } = waypointListLayout(WIDE, 3);
    expect(waypointListHitAt(WIDE, middleOf(closeButton), sheet, true)).toEqual(
      { button: { type: "close", panel: "waypoints" } },
    );
  });

  it("is for the World off the panel, or while shut", () => {
    expect(waypointListHitAt(WIDE, { x: 1, y: 1 }, sheet, true)).toBeNull();
    expect(waypointListHitAt(WIDE, middleOf(rows[1]), sheet, false)).toBeNull();
  });
});

describe("the Waypoint list's Focus spots", () => {
  const w = world(["town", "bog"]);
  const open = { ...createMenus(), waypointsOpen: true };

  it.each(SCREENS)("are each row and the × (%s)", (_, screen) => {
    const spots = panelFocusSpots("waypoints", w, screen);
    expect(spots.map((spot) => spot.hit)).toEqual([
      { button: null },
      { button: { type: "travel", area: "bog" } },
      { button: null },
      { button: { type: "close", panel: "waypoints" } },
    ]);
  });

  it.each(SCREENS)("each point where a click hits it (%s)", (_, screen) => {
    for (const spot of waypointListFocusSpots(w, screen)) {
      expect(cursorHitAt(screen, spot.at, w, open)).toEqual(spot.hit);
    }
  });

  it.each(SCREENS)("are each reachable from any other (%s)", (_, screen) => {
    const spots: FocusSpot[] = waypointListFocusSpots(w, screen);
    for (const from of spots) {
      const reached = new Set<FocusSpot>([from]);
      const next: FocusSpot[] = [from];
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
  });
});

describe("the Waypoint list on touch", () => {
  const w = world(["town", "bog"]);
  const open = { ...createMenus(), waypointsOpen: true };

  it.each(SCREENS)("takes a tap on a row as a click (%s)", (_, screen) => {
    const { rows } = waypointListLayout(screen, 3);
    expect(cursorHitAt(screen, middleOf(rows[1]), w, open, true)).toEqual({
      button: { type: "travel", area: "bog" },
    });
  });

  it.each(
    SCREENS,
  )("closes from a near miss on the × without reaching a row (%s)", (_, screen) => {
    const { closeButton, rows } = waypointListLayout(screen, 3);
    const near = { x: closeButton.x - 5, y: middleOf(closeButton).y };
    expect(cursorHitAt(screen, near, w, open, true)).toEqual({
      button: { type: "close", panel: "waypoints" },
    });
    // The ×'s hit area stops halfway to the first row, never onto it.
    for (let y = closeButton.y; y < rows[0].y + rows[0].h; y += 1) {
      const point = { x: middleOf(closeButton).x, y };
      const hit = cursorHitAt(screen, point, w, open, true);
      if (inside(rows[0] as Rect, point)) {
        expect(hit).not.toEqual({
          button: { type: "close", panel: "waypoints" },
        });
      }
    }
  });
});
