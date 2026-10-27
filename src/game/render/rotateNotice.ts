import type { Fullscreen } from "../fullscreen";
import type { InputWay } from "../input/activeInput";
import type { FullscreenChoice } from "../menus";
import { inside } from "../sim/rect";
import type { Vec } from "../sim/vec";
import { viewportTuning } from "../tuning/viewport";
import { atUiScale, type RotateNotice, type Viewport } from "../viewport";
import { fullscreenLabel } from "./hints";
import { MENU_BUTTON, type MenuButton } from "./pauseMenu";

/**
 * What the Rotate Notice says with the Active Input `way`, drawn over
 * everything instead of the game: to turn a screen held upright sideways,
 * or, of one too small, that it is too small on a touch screen, which has
 * no window to enlarge, or else to enlarge the window.
 */
export function rotateNoticeText(
  notice: RotateNotice,
  way: InputWay,
): {
  title: string;
  body: string;
} {
  if (notice === "turn") {
    return {
      title: "Turn your device",
      body: "Hold it sideways to play. The game waits, paused.",
    };
  }
  if (way === "touch") {
    return {
      title: "Screen too small",
      body: "This screen is too small to play on. The game waits, paused.",
    };
  }
  const { minPlayWidth, minPlayHeight } = viewportTuning;
  return {
    title: "Enlarge the window",
    body: `The game needs at least ${minPlayWidth}×${minPlayHeight} to play. It waits, paused.`,
  };
}

/**
 * The Rotate Notice's sizes (CSS px at native scale, drawn at the UI
 * Scale): its title's font size, its text's line height and the room kept
 * for its lines, the `gap` between title, text and Fullscreen button, and
 * the `margin` either side.
 */
export const ROTATE_NOTICE_LAYOUT = {
  titleSize: 30,
  bodySize: 17,
  lineHeight: 24,
  bodyLines: 2,
  gap: 16,
  margin: 16,
};

/**
 * Where the Rotate Notice puts its title (bottom edge), its text (top, and
 * the bottom of the room kept for it) and its Fullscreen button, if any,
 * all centred across the screen and, together, down it. The Fullscreen
 * button shows only for touch, as the Active Input `way`, on a screen too
 * small to play on, where `fullscreen` says the browser allows it.
 */
export function rotateNoticeLayout(
  screen: Viewport,
  way: InputWay,
  fullscreen: Fullscreen,
): {
  title: { bottom: number };
  body: { top: number; bottom: number };
  button: MenuButton | null;
} {
  const { titleSize, lineHeight, bodyLines, gap } = atUiScale(
    ROTATE_NOTICE_LAYOUT,
    screen.uiScale,
  );
  const size = atUiScale(MENU_BUTTON, screen.uiScale);
  const shown =
    screen.rotateNotice === "tooSmall" &&
    way === "touch" &&
    fullscreen.available;
  const middle = Math.round(screen.height / 2);
  if (!shown) {
    const top = middle + gap / 2;
    return {
      title: { bottom: middle - gap / 2 },
      body: { top, bottom: top + bodyLines * lineHeight },
      button: null,
    };
  }
  const bodyHeight = bodyLines * lineHeight;
  const height = titleSize + gap + bodyHeight + gap + size.height;
  const titleBottom = Math.max(0, middle - height / 2) + titleSize;
  const bodyTop = titleBottom + gap;
  const bodyBottom = bodyTop + bodyHeight;
  return {
    title: { bottom: titleBottom },
    body: { top: bodyTop, bottom: bodyBottom },
    button: {
      choice: "fullscreen",
      label: fullscreenLabel(fullscreen.on),
      rect: {
        x: Math.round((screen.width - size.width) / 2),
        y: bodyBottom + gap,
        w: size.width,
        h: size.height,
      },
    },
  };
}

/**
 * The Rotate Notice's button under `point`: the Fullscreen button, where
 * `rotateNoticeLayout` shows it, or null.
 */
export function rotateNoticeChoiceAt(
  screen: Viewport,
  point: Vec,
  way: InputWay,
  fullscreen: Fullscreen,
): FullscreenChoice | null {
  const { button } = rotateNoticeLayout(screen, way, fullscreen);
  return button && inside(button.rect, point) ? "fullscreen" : null;
}
