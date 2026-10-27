import type { CursorHit } from "../cursor";
import { type Menus, type OpenPanels, PANELS, type Panel } from "../menus";
import { beltRows } from "../sim/belt";
import { cursorItemOf } from "../sim/inventory";
import { inside, overlaps, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import type { Viewport } from "../viewport";
import { beltStripHitAt, beltStripLayout } from "./beltStrip";
import {
  hasUnspentPoints,
  heroPanelHitAt,
  heroPanelLayout,
  levelUpHitAt,
} from "./heroPanel";
import { inventoryHitAt, inventoryPanelLayout } from "./inventoryPanel";
import { panelButtonHitAt, panelButtonsLayout } from "./panelButtons";
import { skillBarHitAt, skillBarLayout } from "./skillBar";
import { skillTreeHitAt, skillTreePanelLayout } from "./skillTreePanel";
import { touchControlsLayout } from "./touchControls";
import { touchHitRect } from "./touchHitArea";

/** The panels as drawn: which are open, and the Hero panel's Pending Attribute Points. */
export type ShownPanels = OpenPanels & Pick<Menus, "pendingPoints">;

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
  return (
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
    panelButtonHitAt(screen, point) ??
    inventoryHitAt(screen, point, inventoryOpen, holding, rows)
  );
}

/** A small button that takes a touch from a hit area around it: where it's drawn, and what it hits. */
type TouchTarget = { rect: Rect; hit: CursorHit };

/**
 * What a touch at `point` hits of the small buttons' touch hit areas, or
 * null off them. Each stops halfway to every other target drawn, so it
 * never takes a touch on another target's drawn rect: they come first.
 */
function touchHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  shown: ShownPanels,
): CursorHit | null {
  const { growing, still } = touchTargets(screen, world, shown);
  const drawn = [...growing.map(({ rect }) => rect), ...still];
  const target = growing.find(({ rect }) => {
    const neighbours = drawn.filter((other) => other !== rect);
    return inside(touchHitRect(rect, neighbours), point);
  });
  return target?.hit ?? null;
}

/**
 * Every target a touch can hit on the screen as drawn with `shown` open:
 * `growing`, the small buttons that take a touch from a hit area around
 * them, and `still`, the drawn rects of the rest, which take a touch only
 * there but stop the hit areas beside them halfway: the open panels'
 * buttons, slots and cells, the HUD's and the touch controls.
 */
function touchTargets(
  screen: Viewport,
  world: World,
  shown: ShownPanels,
): { growing: TouchTarget[]; still: Rect[] } {
  const growing: TouchTarget[] = [];
  const still: Rect[] = [];
  const panels: Rect[] = [];
  const close = (panel: Panel, rect: Rect) =>
    growing.push({ rect, hit: { button: { type: "close", panel } } });

  const hero = heroPanelLayout(screen);
  if (shown.heroPanelOpen) {
    panels.push(hero.panel);
    close("hero", hero.closeButton);
    still.push(
      ...Object.values(hero.raise),
      ...Object.values(hero.lower),
      hero.accept,
    );
  }
  if (shown.skillTreeOpen) {
    const tree = skillTreePanelLayout(screen);
    panels.push(tree.panel);
    close("skillTree", tree.closeButton);
    still.push(...Object.values(tree.skills), ...Object.values(tree.raise));
  }
  if (shown.inventoryOpen) {
    const inventory = inventoryPanelLayout(screen, beltRows(world));
    panels.push(inventory.panel);
    close("inventory", inventory.closeButton);
    still.push(
      ...Object.values(inventory.slots),
      ...inventory.belt.flat(),
      inventory.grid,
    );
  }

  const { buttons } = panelButtonsLayout(screen);
  for (const panel of PANELS) {
    const rect = buttons[panel];
    const hit = { button: { type: "panelButton", panel } } as const;
    // One an open panel covers is under it.
    if (panels.some((over) => overlaps(over, rect))) still.push(rect);
    else growing.push({ rect, hit });
  }
  if (hasUnspentPoints(world)) still.push(hero.levelUp);
  still.push(
    ...Object.values(skillBarLayout(screen).slots),
    ...beltStripLayout(screen).columns,
  );
  const controls = touchControlsLayout(screen, shown);
  still.push(controls.pause);
  if (!controls.pauseOnly) {
    still.push(controls.attack, ...Object.values(controls.skills));
  }
  return { growing, still };
}
