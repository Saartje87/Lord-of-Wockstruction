// PROTOTYPE (throwaway): Monster behaviour variants for ticket #82.
// Each variant disagrees about how Monsters notice, chase, attack and react,
// not just the numbers. Knobs in the panel override the numbers live.
// The Hero always uses the variant C feel settled in #77.

export type MonsterConfig = {
  name: string;
  blurb: string;
  /** Life of the Hero */
  heroLife: number;
  /** Life of each Monster (the Hero hits for 25) */
  monsterLife: number;
  /** tiles per second while chasing (Hero walks 5.5) */
  monsterSpeed: number;
  /** Life the Hero loses per Monster hit */
  monsterDamage: number;
  /** idle Monsters stroll around their spawn point */
  wander: boolean;
  /** tiles from spawn a wandering Monster strolls */
  wanderRadius: number;
  /** tiles at which a Monster notices the Hero */
  aggroRadius: number;
  /** noticing needs line of sight (walls hide the Hero) */
  needsSight: boolean;
  /** tiles: a Monster that aggros wakes idle Monsters this close to it. 0 = off */
  spreadRadius: number;
  /** direct: walk straight at the Hero, slide along walls. astar: path around walls */
  pathing: "direct" | "astar";
  /** Monster melee reach in tiles */
  reach: number;
  /** seconds of telegraphed wind-up before the hit lands. Step out to dodge */
  windUp: number;
  /** seconds after a swing before the Monster can swing again */
  recovery: number;
  /** random extra seconds added to recovery, so a pack doesn't swing in sync */
  jitter: number;
  /** most Monsters winding up at once. 0 = unlimited */
  maxAttackers: number;
  /** tiles from spawn at which a chasing Monster gives up and walks home. 0 = never */
  leash: number;
  /** 0..1 chance a Hero hit makes the Monster flinch */
  flinchChance: number;
  /** seconds a flinch freezes the Monster */
  flinchTime: number;
  /** a flinch cancels a wind-up in progress (stunlock possible) */
  flinchInterrupts: boolean;
  /** 0..1 chance a Monster hit makes the Hero flinch (cancels swing / walk) */
  heroFlinchChance: number;
  /** seconds a flinch freezes the Hero */
  heroFlinchTime: number;
  /** px of camera shake when the Hero is hit */
  shake: number;
  /** draw aggro and spread radii */
  showRadii: boolean;
};

export const VARIANTS = {
  A: {
    name: "D1 relentless",
    blurb:
      "Stand still until they see you, chase in a straight line, never give up. Every hit flinches them, so you can stunlock one; they can stunlock you too.",
    heroLife: 100,
    monsterLife: 75,
    monsterSpeed: 2.2,
    monsterDamage: 8,
    wander: false,
    wanderRadius: 0,
    aggroRadius: 5,
    needsSight: true,
    spreadRadius: 0,
    pathing: "direct",
    reach: 1.1,
    windUp: 0.5,
    recovery: 0.9,
    jitter: 0.3,
    maxAttackers: 0,
    leash: 0,
    flinchChance: 1,
    flinchTime: 0.25,
    flinchInterrupts: true,
    heroFlinchChance: 0.5,
    heroFlinchTime: 0.2,
    shake: 4,
    showRadii: false,
  },
  B: {
    name: "D2 pack",
    blurb:
      "Packs wander round their spawn, wake each other up, path around walls and leash home if you run. Flinch is a chance, and never cancels a wind-up.",
    heroLife: 100,
    monsterLife: 60,
    monsterSpeed: 2.8,
    monsterDamage: 6,
    wander: true,
    wanderRadius: 2.5,
    aggroRadius: 7,
    needsSight: true,
    spreadRadius: 1.5,
    pathing: "astar",
    reach: 1.2,
    windUp: 0.4,
    recovery: 1.0,
    jitter: 0.4,
    maxAttackers: 0,
    leash: 14,
    flinchChance: 0.35,
    flinchTime: 0.2,
    flinchInterrupts: false,
    heroFlinchChance: 0.25,
    heroFlinchTime: 0.15,
    shake: 4,
    showRadii: false,
  },
  C: {
    name: "Modern swarm",
    blurb:
      "The whole pack wakes at once and paths to you, but only two swing at a time. Long, readable wind-ups you can step out of; hits hurt. Short flinch, committed wind-ups, the Hero never flinches.",
    heroLife: 100,
    monsterLife: 50,
    monsterSpeed: 3.2,
    monsterDamage: 12,
    wander: false,
    wanderRadius: 0,
    aggroRadius: 8,
    needsSight: true,
    spreadRadius: 8,
    pathing: "astar",
    reach: 1.0,
    windUp: 0.55,
    recovery: 0.8,
    jitter: 0.5,
    maxAttackers: 2,
    leash: 0,
    flinchChance: 1,
    flinchTime: 0.12,
    flinchInterrupts: false,
    heroFlinchChance: 0,
    heroFlinchTime: 0.15,
    shake: 5,
    showRadii: false,
  },
} satisfies Record<string, MonsterConfig>;

export type VariantKey = keyof typeof VARIANTS;
export const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];
