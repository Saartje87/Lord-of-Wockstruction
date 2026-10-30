import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import type { Area } from "./area";
import { fitsAt } from "./path";
import { distance, type Vec } from "./vec";
import type { World } from "./world";

/** What a Body belongs to, which picks the rule between two of them. */
type BodyKind = "hero" | "minion" | "monster";

type Body = {
  kind: BodyKind;
  creature: { pos: Vec };
  radius: number;
  id: number;
};

/**
 * How much of an overlap between two Bodies each takes, by their kinds in
 * the order given, or null where they may overlap.
 */
const SHARES: Record<BodyKind, Record<BodyKind, [number, number] | null>> = {
  hero: { hero: null, minion: null, monster: [0, 1] },
  minion: { hero: null, minion: null, monster: [0.5, 0.5] },
  monster: { hero: [1, 0], minion: [0.5, 0.5], monster: [0.5, 0.5] },
};

/**
 * The size a Body of `radius` is checked against walls and blocking Props
 * at: no bigger than the Hero's, so it fits wherever the Hero does.
 */
export function wallRadius(radius: number): number {
  return Math.min(radius, heroTuning.radius);
}

/**
 * Pushes overlapping Bodies apart as circles, each pair by the rule for its
 * kinds. A push never leaves a Body even partly inside a wall: one into a
 * wall slides along it, keeping only the part along whichever axis is open.
 * A Hero in Death has no Body.
 */
export function separateBodies(world: World) {
  const area = world.areas[world.areaName];
  const bodies: Body[] = [
    ...(world.death
      ? []
      : [
          {
            kind: "hero" as const,
            creature: world.hero,
            radius: heroTuning.radius,
            // Never used: the Hero comes first, and only the second Body of
            // a pair picks the way two coinciding Bodies part.
            id: 0,
          },
        ]),
    ...world.minions.map((minion) => ({
      kind: "minion" as const,
      creature: minion,
      radius: minionTuning[minion.type].radius,
      id: minion.id,
    })),
    ...world.monsters.map((monster) => ({
      kind: "monster" as const,
      creature: monster,
      radius: monsterTuning[monster.type].radius,
      id: monster.id,
    })),
  ];

  for (const [i, a] of bodies.entries()) {
    for (const b of bodies.slice(i + 1)) {
      const shares = SHARES[a.kind][b.kind];
      if (!shares) continue;
      const overlap =
        a.radius + b.radius - distance(a.creature.pos, b.creature.pos);
      if (overlap <= 0) continue;
      const out = away(a.creature.pos, b.creature.pos, b.id);
      push(area, a, scaled(out, -overlap * shares[0]));
      push(area, b, scaled(out, overlap * shares[1]));
    }
  }
}

/**
 * Moves a Body by `by`, or along whichever axis of it is open where a wall
 * is in the way; not at all where neither fits.
 */
function push(area: Area, body: Body, by: Vec) {
  if (by.x === 0 && by.y === 0) return;
  const { x, y } = body.creature.pos;
  const radius = wallRadius(body.radius);
  const to = [
    { x: x + by.x, y: y + by.y },
    { x: x + by.x, y },
    { x, y: y + by.y },
  ].find((point) => fitsAt(area, point, radius));
  if (to) body.creature.pos = to;
}

/**
 * The unit vector from `from` to `to`, or, where they coincide, a direction
 * picked from `id` so the two still part the same way every replay.
 */
function away(from: Vec, to: Vec, id: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) return { x: dx / length, y: dy / length };
  return { x: Math.cos(id), y: Math.sin(id) };
}

const scaled = (v: Vec, by: number): Vec => ({ x: v.x * by, y: v.y * by });
