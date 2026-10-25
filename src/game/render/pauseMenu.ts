import type { MenuChoice } from "../menus";
import type { Vec } from "../sim/vec";
import { inside, type Rect } from "./rect";

/**
 * Where the pause menu goes (CSS px): a `width` × `height` panel in the
 * middle of the screen, with its buttons in a row `buttonsTop` down it,
 * `gap` apart.
 */
export const PAUSE_MENU_LAYOUT = {
  width: 460,
  height: 290,
  buttonsTop: 196,
  button: { width: 160, height: 32 },
  gap: 20,
};

/** A pause-menu button: what it picks, its label and where it is. */
export type MenuButton = { choice: MenuChoice; label: string; rect: Rect };

/**
 * Where the pause menu and its buttons are drawn: New Hero, or Yes and No
 * while `confirming` one.
 */
export function pauseMenuLayout(
  screen: { width: number; height: number },
  confirming: boolean,
): { panel: Rect; buttons: MenuButton[] } {
  const { width, height, buttonsTop, button, gap } = PAUSE_MENU_LAYOUT;
  const panel = {
    x: Math.round((screen.width - width) / 2),
    y: Math.round((screen.height - height) / 2),
    w: width,
    h: height,
  };
  const row: { choice: MenuChoice; label: string }[] = confirming
    ? [
        { choice: "confirm", label: "Yes (Y)" },
        { choice: "goBack", label: "No (N)" },
      ]
    : [{ choice: "newHero", label: "New Hero (N)" }];
  const rowWidth = row.length * button.width + (row.length - 1) * gap;
  const left = panel.x + (width - rowWidth) / 2;
  return {
    panel,
    buttons: row.map((entry, i) => ({
      ...entry,
      rect: {
        x: left + i * (button.width + gap),
        y: panel.y + buttonsTop,
        w: button.width,
        h: button.height,
      },
    })),
  };
}

/** The pause-menu button under `point`, or null off them all. */
export function menuChoiceAt(
  screen: { width: number; height: number },
  point: Vec,
  confirming: boolean,
): MenuChoice | null {
  const { buttons } = pauseMenuLayout(screen, confirming);
  return buttons.find((button) => inside(button.rect, point))?.choice ?? null;
}
