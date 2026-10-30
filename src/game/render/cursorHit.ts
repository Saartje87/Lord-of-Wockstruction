import type { CursorHit } from "../cursor";
import {
  type ClosablePanel,
  hasPendingPoints,
  type Menus,
  type OpenPanels,
  PANELS,
} from "../menus";
import { beltRows } from "../sim/belt";
import { cursorItemOf } from "../sim/inventory";
import { inside, overlaps, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { ATTRIBUTES, canRaiseSkill, SKILLS, type World } from "../sim/world";
import type { Viewport } from "../viewport";
import { beltStripHitAt, beltStripLayout } from "./beltStrip";
import {
  canRaise,
  hasUnspentPoints,
  heroPanelHitAt,
  heroPanelLayout,
  heroPanelRow,
  levelUpHitAt,
  PANEL_ROWS,
} from "./heroPanel";
import {
  dialogueHitAt,
  dialogueLayout,
  dialogueSheet,
} from "./dialoguePanel";
import { inventoryHitAt, inventoryPanelLayout } from "./inventoryPanel";
import { miniMapHitAt, miniMapLayout, miniMapShown } from "./miniMap";
import { panelButtonHitAt, panelButtonsLayout } from "./panelButtons";
import { skillBarHitAt, skillBarLayout } from "./skillBar";
import { skillTreeHitAt, skillTreePanelLayout } from "./skillTreePanel";
import { touchControlsLayout } from "./touchControls";
import { touchHitRect } from "./touchHitArea";
import {
  waypointListHitAt,
  waypointListLayout,
  waypointListSheet,
} from "./waypointList";

/** The panels as drawn: which are open, and the Hero panel's Pending Attribute Points. */
export type ShownPanels = OpenPanels & Pick<Menus, "pendingPoints" | "mapOpen" | "dialogueNpc">;

/**
 * What a point on the screen hits of the panels and the HUD, or null when
 * it's for the World. An open panel is drawn over the HUD, so it takes a
 * point over both before the Skill Bar, the Belt strip and the Panel
 * buttons do; off the Inventory panel with an Item held, a point on none of
 * them is a drop. A `touch` also hits the small buttons from their touch
 * hit areas around them.
 */
export function cursorHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  shown: ShownPanels,
  touch = false,
): CursorHit | null {
  if (touch) {
    const hit = touchHitAt(screen, point, world, shown);
    if (hit) return hit;
  }
  const rows = beltRows(world);
  const { inventoryOpen } = shown;
  const holding = cursorItemOf(world) !== null;
  const waypoints = shown.waypointsOpen ? waypointListSheet(world, {}) : [];
  return (
    dialogueHitAt(
      screen,
      point,
      dialogueSheet(world, shown.dialogueNpc),
      shown.dialogueOpen,
    ) ??
    waypointListHitAt(screen, point, waypoints, shown.waypointsOpen) ??
    heroPanelHitAt(
      screen,
      point,
      world,
      shown.heroPanelOpen,
      shown.pendingPoints,
    ) ??
    skillTreeHitAt(screen, point, world, shown.skillTreeOpen) ??
    // Only on the panel itself here: off it, the HUD comes before a drop.
    inventoryHitAt(screen, point, inventoryOpen, false, rows) ??
    // Under the panels, which cover it in the Compact Layout.
    levelUpHitAt(screen, point, world) ??
    skillBarHitAt(screen, point) ??
    beltStripHitAt(screen, point) ??
    (miniMapShown(shown, world.death !== null)
      ? miniMapHitAt(screen, point)
      : null) ??
    panelButtonHitAt(screen, point) ??
    inventoryHitAt(screen, point, inventoryOpen, holding, rows)
  );
}

/**
 * A small button that takes a touch from a hit area around it: where it's
 * drawn, what it hits, what its hit area stays `within`, if bounded, and
 * the open `panel` it's part of, if any.
 */
type TouchTarget = { rect: Rect; hit: CursorHit; within?: Rect; panel?: Rect };

/**
 * What a touch at `point` hits of the small buttons' touch hit areas, or
 * null off them. Each stops halfway to every other target drawn, so it
 * never takes a touch on another target's drawn rect: they come first. Nor
 * does it take a touch on an open panel it isn't part of, which is the
 * panel's.
 */
function touchHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  shown: ShownPanels,
): CursorHit | null {
  const { grows, stops, panels } = touchTargets(screen, world, shown);
  const drawn = [...grows.map(({ rect }) => rect), ...stops];
  const target = grows.find(({ rect, within, panel }) => {
    if (panels.some((other) => other !== panel && inside(other, point))) {
      return false;
    }
    const neighbours = drawn.filter((other) => other !== rect);
    return inside(touchHitRect(rect, neighbours, within), point);
  });
  return target?.hit ?? null;
}

/**
 * Every target a touch can hit on the screen as drawn with `shown` open:
 * the small buttons whose hit areas `grows` around them; the drawn rects of
 * the rest, which take a touch only there but `stops` the hit areas beside
 * them halfway: the open panels' buttons, slots and cells, the HUD's and
 * the touch controls; and the open `panels` themselves.
 */
