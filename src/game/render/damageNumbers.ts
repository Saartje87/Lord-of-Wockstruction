import type { MonsterId, SimEvent } from "../sim/world";

/** How long a damage number floats (ms). */
export const FLOAT_MS = 900;
/** How fast it rises (CSS px/s). */
const RISE_SPEED = 30;

/**
 * A number to float up from whoever was hit: `hit` for the Hero's hits,
 * `kill` for a killing blow and `taken` for damage the Hero takes; a
 * `miss` floating up from a Monster the Hero Missed, or from the Hero a
 * Monster Missed; or `noRoom` over the Hero, who found no room for a Ground
 * Item.
 */
export type DamageNumber =
  | { on: MonsterId | "hero"; damage: number; kind: "hit" | "kill" | "taken" }
  | { on: MonsterId | "hero"; kind: "miss" }
  | { on: "hero"; kind: "noRoom" };

/** The damage numbers, Misses and No rooms a step's events show. */
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
    if (event.type === "NoRoom") numbers.push({ on: "hero", kind: "noRoom" });
  }
  return numbers;
}

/** The text a damage number floats: its damage, or what happened. */
export function floatText(number: DamageNumber): string {
  if (number.kind === "miss") return "Miss";
  if (number.kind === "noRoom") return "No room";
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
