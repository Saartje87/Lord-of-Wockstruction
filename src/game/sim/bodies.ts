import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { type Area, isWalkable } from "./area";
import { fitsAt, isClear, type Obstacle } from "./path";
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
 * The Bodies a Monster can't walk through: the Hero's Minions, bar `except`
 * (the one it is going after, which it walks up to).
 */
export function minionBodies(world: World, except?: object | null): Obstacle[] {
  return world.minions
    .filter((minion) => minion !== except)
    .map((minion) => ({
      pos: minion.pos,
      radius: minionTuning[minion.type].radius,
    }));
}

/**
 * The Bodies a Minion can't walk through: the Monsters, bar `except` (the
 * one it is going after, which it walks up to).
 */
export function monsterBodies(
  world: World,
  except?: object | null,
): Obstacle[] {
  return world.monsters
    .filter((monster) => monster !== except)
    .map((monster) => ({
      pos: monster.pos,
      radius: monsterTuning[monster.type].radius,
    }));
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
  const others = [
    ...(world.death
      ? []
      : [{ pos: world.hero.pos, radius: heroTuning.radius }]),
    ...world.minions
      .filter((minion) => !ignore.includes(minion))
      .map((minion) => ({
        pos: minion.pos,
        radius: minionTuning[minion.type].radius,
      })),
    ...world.monsters
      .filter((monster) => !ignore.includes(monster))
      .map((monster) => ({
        pos: monster.pos,
        radius: monsterTuning[monster.type].radius,
      })),
  ];
  const free = (spot: Vec) =>
    fitsAt(area, spot, size) &&
    isClear(area, from, spot, size) &&
    others.every((other) => distance(other.pos, spot) >= other.radius + radius);

  if (free(from)) return from;
  let fallback: Vec | null = fitsAt(area, from, size) ? from : null;
  for (let ring = 1; ring * SPOT_STEP <= SPOT_REACH; ring++) {
    const away = ring * SPOT_STEP;
    for (let turn = 0; turn < SPOT_TURNS; turn++) {
      const angle = (2 * Math.PI * turn) / SPOT_TURNS;
      const spot = {
        x: from.x + away * Math.cos(angle),
        y: from.y + away * Math.sin(angle),
      };
      if (free(spot)) return spot;
      if (!fallback && fitsAt(area, spot, size)) fallback = spot;
    }
  }
  return fallback ?? from;
}
