import type { Screen } from "./menus";

/**
 * Draws `screen` on the Loading Screen the page itself made (see
 * `src/app/page.tsx`): the bar filled by what has loaded, the failure
 * message and the Retry button once loading failed, and the whole screen
 * hidden once play shows. Untested glue, like `attachPointer`.
 */
export function drawLoadingScreen(screen: Screen) {
  const root = document.getElementById("loading-screen");
  if (!root) return;
  root.hidden = screen.type !== "loading";
  if (screen.type !== "loading") return;
  const share = screen.total > 0 ? screen.loaded / screen.total : 0;
  const fill = document.getElementById("loading-fill");
  if (fill) fill.style.transform = `scaleX(${share})`;
  document
    .getElementById("loading-bar")
    ?.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  const message = document.getElementById("loading-message");
  if (message) message.hidden = !screen.failed;
  const retry = document.getElementById("loading-retry");
  if (retry) retry.hidden = !screen.failed;
}

/** Calls `onRetry` as the Retry button is clicked, until `signal` aborts. */
export function onRetryClick(onRetry: () => void, signal: AbortSignal) {
  document
    .getElementById("loading-retry")
    ?.addEventListener("click", onRetry, { signal });
}
