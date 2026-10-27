import { distance, type Vec } from "../sim/vec";
import type { MonsterId, World } from "../sim/world";
import { inputTuning } from "../tuning/input";

/**
 * The Target auto-aim picks with no cursor (ADR 0002): of the living
 * Monsters within `targetRange` of the Hero and inside a cone of
 * `targetConeDegrees` around `direction` (in tiles), the nearest; null when
 * there is none.
 */
export function pickTarget(world: World, direction: Vec): MonsterId | null {
  const { pos } = world.hero;
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) return null;
  const halfCone = ((inputTuning.targetConeDegrees / 2) * Math.PI) / 180;
  let nearest: { id: MonsterId; distance: number } | null = null;
  for (const monster of world.monsters) {
    if (monster.life <= 0) continue;
    const away = distance(pos, monster.pos);
    if (away > inputTuning.targetRange) continue;
    if (nearest && away >= nearest.distance) continue;
    // One standing on the Hero is ahead whichever way they face.
    if (away > 0) {
      const along =
        ((monster.pos.x - pos.x) * direction.x +
          (monster.pos.y - pos.y) * direction.y) /
        (away * length);
      if (along < Math.cos(halfCone)) continue;
    }
    nearest = { id: monster.id, distance: away };
  }
  return nearest?.id ?? null;
}
