import {
  partsOf,
  QUEST_IDS,
  type QuestId,
  type QuestState,
} from "../sim/quests";
import { inside, middleOf, type Rect } from "../sim/rect";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { questTuning } from "../tuning/quests";
import { atUiScale, type Viewport } from "../viewport";
import { type CloseButton, closeButtonRect, closeHitAt } from "./closeButton";
import { compactPanelRect } from "./compactLayout";

/**
 * The Quest panel at the top right, where the Inventory and Skill Tree
 * panels go (CSS px at native scale, drawn at the UI Scale): `right` and
 * `top` from the screen's corner, `width` wide, its Quest rows `rowHeight`
 * apart from `firstRow` down inside `padding`, and `hintHeight` under them
 * for its hint. A row holds the Quest's name and state on its first line and
 * what to do next under it.
 */
export const QUEST_PANEL = {
  right: 16,
  top: 16,
  width: 320,
  padding: 18,
  firstRow: 56,
  rowHeight: 66,
  hintHeight: 28,
};

/** What the Quest panel says of each state of a Quest. */
export const QUEST_STATE_NAMES: Readonly<Record<QuestState, string>> = {
  notGiven: "Not given",
  given: "Given",
  ready: "Ready to hand in",
  done: "Done",
};

/** What the Quest panel shows of one Quest, as text. */
export type QuestSheet = {
  quest: QuestId;
  name: string;
  state: QuestState;
  /** The state as the panel words it. */
  stateName: string;
  /** What to do next, for a Quest that is Given; otherwise null. */
  nextStep: string | null;
};

/**
 * What the Quest panel shows: the Quests of the active Area's Act, in their
 * order, each with its state and, once Given, what to do next with how many
 * of its parts are done, if it has several.
 */
export function questPanelSheet(world: World): QuestSheet[] {
  const { act } = world.areas[world.areaName];
  const { quests } = world.hero.progress;
  return QUEST_IDS.filter((id) => questTuning[id].act === (act ?? 1)).map(
    (id) => {
      const { name, nextStep, trigger } = questTuning[id];
      const { state, count } = quests[id];
      const parts = partsOf(trigger);
      return {
        quest: id,
        name,
        state,
        stateName: QUEST_STATE_NAMES[state],
        nextStep:
          state === "given"
            ? parts > 1
              ? `${nextStep} (${count}/${parts})`
              : nextStep
            : null,
      };
    },
  );
}

/**
 * Where the panel is drawn for `rows` Quests: at the top right, as tall as
 * its rows, or in the Compact Layout filling the screen.
 */
export function questPanelRect(screen: Viewport, rows: number): Rect {
  if (screen.compact) return compactPanelRect(screen);
  const { right, top, width, padding, firstRow, rowHeight, hintHeight } =
    atUiScale(QUEST_PANEL, screen.uiScale);
  return {
    x: screen.width - right - width,
    y: top,
    w: width,
    h: firstRow + rows * rowHeight + hintHeight + padding,
  };
}

/**
 * Where the panel, its × close button and each Quest's row (CSS px) go, at
 * the UI Scale. The rows run down the panel from under its title, inside its
 * padding; in the Compact Layout, where the panel fills the screen, as wide
 * as on a desktop and centred.
 */
export function questPanelLayout(
  screen: Viewport,
  rows: number,
): { panel: Rect; closeButton: Rect; rows: Rect[] } {
  const { width, padding, firstRow, rowHeight } = atUiScale(
    QUEST_PANEL,
    screen.uiScale,
  );
  const panel = questPanelRect(screen, rows);
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

/**
 * A click on the open Quest panel, so not for the World: its ×; null
 * elsewhere on the panel, which does nothing.
 */
export type QuestPanelHit = { button: CloseButton | null };

/**
 * What a click at `point` hits of the Quest panel, or null when it's off
 * the panel or the panel isn't `open`, so it's for the World.
 */
export function questPanelHitAt(
  screen: Viewport,
  point: Vec,
  world: World,
  open: boolean,
): QuestPanelHit | null {
  const layout = questPanelLayout(screen, questPanelSheet(world).length);
  if (!open || !inside(layout.panel, point)) return null;
  return closeHitAt(layout, point, "quest") ?? { button: null };
}

/** A spot the Focus can rest on with the Quest panel open. */
export type QuestFocusSpot = { rect: Rect; at: Vec; hit: QuestPanelHit };

/** The Quest panel's Focus spots: just the ×, clicked in the middle. */
export function questFocusSpots(
  world: World,
  screen: Viewport,
): QuestFocusSpot[] {
  const { closeButton } = questPanelLayout(
    screen,
    questPanelSheet(world).length,
  );
  const hit: QuestPanelHit = { button: { type: "close", panel: "quest" } };
  return [{ rect: closeButton, at: middleOf(closeButton), hit }];
}
