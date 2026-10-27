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
  if (!direction) return nearestWhere(world, () => true);
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) return null;
  const { pos } = world.hero;
  return nearestWhere(world, (at, away) => {
    // One standing on the Hero is ahead whichever way they face.
    if (away === 0) return true;
    const along =
      ((at.x - pos.x) * direction.x + (at.y - pos.y) * direction.y) /
      (away * length);
    return along >= CONE_EDGE;
  });
}

/**
 * The nearest living Monster within `targetRange` of the Hero that `accept`
 * (given where it stands and how far that is from the Hero) lets through.
 */
function nearestWhere(
  world: World,
  accept: (at: Vec, away: number) => boolean,
): MonsterId | null {
  const { pos } = world.hero;
  let nearest: { id: MonsterId; distance: number } | null = null;
  for (const monster of world.monsters) {
    if (monster.life <= 0) continue;
    const away = distance(pos, monster.pos);
    if (away > inputTuning.targetRange) continue;
    if (nearest && away >= nearest.distance) continue;
    if (!accept(monster.pos, away)) continue;
    nearest = { id: monster.id, distance: away };
  }
  return nearest?.id ?? null;
}
