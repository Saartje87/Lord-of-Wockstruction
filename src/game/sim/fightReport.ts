import {
  createWorld,
  FRESH_PROGRESS,
  levelExperience,
  type Order,
  type SimEvent,
  step,
  type World,
} from "./world";

/** Ticks between the Hero's Attack orders: steady melee, as a held click. */
const ATTACK_EVERY = 120;

/** How one fight with a Unique Monster alone went. */
export type Fight = {
  /** Ticks until the Unique Monster died, or the cap if it lived. */
  ticks: number;
  killed: boolean;
  /** Hits the Hero took. */
  hitsTaken: number;
  /** Life the Hero lost in all, though kept alive throughout. */
  damageTaken: number;
  /** The Hero's max Life at the start. */
  heroMaxLife: number;
  events: SimEvent[];
};

/**
 * Leaves the Unique Monster `name` alone in `world`'s Area with the Hero
 * beside it, kept alive, Attacking it every `ATTACK_EVERY` ticks until it
 * dies or `maxTicks` pass.
 */
export function fightUniqueAlone(
  world: World,
  name: string,
  maxTicks: number,
): Fight {
  const unique = world.monsters.find((monster) => monster.unique === name);
  if (!unique) throw new Error(`no ${name} in ${world.areaName}`);
  world.monsters = [unique];
  world.hero.pos = { x: unique.pos.x - 1.2, y: unique.pos.y };
  world.hero.prevPos = { ...world.hero.pos };
  const heroMaxLife = world.hero.life;
  const events: SimEvent[] = [];
  let ticks = 0;
  let hitsTaken = 0;
  let damageTaken = 0;
  while (ticks < maxTicks && world.monsters.includes(unique)) {
    const orders: Order[] =
      ticks % ATTACK_EVERY === 0
        ? [{ type: "Attack", monster: unique.id }]
        : [];
    events.push(...step(world, orders));
    if (world.hero.life < heroMaxLife) {
      hitsTaken++;
      damageTaken += heroMaxLife - world.hero.life;
    }
    world.hero.life = heroMaxLife;
    ticks++;
  }
  return {
    ticks,
    killed: !world.monsters.includes(unique),
    hitsTaken,
    damageTaken,
    heroMaxLife,
    events,
  };
}

/**
 * The fight with the Unique Monster `unique` alone in `area`, once per seed
 * from 1 to `seeds`, for a Hero just reached Level `level` with starting gear
 * and stats, arrived at the Area's `start` Entry.
 */
export function fightReport(options: {
  areas: Record<string, unknown>;
  tilesets?: Record<string, unknown>;
  area: string;
  unique: string;
  level: number;
  seeds: number;
  maxTicks: number;
}): Fight[] {
  return Array.from({ length: options.seeds }, (_, i) =>
    fightUniqueAlone(
      createWorld({
        areas: options.areas,
        tilesets: options.tilesets,
        seed: i + 1,
        start: { area: options.area, entry: "start" },
        progress: {
          ...FRESH_PROGRESS,
          level: options.level,
          experience: levelExperience(options.level),
        },
      }),
      options.unique,
      options.maxTicks,
    ),
  );
}
