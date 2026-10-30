import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { type Area, isWalkable } from "./area";
import { fitsAt, isClear, type Obstacle } from "./path";
import { distance, type Vec } from "./vec";
import type { World } from "./world";

/** What a Body belongs to, which picks the rule between two of them. */
type BodyKind = "hero" | "minion" | "monster";

/**
 * A creature's Body in the shoving pass: whose it is, how big, and its id
 * for breaking ties.
 */
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
  hero: { hero: null, minion: [0, 1], monster: [0, 1] },
  minion: { hero: [1, 0], minion: [0.5, 0.5], monster: [0.5, 0.5] },
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
 * The Bodies of the Hero (unless in Death) and their Minions (`side`
 * "hero"), of the Monsters ("monster") or of all ("all"), bar those in
 * `ignore`, which are not there.
 */
function bodiesOf(
  world: World,
  side: "hero" | "monster" | "all",
  ignore: readonly (object | null | undefined)[] = [],
): Obstacle[] {
  const bodies: Obstacle[] = [];
  if (side !== "monster" && !world.death && !ignore.includes(world.hero)) {
    bodies.push({ pos: world.hero.pos, radius: heroTuning.radius });
  }
  if (side !== "monster") {
    for (const minion of world.minions) {
      if (ignore.includes(minion)) continue;
      bodies.push({
        pos: minion.pos,
        radius: minionTuning[minion.type].radius,
      });
    }
  }
  if (side !== "hero") {
    for (const monster of world.monsters) {
      if (ignore.includes(monster)) continue;
      bodies.push({
        pos: monster.pos,
        radius: monsterTuning[monster.type].radius,
      });
    }
  }
  return bodies;
}

/**
 * The Bodies a Monster can't walk through: the Hero's (unless in Death) and
 * their Minions', bar `except` (the one it is going after, which it walks up
 * to).
 */
export function heroSideBodies(
  world: World,
  except?: object | null,
): Obstacle[] {
  return bodiesOf(world, "hero", [except]);
}

/**
 * The Bodies the Hero or a Minion can't walk through: the Monsters', bar
 * `except` (the one it is going after, which it walks up to).
 */
