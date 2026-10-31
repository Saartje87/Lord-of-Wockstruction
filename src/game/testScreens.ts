import type { Screen } from "./viewport";

/**
 * The desktop screen sizes every layout test covers (CSS px): from a full
 * laptop screen down to the smallest the game plays on without the Compact
 * Layout.
 */
export const DESKTOP_SCREENS: readonly Screen[] = [
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 1024, height: 640 },
  { width: 800, height: 600 },
];

/**
 * The phones held sideways every layout test covers (CSS px), which take
 * the Compact Layout.
 */
export const PHONES: readonly Screen[] = [
  { width: 640, height: 320 },
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 915, height: 330 },
];
