import { inside, middleOf, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";

/**
 * The Dialogue panel in the middle of the screen (CSS px at native scale,
 * drawn at the UI Scale): `width` wide, the NPC's name `firstLine` down, the
 * `bodyHeight` of what they say under it, then a row `rowHeight` tall for
 * each button, and `hintHeight` for the hint, all inside `padding`.
 */
export const DIALOGUE = {
  width: 340,
  padding: 18,
  firstLine: 56,
  bodyHeight: 120,
  rowHeight: 44,
  hintHeight: 28,
};

/** What each NPC says, by their name in the map: a line of their own. */
export const NPC_LINES: Readonly<Record<string, string>> = {
  Smith:
    "Steel doesn't forgive, Hero. Keep your blade clean and your back to a wall.",
  Elder:
    "The Wock has stirred beneath the old stones. We have waited a long time for someone brave enough to listen.",
  Trader:
    "Coin buys many things out here, friend, but never a quiet night. Come back when your pockets are heavy.",
  Wanderer:
    "I have walked every road in this land, and not one of them led anywhere kind.",
};

/** The button on the open Dialogue panel (besides ×): end the talk. */
export type DialogueButton = { type: "goodbye" };

/** What the Dialogue panel shows of the NPC the Hero talks to. */
export type DialogueSheet = {
  name: string;
  /** What they say, a paragraph each. */
  lines: string[];
  /** The buttons under it, top to bottom. */
  buttons: { label: string; button: DialogueButton }[];
};

/**
 * What the Dialogue panel shows for NPC `npc` of the active Area, or null
 * for an NPC the Area doesn't have. Quests add their lines and buttons here,
 * ahead of Goodbye.
 */
export function dialogueSheet(world: World, npc: number): DialogueSheet | null {
  const there = world.areas[world.areaName].npcs[npc];
  if (!there) return null;
  return {
    name: there.name,
    lines: [NPC_LINES[there.name] ?? "..."],
    buttons: [{ label: "Goodbye", button: { type: "goodbye" } }],
  };
}

/**
 * Where the panel is drawn for `buttons` buttons: centred on the screen, as
 * tall as its parts, or in the Compact Layout filling the screen.
 */
export function dialoguePanelRect(screen: Viewport, buttons: number): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const { width, padding, firstLine, bodyHeight, rowHeight, hintHeight } =
    atUiScale(DIALOGUE, screen.uiScale);
  const h =
    firstLine + bodyHeight + buttons * rowHeight + hintHeight + padding;
  return {
    x: (screen.width - width) / 2,
    y: (screen.height - h) / 2,
    w: width,
    h,
  };
}

/**
 * Where the panel, its × close button, the NPC's words and each button
 * (CSS px) go, at the UI Scale: inside the panel's padding, and in the
 * Compact Layout, where the panel fills the screen, as wide as on a desktop
 * and centred.
 */
export function dialogueLayout(
  screen: Viewport,
  buttons: number,
): { panel: Rect; closeButton: Rect; body: Rect; buttons: Rect[] } {
  const { width, padding, firstLine, bodyHeight, rowHeight } = atUiScale(
    DIALOGUE,
    screen.uiScale,
  );
  const panel = dialoguePanelRect(screen, buttons);
  const w = width - 2 * padding;
  const x = panel.x + (panel.w - w) / 2;
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    body: { x, y: panel.y + firstLine, w, h: bodyHeight },
    buttons: Array.from({ length: buttons }, (_, index) => ({
      x,
      y: panel.y + firstLine + bodyHeight + index * rowHeight,
      w,
      h: rowHeight,
    })),
  };
}

/**
 * A click on the open Dialogue panel, so not for the World: one of its
 * buttons or the ×; null elsewhere on the panel, which does nothing.
 */
export type DialogueHit = { button: DialogueButton | CloseButton | null };

/**
 * What a click at `point` hits of the Dialogue panel, or null when it's off
 * the panel or the panel isn't `open`, so it's for the World.
 */
export function dialogueHitAt(
  screen: Viewport,
  point: Vec,
  sheet: DialogueSheet | null,
  open: boolean,
): DialogueHit | null {
  const buttons = sheet?.buttons ?? [];
  const layout = dialogueLayout(screen, buttons.length);
  if (!open || !inside(layout.panel, point)) return null;
  const closeHit = closeHitAt(layout, point, "dialogue");
  if (closeHit) return closeHit;
  const row = layout.buttons.findIndex((rect) => inside(rect, point));
  return { button: buttons[row]?.button ?? null };
}

/** A spot the Focus can rest on with the Dialogue panel open. */
export type DialogueFocusSpot = { rect: Rect; at: Vec; hit: DialogueHit };

/**
 * The Dialogue panel's Focus spots: each button, clicked in the middle, then
 * the ×.
 */
export function dialogueFocusSpots(
  world: World,
  screen: Viewport,
  npc: number,
): DialogueFocusSpot[] {
  const sheet = dialogueSheet(world, npc);
  const layout = dialogueLayout(screen, sheet?.buttons.length ?? 0);
  const spots = layout.buttons.map((rect) => ({
    rect,
    at: middleOf(rect),
    hit: dialogueHitAt(screen, middleOf(rect), sheet, true) ?? {
      button: null,
    },
  }));
  const { closeButton } = layout;
  const hit: DialogueHit = { button: { type: "close", panel: "dialogue" } };
  return [...spots, { rect: closeButton, at: middleOf(closeButton), hit }];
}
