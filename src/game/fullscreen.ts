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
 * The pointer event whose handler may ask for fullscreen, by
 * `PointerEvent.pointerType`: browsers let the page go fullscreen only from
 * the player's own action, and count a mouse's press as one but, for a
 * finger or pen, only the lift.
 */
export function fullscreenPointerEvent(
  pointerType: string,
): "pointerdown" | "pointerup" {
  return pointerType === "mouse" ? "pointerdown" : "pointerup";
}

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

/** Puts the whole page fullscreen, then locks it sideways where allowed. */
async function enter() {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    return;
  }
  await lockSideways();
}

/** Releases the sideways lock and leaves fullscreen. */
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

/** Locks the screen sideways, where the browser allows it. */
async function lockSideways() {
  try {
    await orientation()?.lock?.("landscape");
  } catch {
    // Desktops and some phones refuse; fullscreen stays all the same.
  }
}

/** Lets the screen turn freely again, as before fullscreen. */
function unlockOrientation() {
  try {
    orientation()?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}
