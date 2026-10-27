import type { InputWay } from "../input/activeInput";
import { anyPanelOpen, type Menus, type OpenPanels, PANELS } from "../menus";
import type { Rect } from "../sim/rect";
import type { SkillBarSlot } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { heroPanelLayout } from "./heroPanel";
import { orbsLayout } from "./orbs";
import { panelButtonsLayout } from "./panelButtons";
import { SHOWN_ORDER } from "./skillBar";
import { touchHitRect } from "./touchHitArea";

/**
 * The touch controls (CSS px at native scale, drawn at the UI Scale): an
 * attack button `attack` wide over the Mana orb, the Skill buttons `skill`
 * wide in a row over it, a pause button `pause` wide in the top-right
 * corner, everything `gap` apart and from the screen's edges, and a Virtual
 * Stick that
 * reaches full push `stickReach` from where the thumb landed. The Virtual
 * Stick's zone starts `zoneTop` of the way down the screen and runs
 * `zoneWidth` of the way across it.
 */
export const TOUCH_CONTROLS = {
  attack: 72,
  skill: 48,
  pause: 44,
  gap: 8,
  stickReach: 56,
};

/** The Virtual Stick zone's top and width, as parts of the screen. */
const STICK_ZONE = { top: 0.25, width: 0.4 };

/** Where the touch controls go, as `touchControlsLayout` lays them out. */
export type TouchControlsLayout = {
  stickZone: Rect;
  stick: { rest: Vec; reach: number };
  attack: Rect;
  skills: Record<SkillBarSlot, Rect>;
  pause: Rect;
  /**
   * Where a touch presses the pause button: its touch hit area, meeting the
   * Panel buttons' and the other touch buttons' halfway.
   */
  pauseHit: Rect;
  /** Whether only the pause button shows and takes touches: a panel is open. */
  pauseOnly: boolean;
};

/** The menus with every panel shut. */
const NO_PANEL_OPEN: OpenPanels = {
  heroPanelOpen: false,
  inventoryOpen: false,
  skillTreeOpen: false,
};

/**
 * Where the touch controls go: the Virtual Stick zone at the bottom left,
 * over the Life orb and its Level Up button, the Virtual Stick resting low
 * in it over the orb; the attack button over the Mana orb and the five
 * Skill buttons in a row over that, ending at the orb's right; the pause
 * button in the top-right corner, or in the Compact Layout, where the Panel
 * buttons stack down that corner, left of the top one. While a panel is
 * open only the pause button shows, moved clear of the panels and their ×,
 * after the last Panel button: right of it, or in the Compact Layout, below
 * it.
 */
export function touchControlsLayout(
  screen: Viewport,
  open: OpenPanels = NO_PANEL_OPEN,
): TouchControlsLayout {
  const { attack, skill, pause, gap, stickReach } = atUiScale(
    TOUCH_CONTROLS,
    screen.uiScale,
  );
  const { life, mana } = orbsLayout(screen);
  const { levelUp } = heroPanelLayout(screen);
  const top = screen.height * STICK_ZONE.top;
  const bottom = levelUp.y - gap;
  const stickZone = {
    x: 0,
    y: top,
    w: screen.width * STICK_ZONE.width,
    h: bottom - top,
  };
  const right = mana.x + mana.radius + mana.rim;
  const overOrb = mana.y - mana.radius - mana.rim - gap;
  const attackRect = {
    x: right - attack,
    y: overOrb - attack,
    w: attack,
    h: attack,
  };
  const rowY = attackRect.y - gap - skill;
  const rowLeft = right - SHOWN_ORDER.length * (skill + gap) + gap;
  const { buttons } = panelButtonsLayout(screen);
  const cornerRight = screen.compact
    ? buttons[PANELS[0]].x - gap
    : screen.width - gap;
  const pauseOnly = anyPanelOpen(open);
  let pauseRect = { x: cornerRight - pause, y: gap, w: pause, h: pause };
  if (pauseOnly) {
    // After the last Panel button: below its column, or right along its row.
    const last = buttons[PANELS[PANELS.length - 1]];
    pauseRect = screen.compact
      ? { ...pauseRect, x: last.x, y: last.y + last.h + gap }
      : { ...pauseRect, x: last.x + last.w + gap, y: last.y };
  }
  const skillRects = Object.fromEntries(
    SHOWN_ORDER.map((slot, index) => [
      slot,
      { x: rowLeft + index * (skill + gap), y: rowY, w: skill, h: skill },
    ]),
  ) as Record<SkillBarSlot, Rect>;
  // The panels and the rest of the HUD take a touch before the touch
  // controls do, and their hit areas stop halfway to the drawn pause button.
  const neighbours = [
    ...Object.values(buttons),
    ...(pauseOnly ? [] : [attackRect, ...Object.values(skillRects)]),
  ];
  return {
    stickZone,
    stick: { rest: { x: life.x, y: bottom - stickReach }, reach: stickReach },
    attack: attackRect,
    skills: skillRects,
    pause: pauseRect,
    pauseHit: touchHitRect(pauseRect, neighbours),
    pauseOnly,
  };
}

/**
 * Whether the touch controls show, and take touches: while touch is the
 * Active Input and the game runs. With a panel open only the pause button
 * does (`pauseOnly`).
 */
export function touchControlsShown(
  way: InputWay,
  menus: Pick<Menus, "pause" | "rotateNotice">,
): boolean {
  return way === "touch" && !menus.pause.paused && !menus.rotateNotice;
}
