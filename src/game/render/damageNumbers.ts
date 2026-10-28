import type { CastFailure, MonsterId, SimEvent } from "../sim/world";
import type { CharacterId } from "./hover";

/** How long a damage number floats (ms). */
export const FLOAT_MS = 900;
/** How fast it rises (CSS px/s at native scale). */
const RISE_SPEED = 30;
/**
 * A damage number's text (CSS px at native scale, drawn at the UI Scale):
 * `size` tall in a black outline `stroke` wide, appearing `gap` over where
 * a Monster's Life bar goes.
 */
export const DAMAGE_NUMBER = { size: 18, stroke: 3, gap: 2 };

/**
 * A number to float up from whoever was hit: `hit` for the Hero's hits,
 * `kill` for a killing blow and `taken` for damage the Hero or one of their
 * Minions takes; a `miss` floating up from a Monster the Hero Missed, or
 * from the Hero or one of their Minions a Monster Missed; `noRoom` over the
 * Hero, who found no room for a Ground Item; or `castFailed` over the Hero,
 * whose cast failed for `reason`.
 */
export type DamageNumber =
  | {
      on: CharacterId | "hero";
      damage: number;
      kind: "hit" | "kill" | "taken";
    }
  | { on: CharacterId | "hero"; kind: "miss" }
  | { on: "hero"; kind: "noRoom" }
  | { on: "hero"; kind: "castFailed"; reason: CastFailure };

/** What a failed cast floats, by why it failed. */
const CAST_FAILED_TEXT: Record<CastFailure, string> = {
  town: "Can't cast in Town",
  mana: "Not enough Mana",
  corpse: "No Corpse",
};

/**
 * The damage numbers, Misses, No rooms and failed casts a step's events
 * show.
 */
export function damageNumbers(events: readonly SimEvent[]): DamageNumber[] {
  const died = new Set<MonsterId>();
  for (const event of events) {
    if (event.type === "MonsterDied") died.add(event.id);
  }
  const numbers: DamageNumber[] = [];
  for (const event of events) {
    if (event.type === "HitLanded") {
      const kind = died.has(event.target) ? "kill" : "hit";
      numbers.push({ on: event.target, damage: event.damage, kind });
    }
    if (event.type === "Missed") {
      numbers.push({ on: event.target, kind: "miss" });
    }
    // A hit the Bone Ward soaked whole leaves the Life orb untouched.
    if (event.type === "HeroHit" && event.damage > 0) {
      numbers.push({ on: "hero", damage: event.damage, kind: "taken" });
    }
    if (event.type === "MinionHit") {
      numbers.push({
        on: { minion: event.minion },
        damage: event.damage,
        kind: "taken",
      });
    }
    if (event.type === "MinionMissed") {
      numbers.push({ on: { minion: event.minion }, kind: "miss" });
    }
    if (event.type === "NoRoom") numbers.push({ on: "hero", kind: "noRoom" });
    if (event.type === "CastFailed") {
      numbers.push({ on: "hero", kind: "castFailed", reason: event.reason });
    }
  }
  return numbers;
}

/** The text a damage number floats: its damage, or what happened. */
export function floatText(number: DamageNumber): string {
  if (number.kind === "miss") return "Miss";
  if (number.kind === "noRoom") return "No room";
  if (number.kind === "castFailed") return CAST_FAILED_TEXT[number.reason];
  return String(number.damage);
}

/**
 * How far a damage number has risen (CSS px) at the UI Scale `uiScale` and
 * how opaque it is (0..1), `ageMs` after it appeared; null once it's gone.
 * It fades out over the second half of its life.
 */
export function floatAt(
  ageMs: number,
  uiScale: number,
): { rise: number; alpha: number } | null {
  if (ageMs >= FLOAT_MS) return null;
  return {
    rise: (RISE_SPEED * uiScale * ageMs) / 1000,
    alpha: Math.min(1, 2 * (1 - ageMs / FLOAT_MS)),
  };
}
