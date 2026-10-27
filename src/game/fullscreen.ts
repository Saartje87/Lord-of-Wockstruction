/**
 * What the browser says of fullscreen: whether it allows the page to go
 * fullscreen at all (iPhone Safari doesn't), and whether the game is
 * fullscreen now. The menus are given it; they never ask the browser.
 */
export type Fullscreen = { available: boolean; on: boolean };

/** Fullscreen where the browser doesn't allow it. */
export const NO_FULLSCREEN: Fullscreen = { available: false, on: false };

/** The browser's fullscreen, as the game loop uses it. */
export type FullscreenAdapter = {
  /** Whether fullscreen is allowed and on, as the browser has it now. */
  read(): Fullscreen;
  /**
   * Carries out the Fullscreen button's request: leaves fullscreen while
   * on, else enters it. Only ever called from the player's own action.
   */
  toggle(): void;
};

/**
 * The page's fullscreen through the browser: entering puts the whole page
 * fullscreen and locks the screen sideways where the browser allows that;
 * leaving, by the Fullscreen button or the browser's own way (Esc, the back
 * gesture), releases the lock. A refused fullscreen or lock is ignored, so
 * the game carries on as it was. Listens until `signal` aborts.
 */
export function browserFullscreen(signal: AbortSignal): FullscreenAdapter {
  document.addEventListener(
    "fullscreenchange",
    () => {
      if (document.fullscreenElement === null) unlockOrientation();
    },
    { signal },
  );
  const read = (): Fullscreen => ({
    available: document.fullscreenEnabled === true,
    on: (document.fullscreenElement ?? null) !== null,
  });
  return {
    read,
    toggle() {
      const { available, on } = read();
      if (on) void leave();
      else if (available) void enter();
    },
  };
}

async function enter() {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    return;
  }
  await lockSideways();
}

async function leave() {
  unlockOrientation();
  try {
    await document.exitFullscreen();
  } catch {
    // Already left, the browser's way.
  }
}

/**
 * The part of the Screen Orientation API the game uses: `lock` isn't in
 * every browser, nor in TypeScript's DOM types.
 */
type LockableOrientation = {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

/** The screen's orientation, if the browser has one to lock. */
function orientation(): LockableOrientation | undefined {
  return screen.orientation as LockableOrientation | undefined;
}

async function lockSideways() {
  try {
    await orientation()?.lock?.("landscape");
  } catch {
    // Desktops and some phones refuse; fullscreen stays all the same.
  }
}

function unlockOrientation() {
  try {
    orientation()?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}
