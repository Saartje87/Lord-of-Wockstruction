import type { SkillBarSlot } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import type { Order } from "../sim/world";

/** The Skill Bar slot each key casts, by `KeyboardEvent.key`. */
const CAST_KEYS: Record<string, SkillBarSlot> = {
  "1": "key1",
  "2": "key2",
  "3": "key3",
  "4": "key4",
};

/**
 * The order a key press gives: keys 1–4 cast their Skill Bar slot's Skill
 * at `cursor` (tile units), and with the cursor off the canvas (null) cast
 * nothing. Null for any other key.
 */
export function castKeyOrder(key: string, cursor: Vec | null): Order | null {
  if (!Object.hasOwn(CAST_KEYS, key) || !cursor) return null;
  return { type: "Cast", slot: CAST_KEYS[key], target: { ...cursor } };
}
