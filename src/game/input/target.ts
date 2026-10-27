import { distance, type Vec } from "../sim/vec";
import type { MonsterId, World } from "../sim/world";
import { inputTuning } from "../tuning/input";

/** The cosine of half the Target cone, converted once from its degrees. */
const CONE_EDGE = Math.cos(
  ((inputTuning.targetConeDegrees / 2) * Math.PI) / 180,
);

/**
 * The Target auto-aim picks with no cursor (ADR 0002): of the living
 * Monsters within `targetRange` of the Hero, the nearest; null when there is
 * none. Given a `direction` (in tiles, the way the stick walks the Hero),
 * only those inside a cone of `targetConeDegrees` around it count. Given
 * none (the stick at rest), they count whichever way they lie.
 */
export function pickTarget(
  world: World,
  direction: Vec | null,
): MonsterId | null {
  const { pos } = world.hero;
  const length = direction ? Math.hypot(direction.x, direction.y) : 0;
  if (direction && length === 0) return null;
  let nearest: { id: MonsterId; distance: number } | null = null;
  for (const monster of world.monsters) {
    if (monster.life <= 0) continue;
    const away = distance(pos, monster.pos);
    if (away > inputTuning.targetRange) continue;
    if (nearest && away >= nearest.distance) continue;
    // One standing on the Hero is ahead whichever way they face.
    if (direction && away > 0) {
      const along =
        ((monster.pos.x - pos.x) * direction.x +
          (monster.pos.y - pos.y) * direction.y) /
        (away * length);
      if (along < CONE_EDGE) continue;
    }
    nearest = { id: monster.id, distance: away };
  }
  return nearest?.id ?? null;
}
