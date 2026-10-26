import { KEYED_SLOTS, slotKey } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import type { Order } from "../sim/world";

/**
 * The order a key press gives: keys 1–4 cast their Skill Bar slot's Skill
 * at `cursor` (tile units), and with the cursor off the canvas (null) cast
 * nothing. Null for any other key.
 */
export function castKeyOrder(key: string, cursor: Vec | null): Order | null {
  const slot = KEYED_SLOTS.find((keyed) => slotKey(keyed) === key);
  if (!slot || !cursor) return null;
  return { type: "Cast", slot, target: { ...cursor } };
}
