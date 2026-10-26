import type { CastFailure, MonsterId, SimEvent } from "../sim/world";

/** How long a damage number floats (ms). */
export const FLOAT_MS = 900;
/** How fast it rises (CSS px/s). */
const RISE_SPEED = 30;

/**
 * A number to float up from whoever was hit: `hit` for the Hero's hits,
 * `kill` for a killing blow and `taken` for damage the Hero or their Minion
 * takes; a `miss` floating up from a Monster the Hero Missed, or from the
 * Hero or their Minion a Monster Missed; `noRoom` over the Hero, who found
 * no room for a Ground Item; or `castFailed` over the Hero, whose cast
 * failed for `reason`.
 */
export type DamageNumber =
  | {
      on: MonsterId | "hero" | "minion";
      damage: number;
      kind: "hit" | "kill" | "taken";
    }
  | { on: MonsterId | "hero" | "minion"; kind: "miss" }
  | { on: "hero"; kind: "noRoom" }
  | { on: "hero"; kind: "castFailed"; reason: CastFailure };

/** What a failed cast floats, by why it failed. */
const CAST_FAILED_TEXT: Record<CastFailure, string> = {
  town: "Can't cast in Town",
  mana: "Not enough Mana",
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
    if (event.type === "HeroHit") {
      numbers.push({ on: "hero", damage: event.damage, kind: "taken" });
    }
    if (event.type === "MinionHit") {
      numbers.push({ on: "minion", damage: event.damage, kind: "taken" });
    }
    if (event.type === "MinionMissed") {
      numbers.push({ on: "minion", kind: "miss" });
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
 * How far a damage number has risen (CSS px) and how opaque it is (0..1),
 * `ageMs` after it appeared; null once it's gone. It fades out over the
 * second half of its life.
 */
export function floatAt(ageMs: number): { rise: number; alpha: number } | null {
  if (ageMs >= FLOAT_MS) return null;
  return {
    rise: (RISE_SPEED * ageMs) / 1000,
    alpha: Math.min(1, 2 * (1 - ageMs / FLOAT_MS)),
  };
}