export function monsterBodies(
  world: World,
  except?: object | null,
): Obstacle[] {
  return bodiesOf(world, "monster", [except]);
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

  // Pairs on opposite sides first, so the shoves within a side, which come
  // last, are what a step ends on.
  for (const crossing of [true, false]) {
    for (const [i, a] of bodies.entries()) {
      for (const b of bodies.slice(i + 1)) {
        if (((a.kind === "monster") !== (b.kind === "monster")) !== crossing) {
          continue;
        }
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

  // The shoves within a side can push a Monster back into the other side, or
  // fail against a wall, so settle the pairs left overlapping: the Monster
  // gives way, and a Minion only where the Monster can't (never the Hero).
  for (let pass = 0; pass < SETTLE_PASSES; pass++) {
    for (const monster of bodies) {
      if (monster.kind !== "monster") continue;
      for (const other of bodies) {
        if (other.kind === "monster") continue;
        const overlap =
          monster.radius +
          other.radius -
          distance(monster.creature.pos, other.creature.pos);
        if (overlap <= 1e-6) continue;
        const out = away(other.creature.pos, monster.creature.pos, monster.id);
        const moved = push(area, monster, scaled(out, overlap));
        if (other.kind === "minion") {
          push(area, other, scaled(out, -(overlap - moved)));
        }
      }
    }
  }
}

/** How many times the pairs on opposite sides are settled at a step's end. */
const SETTLE_PASSES = 2;

/**
 * Moves a Body by `by`, or along whichever axis of it is open where a wall
 * is in the way; not at all where neither fits. Returns how far along `by`
 * it got.
 */
function push(area: Area, body: Body, by: Vec): number {
  if (by.x === 0 && by.y === 0) return 0;
  const { x, y } = body.creature.pos;
  const radius = wallRadius(body.radius);
  const to = [
    { x: x + by.x, y: y + by.y },
    { x: x + by.x, y },
    { x, y: y + by.y },
  ].find((point) => fitsAt(area, point, radius));
  if (!to) return 0;
  body.creature.pos = to;
  const length = Math.hypot(by.x, by.y);
  return Math.max(0, ((to.x - x) * by.x + (to.y - y) * by.y) / length);
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

/**
 * Where a Minion of `radius` summoned at `point` stands: there if walkable,
 * else the nearest point to it on a walkable tile, kept `radius` inside the
 * tile's edges. Null in an Area with nowhere walkable.
 */
export function summonPoint(
  area: Area,
  point: Vec,
  radius: number,
): Vec | null {
  if (isWalkable(area, point)) return { ...point };
  let nearest: Vec | null = null;
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!isWalkable(area, { x, y })) continue;
      const clamped = {
        x: Math.min(x + 1 - radius, Math.max(x + radius, point.x)),
        y: Math.min(y + 1 - radius, Math.max(y + radius, point.y)),
      };
      if (!nearest || distance(clamped, point) < distance(nearest, point)) {
        nearest = clamped;
      }
    }
  }
  return nearest;
}

/** How far apart the candidate spots of a search lie along a ring (tiles). */
const SPOT_STEP = 0.25;
/** How many ways round each ring of a search are tried. */
const SPOT_TURNS = 24;
/** How far from the spot asked for a search looks (tiles). */
const SPOT_REACH = 10;

/**
 * Where a creature with a Body of `radius` asked to appear at `point` can
 * stand: `point` itself, else the nearest spot to it that is walkable, fits
 * the Body at the walls, has a clear line from `point` and overlaps no
 * Body. A `point` in a wall counts as the nearest walkable spot to it. Bodies
 * in `ignore` are not there (for a creature about to be placed, or one just
 * crumbled away).
 *
 * Spots are tried nearest first, then in turn round the ring from east, so
 * the same World always gives the same spot. With no free spot in reach it
 * is the nearest one that fits at the walls, overlapping, for the shove to
 * part; null in an Area with nowhere walkable.
 */
export function freeSpot(
  world: World,
  point: Vec,
  radius: number,
  ignore: readonly object[] = [],
): Vec | null {
  const area = world.areas[world.areaName];
  const size = wallRadius(radius);
  const from = summonPoint(area, point, size);
  if (!from) return null;
  const others = bodiesOf(world, "all", ignore);
  const free = (spot: Vec) =>
    fitsAt(area, spot, size) &&
    isClear(area, from, spot, size) &&
    others.every((other) => distance(other.pos, spot) >= other.radius + radius);

  if (free(from)) return from;
  let fallback: Vec | null = fitsAt(area, from, size) ? from : null;
  for (let ring = 1; ring * SPOT_STEP <= SPOT_REACH; ring++) {
    const reach = ring * SPOT_STEP;
    for (let turn = 0; turn < SPOT_TURNS; turn++) {
      const angle = (2 * Math.PI * turn) / SPOT_TURNS;
      const spot = {
        x: from.x + reach * Math.cos(angle),
        y: from.y + reach * Math.sin(angle),
      };
      if (free(spot)) return spot;
      if (!fallback && fitsAt(area, spot, size)) fallback = spot;
    }
  }
  return fallback ?? from;
}

/** How many spots round a target are tried for an attack position. */
const ATTACK_SPOTS = 24;

/**
 * Where a creature with a Body of `radius` at `self` can stand to attack
 * `target` from within `reach`: the nearest to it of the spots round the
 * target that are walkable, fit the Body at the walls, have a clear line to
 * the target and overlap no other Body. Bodies in `ignore` (the target
 * itself) are not counted. Null with no spot free.
 *
 * The spots start in line with `self` and go evenly round the target, so a
 * lone attacker walks straight at it; ties go to the earlier spot, keeping
 * the same World to the same answer.
 */
export function attackSpot(
  world: World,
  self: { pos: Vec },
  radius: number,
  target: Vec,
  reach: number,
  ignore: readonly object[] = [],
): Vec | null {
  const area = world.areas[world.areaName];
  const size = wallRadius(radius);
  const others = bodiesOf(world, "all", [self, ...ignore]);
  const base = Math.atan2(self.pos.y - target.y, self.pos.x - target.x);
  let best: Vec | null = null;
  for (let turn = 0; turn < ATTACK_SPOTS; turn++) {
    const angle = base + (2 * Math.PI * turn) / ATTACK_SPOTS;
    const spot = {
      x: target.x + reach * Math.cos(angle),
      y: target.y + reach * Math.sin(angle),
    };
    if (best && distance(self.pos, spot) >= distance(self.pos, best)) continue;
    if (
      others.every(
        (other) => distance(other.pos, spot) >= other.radius + radius - 1e-6,
      ) &&
      fitsAt(area, spot, size) &&
      isClear(area, target, spot, size)
    ) {
      best = spot;
    }
  }
  return best;
}
