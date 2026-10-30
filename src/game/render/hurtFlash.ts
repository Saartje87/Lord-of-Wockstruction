/** How long a hurt flash lasts (ms): the Hero's red screen and a Minion's bar. */
export const HURT_FLASH_MS = 150;

/** How much of a hurt flash is left (1..0) `sinceMs` after the hit. */
export function hurtFlashLeft(sinceMs: number): number {
  return Math.min(1, Math.max(0, 1 - sinceMs / HURT_FLASH_MS));
}
