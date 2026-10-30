import { inside, middleOf, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { type World, waypointList } from "../sim/world";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";

/**
 * The Waypoint list panel in the middle of the screen (CSS px at native
 * scale, drawn at the UI Scale): `width` wide, its rows `rowHeight` apart
 * from `firstRow` down, each inside `padding`, and `hintHeight` under them
 * for its hint.
 */
export const WAYPOINT_LIST = {
  width: 300,
  padding: 18,
  firstRow: 56,
  rowHeight: 44,
  hintHeight: 28,
};

/** What the Waypoint list shows of one Waypoint, as text. */
export type WaypointSheet = {
  /** The Area the Waypoint is in. */
  area: string;
  name: string;
  /** Whether the Hero has touched it: untouched ones are greyed out. */
  touched: boolean;
  /** Whether the Hero stands on it now, so it can't be travelled to. */
  here: boolean;
};

/**
 * What the Waypoint list shows: Act 1's Waypoints in Main Path order, each
 * named by its Area's display name from `displayNames`.
 */
export function waypointListSheet(
  world: World,
  displayNames: Readonly<Record<string, string>>,
): WaypointSheet[] {
  return waypointList(world).map(({ area, touched }) => ({
    area,
    name: displayNames[area] ?? area,
    touched,
    here: area === world.areaName,
  }));
}

/**
 * Where the panel is drawn for `rows` Waypoints: centred on the screen, as
 * tall as its rows, or in the Compact Layout filling the screen.
 */
export function waypointListPanelRect(screen: Viewport, rows: number): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const { width, padding, firstRow, rowHeight, hintHeight } = atUiScale(
    WAYPOINT_LIST,
    screen.uiScale,
  );
  const h = firstRow + rows * rowHeight + hintHeight + padding;
  return {
    x: (screen.width - width) / 2,
    y: (screen.height - h) / 2,
    w: width,
    h,
  };
}

/**
 * Where the panel, its × close button and each Waypoint's row (CSS px) go,
 * at the UI Scale. The rows run down the panel from under its title, inside
 * its padding; in the Compact Layout, where the panel fills the screen, as
 * wide as on a desktop and centred.
 */
export function waypointListLayout(
  screen: Viewport,
  rows: number,
): { panel: Rect; closeButton: Rect; rows: Rect[] } {
  const { width, padding, firstRow, rowHeight } = atUiScale(
    WAYPOINT_LIST,
    screen.uiScale,
  );
  const panel = waypointListPanelRect(screen, rows);
  const w = width - 2 * padding;
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    rows: Array.from({ length: rows }, (_, index) => ({
      x: panel.x + (panel.w - w) / 2,
      y: panel.y + firstRow + index * rowHeight,
      w,
      h: rowHeight,
    })),
  };
}

/** The button on the open Waypoint list: travel to a touched Waypoint, or ×. */
export type WaypointButton = { type: "travel"; area: string };

/**
 * A click on the open Waypoint list, so not for the World: the × or the
 * Waypoint it travels to; null elsewhere on the panel, which does nothing.
 */
export type WaypointListHit = { button: WaypointButton | CloseButton | null };

/**
 * What a click at `point` hits of the Waypoint list, or null when it's off
 * the panel or the panel isn't `open`, so it's for the World. Only a touched
 * Waypoint other than the one the Hero stands on can be travelled to.
 */
export function waypointListHitAt(
  screen: Viewport,
  point: Vec,
  sheet: readonly WaypointSheet[],
  open: boolean,
): WaypointListHit | null {
  const layout = waypointListLayout(screen, sheet.length);
  if (!open || !inside(layout.panel, point)) return null;
  const closeHit = closeHitAt(layout, point, "waypoints");
  if (closeHit) return closeHit;
  const row = layout.rows.findIndex((rect) => inside(rect, point));
  const waypoint = sheet[row];
  if (waypoint && waypointPickable(waypoint)) {
    return { button: { type: "travel", area: waypoint.area } };
  }
  return { button: null };
}

/** Whether a Waypoint of the list can be picked: touched, and not here. */
export function waypointPickable(waypoint: WaypointSheet): boolean {
  return waypoint.touched && !waypoint.here;
}

/** A spot the Focus can rest on with the Waypoint list open. */
export type WaypointListFocusSpot = {
  rect: Rect;
  at: Vec;
  hit: WaypointListHit;
};

/**
 * The Waypoint list's Focus spots: each Waypoint's row, clicked in the
 * middle, then the ×. Untouched Waypoints and the one the Hero stands on
 * can be rested on but do nothing.
 */
export function waypointListFocusSpots(
  world: World,
  screen: Viewport,
): WaypointListFocusSpot[] {
  // Names don't change where anything is or what it hits.
  const sheet = waypointListSheet(world, {});
  const layout = waypointListLayout(screen, sheet.length);
  const spots = layout.rows.map((rect) => ({
    rect,
    at: middleOf(rect),
    hit: waypointListHitAt(screen, middleOf(rect), sheet, true) ?? {
      button: null,
    },
  }));
  const { closeButton } = layout;
  const hit: WaypointListHit = {
    button: { type: "close", panel: "waypoints" },
  };
  return [...spots, { rect: closeButton, at: middleOf(closeButton), hit }];
}
