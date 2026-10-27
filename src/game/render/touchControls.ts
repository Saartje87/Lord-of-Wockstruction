import type { InputWay } from "../input/activeInput";
import { type Menus, PANELS, panelOpen } from "../menus";
import type { Rect } from "../sim/rect";
import type { SkillBarSlot } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { heroPanelLayout } from "./heroPanel";
import { orbsLayout } from "./orbs";
import { panelButtonsLayout } from "./panelButtons";

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

/** The Virtual Stick zone's top and right, as parts of the screen. */
const STICK_ZONE = { top: 0.25, width: 0.4 };

/** The Skill buttons from left to right, as on the Skill Bar. */
const SHOWN_ORDER: readonly SkillBarSlot[] = [
  "key1",
  "key2",
  "key3",
  "key4",
  "right",
];

/** Where the touch controls go, as `touchControlsLayout` lays them out. */
export type TouchControlsLayout = {
  stickZone: Rect;
  stick: { rest: Vec; reach: number };
  attack: Rect;
  skills: Record<SkillBarSlot, Rect>;
  pause: Rect;
};

/**
 * Where the touch controls go: the Virtual Stick zone at the bottom left,
 * over the Life orb and its Level Up button, the Virtual Stick resting low
 * in it over the orb; the attack button over the Mana orb and the five
 * Skill buttons in a row over that, ending at the orb's right; the pause
 * button in the top-right corner, or in the Compact Layout, where the Panel
 * buttons stack down that corner, left of the top one.
 */
export function touchControlsLayout(screen: Viewport): TouchControlsLayout {
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
  const cornerRight = screen.compact
    ? panelButtonsLayout(screen).buttons[PANELS[0]].x - gap
    : screen.width - gap;
  return {
    stickZone,
    stick: { rest: { x: life.x, y: bottom - stickReach }, reach: stickReach },
    attack: attackRect,
    skills: Object.fromEntries(
      SHOWN_ORDER.map((slot, index) => [
        slot,
        { x: rowLeft + index * (skill + gap), y: rowY, w: skill, h: skill },
      ]),
    ) as Record<SkillBarSlot, Rect>,
    pause: { x: cornerRight - pause, y: gap, w: pause, h: pause },
  };
}

/**
 * Whether the touch controls show, and take touches: while touch is the
 * Active Input, the game runs and no panel is open.
 */
export function touchControlsShown(
  way: InputWay,
  menus: Pick<
    Menus,
    | "pause"
    | "rotateNotice"
    | "heroPanelOpen"
    | "inventoryOpen"
    | "skillTreeOpen"
  >,
): boolean {
  return (
    way === "touch" &&
    !menus.pause.paused &&
    !menus.rotateNotice &&
    !PANELS.some((panel) => panelOpen(menus, panel))
  );
}
