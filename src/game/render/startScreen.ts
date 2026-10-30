import type { Fullscreen } from "../fullscreen";
import type { InputWay } from "../input/activeInput";
import { type MenuChoice, type StartScreen, startChoices } from "../menus";
import { inside } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { atUiScale, type Viewport } from "../viewport";
import { menuChoiceLabel } from "./hints";
import { buttonRow, type MenuButton } from "./pauseMenu";
import { touchHitRect } from "./touchHitArea";

/**
 * Where the Start Screen goes (CSS px at native scale, drawn at the UI
 * Scale): the game's name `titleSize` tall, centred `titleTop` of the way
 * down the screen, and the buttons in a row `buttonsTop` of the way down,
 * `gap` apart. Their size is the pause menu's.
 */
export const START_SCREEN_LAYOUT = {
  titleSize: 56,
  gap: 20,
};

/** How far down the screen the name and the row of buttons go (0..1). */
const START_SCREEN_DOWN = { title: 0.3, buttons: 0.58 };

/** The game's name, as the Start Screen shows it. */
export const GAME_NAME = "Lord of Wockstruction";

/**
 * Where the Start Screen's name is centred and how tall it is, and its
 * buttons in a row below: Continue (with a Save), New Hero and the
 * Fullscreen button where `fullscreen` says the browser allows it, or Yes
 * and No while confirming.
 */
export function startScreenLayout(
  screen: Viewport,
  start: StartScreen,
  way: InputWay,
  fullscreen: Fullscreen,
): { title: { at: Vec; size: number }; buttons: MenuButton[] } {
  const { titleSize, gap } = atUiScale(START_SCREEN_LAYOUT, screen.uiScale);
  const row = startChoices(start, fullscreen).map((choice) => ({
    choice,
    label: menuChoiceLabel(choice, way, fullscreen.on),
  }));
  return {
    title: {
      at: {
        x: Math.round(screen.width / 2),
        y: Math.round(screen.height * START_SCREEN_DOWN.title),
      },
      size: titleSize,
    },
    buttons: buttonRow(row, {
      centre: screen.width / 2,
      top: Math.round(screen.height * START_SCREEN_DOWN.buttons),
      gap,
      uiScale: screen.uiScale,
    }),
  };
}

/**
 * The Start Screen's button under `point`, as laid out with the Active
 * Input `way`, or null off them all. A touch hits a button's Touch hit area,
 * grown by the Halfway rule; a click only the button as drawn.
 */
export function startChoiceAt(
  screen: Viewport,
  point: Vec,
  start: StartScreen,
  way: InputWay,
  fullscreen: Fullscreen,
): MenuChoice | null {
  const { buttons } = startScreenLayout(screen, start, way, fullscreen);
  const hit = (button: MenuButton) =>
    way === "touch"
      ? touchHitRect(
          button.rect,
          buttons.filter((other) => other !== button).map((o) => o.rect),
        )
      : button.rect;
  return buttons.find((button) => inside(hit(button), point))?.choice ?? null;
}