function touchTargets(
  screen: Viewport,
  world: World,
  shown: ShownPanels,
): { grows: TouchTarget[]; stops: Rect[]; panels: Rect[] } {
  const grows: TouchTarget[] = [];
  const stops: Rect[] = [];
  const panels: Rect[] = [];
  const close = (panel: ClosablePanel, rect: Rect, over: Rect) =>
    grows.push({
      rect,
      hit: { button: { type: "close", panel } },
      panel: over,
    });

  if (shown.dialogueOpen) {
    const sheet = dialogueSheet(world, shown.dialogueNpc);
    const dialogue = dialogueLayout(screen, sheet?.buttons.length ?? 0);
    panels.push(dialogue.panel);
    close("dialogue", dialogue.closeButton, dialogue.panel);
    // The buttons are big enough to tap without a hit area of their own.
    stops.push(...dialogue.buttons);
  }
  if (shown.waypointsOpen) {
    const sheet = waypointListSheet(world, {});
    const list = waypointListLayout(screen, sheet.length);
    panels.push(list.panel);
    close("waypoints", list.closeButton, list.panel);
    // The rows are big enough to tap without a hit area of their own.
    stops.push(...list.rows);
  }

  const heroLayout = heroPanelLayout(screen);
  if (shown.heroPanelOpen) {
    panels.push(heroLayout.panel);
    close("hero", heroLayout.closeButton, heroLayout.panel);
    grows.push(...heroButtonTargets(screen, world, shown, heroLayout));
  }
  if (shown.skillTreeOpen) {
    const tree = skillTreePanelLayout(screen);
    panels.push(tree.panel);
    close("skillTree", tree.closeButton, tree.panel);
    stops.push(...Object.values(tree.skills));
    // A Skill's +, while there, grows over its own rows: they're drawn over
    // it. It grows only as far as its panel allows.
    for (const skill of SKILLS) {
      const rect = tree.raise[skill];
      if (!canRaiseSkill(world, skill)) stops.push(rect);
      else {
        grows.push({
          rect,
          hit: { button: { type: "learn", skill } },
          within: tree.panel,
          panel: tree.panel,
        });
      }
    }
  }
  if (shown.inventoryOpen) {
    const inventory = inventoryPanelLayout(screen, beltRows(world));
    panels.push(inventory.panel);
    close("inventory", inventory.closeButton, inventory.panel);
    stops.push(
      ...Object.values(inventory.slots),
      ...inventory.belt.flat(),
      inventory.grid,
    );
  }

  const { buttons, townPortal } = panelButtonsLayout(screen);
  const hudButton = (rect: Rect, hit: CursorHit) => {
    // One an open panel covers is under it.
    if (panels.some((over) => overlaps(over, rect))) stops.push(rect);
    else grows.push({ rect, hit });
  };
  for (const panel of PANELS) {
    hudButton(buttons[panel], { button: { type: "panelButton", panel } });
  }
  hudButton(townPortal, { button: { type: "townPortal" } });
  if (hasUnspentPoints(world)) stops.push(heroLayout.levelUp);
  stops.push(
    ...Object.values(skillBarLayout(screen).slots),
    ...beltStripLayout(screen).columns,
  );
  const controls = touchControlsLayout(screen, shown);
  stops.push(controls.pause);
  if (miniMapShown(shown, world.death !== null)) {
    stops.push(miniMapLayout(screen));
  }
  if (!controls.pauseOnly) {
    stops.push(controls.attack, ...Object.values(controls.skills));
  }
  return { grows, stops, panels };
}

/**
 * The Hero panel's +, − and Accept as touch targets, only while each is
 * shown: each takes a touch along its own row, across the panel, never
 * reaching the rows above or below.
 */
function heroButtonTargets(
  screen: Viewport,
  world: World,
  shown: ShownPanels,
  heroLayout: ReturnType<typeof heroPanelLayout>,
): TouchTarget[] {
  const pending = shown.pendingPoints;
  const { panel } = heroLayout;
  /** Row `row`'s band across the panel. */
  const rowOf = (row: number): Rect => {
    const { y, h } = heroPanelRow(screen, row);
    return { x: panel.x, y, w: panel.w, h };
  };
  const targets: TouchTarget[] = [];
  const raisable = canRaise(world, pending);
  ATTRIBUTES.forEach((attribute, i) => {
    const within = rowOf(PANEL_ROWS.attributes + i);
    if (raisable) {
      const hit = { button: { type: "raise", attribute } } as const;
      targets.push({ rect: heroLayout.raise[attribute], hit, within, panel });
    }
    if (pending[attribute] > 0) {
      const hit = { button: { type: "lower", attribute } } as const;
      targets.push({ rect: heroLayout.lower[attribute], hit, within, panel });
    }
  });
  if (hasPendingPoints(pending)) {
    targets.push({
      rect: heroLayout.accept,
      hit: { button: { type: "accept" } },
      within: rowOf(PANEL_ROWS.attributePoints),
      panel,
    });
  }
  return targets;
}
