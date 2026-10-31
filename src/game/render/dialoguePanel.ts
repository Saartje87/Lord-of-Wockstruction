import type { ItemId } from "../sim/inventory";
import { type QuestId, questsOf } from "../sim/quests";
import { inside, middleOf, type Rect } from "../sim/rect";
import { SMITH, smithableItems } from "../sim/smith";
import type { Vec } from "../sim/vec";
import { questOf, type World } from "../sim/world";
import { itemOf } from "../tuning/items";
import { questTuning } from "../tuning/quests";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";

/**
 * The Dialogue panel in the middle of the screen (CSS px at native scale,
 * drawn at the UI Scale): `width` wide, the NPC's name `firstLine` down, the
 * `bodyHeight` of what they say under it, then a row `rowHeight` tall for
 * each button, and `hintHeight` for the hint, all inside `padding`. In the
 * Compact Layout the words keep at least `compactMinBody`, room for a few
 * lines, however many buttons share the panel.
 */
export const DIALOGUE = {
  width: 340,
  padding: 18,
  firstLine: 56,
  bodyHeight: 120,
  rowHeight: 44,
  hintHeight: 28,
  compactMinBody: 56,
};

/** What an NPC without a Quest says, by their name in the map: a line of their own. */
export const NPC_LINES: Readonly<Record<string, string>> = {
  Wanderer:
    "I have walked every road in this land, and not one of them led anywhere kind, until you came.",
};

/**
 * The button on the open Dialogue panel (besides ×): end the talk, or take
 * on or hand in a Quest.
 */
export type DialogueButton =
  | { type: "goodbye" }
  | { type: "acceptQuest"; quest: QuestId }
  | { type: "handInQuest"; quest: QuestId }
  | { type: "smithService" }
  | { type: "smithForge"; item: ItemId }
  | { type: "smithMore" }
  | { type: "trade" };

/** How many Items the Smith's list shows at a time. */
export const SMITH_PAGE_SIZE = 2;

/** What the Dialogue panel shows of the NPC the Hero talks to. */
export type DialogueSheet = {
  name: string;
  /** What they say, a paragraph each. */
  lines: string[];
  /** The buttons under it, top to bottom. */
  buttons: { label: string; button: DialogueButton }[];
};

/**
 * The Quest an NPC's talk is about: one of theirs to hand in first, else
 * one to give, else one Given, else their last, which is Done; null for an
 * NPC with no Quest.
 */
function questTalkedAbout(world: World, name: string): QuestId | null {
  const mine = questsOf(name);
  const { quests } = world.hero.progress;
  for (const state of ["ready", "notGiven", "given"] as const) {
    const found = mine.find((id) => quests[id].state === state);
    if (found) return found;
  }
  return mine.at(-1) ?? null;
}

/**
 * What the Dialogue panel shows for NPC `npc` of the active Area, or null
 * for an NPC the Area doesn't have. An NPC with Quests speaks of one at a
 * time, as it stands, and offers to give or take it back ahead of Goodbye.
 */
export function dialogueSheet(
  world: World,
  npc: number,
  page = 0,
): DialogueSheet | null {
  const there = world.areas[world.areaName].npcs[npc];
  if (!there) return null;
  const goodbye = { label: "Goodbye", button: { type: "goodbye" } } as const;
  const trade: DialogueSheet["buttons"] = there.vendor
    ? [{ label: "Trade", button: { type: "trade" } }]
    : [];
  const service =
    there.name === SMITH && world.hero.progress.smithService === "unlocked";
  if (service && page >= 1) return smithList(world, there.name, page, goodbye);
  const quest = questTalkedAbout(world, there.name);
  if (quest === null) {
    return {
      name: there.name,
      lines: [NPC_LINES[there.name] ?? "..."],
      buttons: [...trade, goodbye],
    };
  }
  const { name, lines } = questTuning[quest];
  const { state } = questOf(world, quest);
  const offer =
    state === "notGiven"
      ? { label: `Accept "${name}"`, button: { type: "acceptQuest", quest } }
      : state === "ready"
        ? { label: `Hand in "${name}"`, button: { type: "handInQuest", quest } }
        : null;
  const smithService: DialogueSheet["buttons"] = service
    ? [{ label: "Smith's service", button: { type: "smithService" } }]
    : [];
  return {
    name: there.name,
    lines: [lines[state]],
    buttons: offer
      ? [offer as DialogueSheet["buttons"][number], ...trade, goodbye]
      : [...smithService, ...trade, goodbye],
  };
}

/**
 * The Smith's list of what he can work on, `page` of it counted from 1 and
 * wrapping round: each Weapon or Armour without a bonus yet, Equipped ones
 * first, with More gear to turn the page when there are several.
 */
function smithList(
  world: World,
  name: string,
  page: number,
  goodbye: DialogueSheet["buttons"][number],
): DialogueSheet {
  const items = smithableItems(world);
  if (items.length === 0) {
    return {
      name,
      lines: ["You have no Weapon or Armour I can work on."],
      buttons: [goodbye],
    };
  }
  const pages = Math.ceil(items.length / SMITH_PAGE_SIZE);
  const from = ((page - 1) % pages) * SMITH_PAGE_SIZE;
  const buttons: DialogueSheet["buttons"] = items
    .slice(from, from + SMITH_PAGE_SIZE)
    .map(({ item, equipped }) => ({
      label: `${itemOf(item.type).name}${equipped ? " (Equipped)" : ""}`,
      button: { type: "smithForge", item: item.id },
    }));
  if (pages > 1) {
    buttons.push({ label: "More gear", button: { type: "smithMore" } });
  }
  return {
    name,
    lines: ["Which piece of gear shall I work on? I can do it only once."],
    buttons: [...buttons, goodbye],
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
  const h = firstLine + bodyHeight + buttons * rowHeight + hintHeight + padding;
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
 * and centred. There the words and the buttons share the room above the
 * hint: the words keep up to `bodyHeight`, but no less than
 * `DIALOGUE.compactMinBody`, and the buttons give up height for it only
 * when that is not enough.
 */
export function dialogueLayout(
  screen: Viewport,
  buttons: number,
): { panel: Rect; closeButton: Rect; body: Rect; buttons: Rect[] } {
  const {
    width,
    padding,
    firstLine,
    rowHeight,
    hintHeight,
    bodyHeight: wanted,
    compactMinBody,
  } = atUiScale(DIALOGUE, screen.uiScale);
  const panel = dialoguePanelRect(screen, buttons);
  // On a desktop the panel is as tall as its parts; in the Compact Layout
  // the words and the buttons share what the fixed panel has left.
  const room = panel.h - firstLine - hintHeight - padding;
  const bodyHeight = screen.compact
    ? Math.min(wanted, Math.max(compactMinBody, room - buttons * rowHeight))
    : wanted;
  const buttonHeight = screen.compact
    ? Math.min(rowHeight, (room - bodyHeight) / buttons)
    : rowHeight;
  const w = width - 2 * padding;
  const x = panel.x + (panel.w - w) / 2;
  return {
    panel,
    closeButton: closeButtonRect(panel, screen.uiScale),
    body: { x, y: panel.y + firstLine, w, h: bodyHeight },
    buttons: Array.from({ length: buttons }, (_, index) => ({
      x,
      y: panel.y + firstLine + bodyHeight + index * buttonHeight,
      w,
      h: buttonHeight,
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
  page = 0,
): DialogueFocusSpot[] {
  const sheet = dialogueSheet(world, npc, page);
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
