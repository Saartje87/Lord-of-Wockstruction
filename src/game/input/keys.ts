import { beltColumnKey } from "../sim/belt";
import { KEYED_SLOTS, slotKey } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import type { Order } from "../sim/world";
import { beltTuning } from "../tuning/items";

/**
 * The order a key press gives: keys Q, W, E and R (either case) cast their
 * Skill Bar slot's Skill at `cursor` (tile units), and with the cursor off
 * the canvas (null) cast nothing. Null for any other key.
 */
export function castKeyOrder(key: string, cursor: Vec | null): Order | null {
  const slot = KEYED_SLOTS.find(
    (keyed) => slotKey(keyed) === key.toUpperCase(),
  );
  if (!slot || !cursor) return null;
  return { type: "Cast", slot, target: { ...cursor } };
}

/**
 * The order a key press gives: keys 1 to 4 drink from Belt Columns 1 to 4.
 * Null for any other key.
 */
export function drinkKeyOrder(key: string): Order | null {
  for (let column = 0; column < beltTuning.columns; column++) {
    if (beltColumnKey(column) === key) return { type: "DrinkFromBelt", column };
  }
  return null;
}

/**
 * The order a key press gives: P (either case) opens a Town Portal. Null for
 * any other key.
 */
export function townPortalKeyOrder(key: string): Order | null {
  return key.toLowerCase() === "p" ? { type: "OpenTownPortal" } : null;
}
