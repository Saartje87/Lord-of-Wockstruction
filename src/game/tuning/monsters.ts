import type { DamageShares, Resistances } from "./damage";
import type { ProjectileKind } from "./projectiles";

/**
 * Monster tuning, in human units. The sim converts it to steps once. The
 * Skeleton's numbers are the final knobs of the Monster behaviour prototype
 * (#82), with the damage from the combat numbers (#83). The Zombie's and
 * the Skeleton Archer's are set against the Skeleton's, by fights in the
 * Catacombs, Crypt and Ossuary and `npm run tuning:report` (T199).
 */
export type MonsterTuning = {
  /** Shown on the nameplate. */
  name: string;
  life: number;
  /** Experience the Hero gains for killing one. */
  experience: number;
  /** Chase speed, in tiles per second. */
  speed: number;
  /** Damage per hit, rolled from `[min, max]` inclusive. */
  damage: [number, number];
  /**
   * How its damage splits over Damage Types; missing, all Physical. A hit
   * rolls its chance to hit whatever it is made of.
   */
  damageTypes?: DamageShares;
  /**
   * What it shrugs off of each Element's damage (percent; see `Resistances`),
   * the same at every Monster Level. Missing ones are 0.
   */
  resistances?: Resistances;
  /** Set against the Hero's Attack Rating for the chance to hit it. */
  defense: number;
  /** Set against the Hero's Defense for its chance to hit them. */
  attackRating: number;
  /** How big a Monster is when pushed apart from others (tiles). */
  radius: number;
  /** How far an idle Monster strolls from its spawn (tiles). */
  wanderRadius: number;
  /** Stroll speed, as a fraction of `speed`. */
  wanderSpeed: number;
  /** How long an idle Monster pauses between strolls, `[min, max]` (ms). */
  wanderPauseMs: [number, number];
  /** How near the Hero must come to be noticed (tiles). */
  aggroRadius: number;
  /** While walking around walls, how often a Monster re-plans its path (ms). */
  replanMs: number;
  /** Whether walls hide the Hero from a Monster. */
  needsSight: boolean;
  /** How near idle Monsters must be to wake with one that notices (tiles). */
  spreadRadius: number;
  /** How it attacks: a swing at what is in reach, or a Projectile loosed. */
  attack: MeleeTuning | RangedTuning;
  /** The telegraph before an attack's hit, or before a ranged type looses (ms). */
  windUpMs: number;
  /** How long a Monster is rooted after its hit (ms). */
  rootMs: number;
  /** The wait after rooting before it can attack again (ms). */
  recoveryMs: number;
  /** Up to this much random extra wait, so a pack doesn't swing in sync (ms). */
  jitterMs: number;
  /** How many Monsters may wind up at once; 0 for no cap. */
  maxAttackers: number;
  /** How far from its spawn a Monster chases before giving up (tiles). */
  leash: number;
  /** Walking home speed, as a multiple of `speed`. */
  returnSpeed: number;
  /** After getting home, how long before it can notice the Hero again (ms). */
  graceMs: number;
  /** The chance a hit makes it flinch. */
  flinchChance: number;
  flinchMs: number;
  /** Whether a flinch cancels a wind-up. */
  flinchInterrupts: boolean;
  /**
   * How much each number above, as at Monster Level 1, grows by for every
   * Monster Level above 1, as a fraction of its Monster Level 1 value: 0.25
   * adds a quarter of it per Monster Level. Each end of `damage` grows alike.
   * The rest of the type's numbers stay the same at every Monster Level.
   */
  growth: MonsterGrowth;
};

/**
 * A melee attack: the Monster stops once its target is within `reach`, winds
 * up, and swings.
 */
export type MeleeTuning = {
  kind: "melee";
  /** How near its target must be to start an attack (tiles). */
  reach: number;
  /**
   * How much further its target may get during the wind-up and still be hit
   * (tiles).
   */
  reachGrace: number;
  /** An attack hits its target within this of the facing it wound up in. */
  arcDegrees: number;
  /**
   * Set for a Slam: on the hit it ignores `reachGrace` and `arcDegrees` and
   * hits every Hero and Minion within `radius` of the Monster (tiles),
   * whichever way it faces. `reach` is then how near its target must be to
   * start winding up.
   */
  slam?: { radius: number };
};

/**
 * A ranged attack: the Monster stops once its target is within `range` and in
 * sight, winds up, and looses a Projectile at where its target then is.
 */
export type RangedTuning = {
  kind: "ranged";
  /** What it looses. */
  projectile: ProjectileKind;
  /** How near its target must be, and in sight, to start an attack (tiles). */
  range: number;
  /**
   * How its Projectile's damage splits over Damage Types, instead of the
   * Monster type's `damageTypes`, so a blow of the same Monster stays
   * Physical (Grave Wockington). A burn's ticks carry them too.
   */
  damageTypes?: DamageShares;
  /** How fast its Projectile flies (tiles per second). */
  projectileSpeed: number;
  /** How far its Projectile flies before it vanishes (tiles). */
  projectileRange: number;
  /**
   * Set for a lobbed Projectile (Muck): it flies over everything to the point
   * its target stood at when it was loosed, at `projectileSpeed` along the
   * ground, and there hits every Hero and Minion within `radius` (tiles).
   * Its `projectileRange` is then unused.
   */
  lob?: {
    radius: number;
    /**
     * Set when it lands where the Hero stood when it was loosed, whoever its
     * Monster is after.
     */
    atHero?: boolean;
    /**
     * Set when it lands as a burning circle instead of a blow: for `burnMs`
     * it hurts every Hero (not in Death) and Minion within `radius`, every
     * `tickMs`, for the Monster's damage times `damage` (at least 1) each time.
     */
    burn?: { burnMs: number; tickMs: number; damage: number };
  };
  /**
   * Set for a Monster that also swings: with its target within this reach it
   * winds up a blow instead of loosing, as a melee attack would.
   */
  melee?: Omit<MeleeTuning, "kind" | "slam">;
  /**
   * How long it recovers, after loosing and before it can attack again, at
   * each of its stages (ms): the first for its first stage. Missing, the
   * type's `recoveryMs`.
   */
  recoveryMs?: number[];
};

/** A growth rate per Monster Level for each number that scales with it. */
export type MonsterGrowth = {
  life: number;
  damage: number;
  attackRating: number;
  defense: number;
  experience: number;
};

export type MonsterType =
  | "skeleton"
  | "zombie"
  | "skeleton_archer"
  | "wockwolf"
  | "bog_spitter"
  | "wockbrute"
  | "grave_wockington";

export const monsterTuning: Record<MonsterType, MonsterTuning> = {
  skeleton: {
    name: "Skeleton",
    // The starting table of Damage Types and Resistances: undead shrug off
    // Cold, plants and muck burn. All of it to be tuned.
    resistances: { cold: 25 },
    life: 60,
    experience: 100,
    speed: 2.8,
    damage: [4, 8],
    // A fresh Hero's 100 Attack Rating hits it 85% of the time.
    defense: 135,
    // Leather Armour's 27 Defense makes it Miss 15% of the time, and a Hero
    // with 0 Defense is always hit.
    attackRating: 20,
    radius: 0.32,
    wanderRadius: 2.5,
    wanderSpeed: 0.35,
    wanderPauseMs: [1000, 3500],
    aggroRadius: 7,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    attack: { kind: "melee", reach: 1.2, reachGrace: 0.25, arcDegrees: 60 },
    windUpMs: 400,
    rootMs: 200,
    recoveryMs: 1000,
    jitterMs: 400,
    maxAttackers: 0,
    leash: 14,
    returnSpeed: 1.2,
    graceMs: 2000,
    flinchChance: 0.35,
    flinchMs: 200,
    flinchInterrupts: false,
    // Defaults to check in a playtest: in the Crypt (Area Level 4) a Skeleton
    // has 105 Life and hits for 6–13; in the Ossuary (8), 165 and 10–19.
    growth: {
      life: 0.25,
      damage: 0.2,
      // Slow, so Defense keeps mattering down to the Ossuary (Attack
      // Rating 34 there).
      attackRating: 0.1,
      defense: 0.15,
      // Against Skeletons of the Hero's own Level, 2.5–8 kills per Level up
      // to Level 14, as 5 take a fresh Hero to Level 2. The Experience table
      // grows too fast after that for one rate to keep up.
      experience: 3,
    },
  },
  // Slow and tough, and hits hard after a long wind-up: easy to walk away
  // from, costly to stand and trade with.
  zombie: {
    name: "Zombie",
    resistances: { fire: -25, cold: 25 },
    life: 150,
    // Twice a Skeleton's: one takes about twice as long to kill, and costs
    // the Hero about twice the Life, in every Combat Area.
    experience: 200,
    speed: 1.4,
    damage: [7, 14],
    // A little easier to hit than a Skeleton.
    defense: 120,
    attackRating: 25,
    radius: 0.36,
    wanderRadius: 1.5,
    wanderSpeed: 0.35,
    wanderPauseMs: [1500, 4500],
    aggroRadius: 6,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    attack: { kind: "melee", reach: 1.2, reachGrace: 0.25, arcDegrees: 60 },
    windUpMs: 750,
    rootMs: 300,
    recoveryMs: 1200,
    jitterMs: 400,
    maxAttackers: 0,
    leash: 14,
    returnSpeed: 1.2,
    graceMs: 2000,
    flinchChance: 0.1,
    flinchMs: 200,
    flinchInterrupts: false,
    // Slower than the Skeleton's in Life and damage. At its rates a Zombie
    // hit for 17–34 in the Ossuary and cost three times a Skeleton's Life to
    // kill there. Now it has 360 Life and hits for 14–29, still well above a
    // Skeleton's 10–19.
    growth: {
      life: 0.2,
      damage: 0.15,
      attackRating: 0.1,
      defense: 0.15,
      experience: 3,
    },
  },
  // Fragile, and looses Arrows from range: it chips at the Hero rather than
  // bursting them down, and pays off when reached.
  skeleton_archer: {
    name: "Skeleton Archer",
    resistances: { cold: 25 },
    life: 36,
    experience: 110,
    speed: 2.8,
    damage: [3, 6],
    defense: 135,
    attackRating: 20,
    radius: 0.32,
    wanderRadius: 2.5,
    wanderSpeed: 0.35,
    wanderPauseMs: [1000, 3500],
    // Further than its range, and than the Skeleton's, so Archers behind a
    // pack of Skeletons notice the Hero on their own when the Skeletons do.
    aggroRadius: 9,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    // Faster than the Hero's 5.5 tiles/s walk, so it threatens, but slow
    // enough at range to step aside from. From its furthest shot an Arrow
    // flies on 4 tiles past where it was aimed: enough to land on whatever
    // stands just behind, and a Hero backing straight off has outrun it.
    attack: {
      kind: "ranged",
      projectile: "arrow",
      range: 6,
      projectileSpeed: 9,
      projectileRange: 10,
    },
    windUpMs: 600,
    rootMs: 200,
    recoveryMs: 1600,
    jitterMs: 400,
    // No cap: a pack of three looses about one Arrow a second between them,
    // which hurts less than the Skeletons in front of them.
    maxAttackers: 0,
    leash: 14,
    returnSpeed: 1.2,
    graceMs: 2000,
    // Hitting it often cancels the shot it's drawing, so reaching it pays.
    flinchChance: 0.5,
    flinchMs: 200,
    flinchInterrupts: true,
    // The Skeleton's rates, so it stays as fragile next to one in every
    // Combat Area: 99 Life and 7–14 an Arrow in the Ossuary.
    growth: {
      life: 0.25,
      damage: 0.2,
      attackRating: 0.1,
      defense: 0.15,
      experience: 3,
    },
  },
  // The outdoors' pack animal: faster than the Hero walks (5.5), fragile and
  // light-hitting, with a quick bite. A pack of 4–6 wears the Hero down by
  // surrounding them rather than bursting them. Set against the Skeleton's
  // numbers (T470); expected to move in playtesting.
  wockwolf: {
    name: "Wockwolf",
    resistances: { cold: 25 },
    life: 30,
    // Half a Skeleton's: a pack is worth more than one Skeleton, a single
    // Wockwolf is not.
    experience: 50,
    speed: 6,
    damage: [2, 5],
    // Easier to hit than a Skeleton.
    defense: 110,
    attackRating: 20,
    radius: 0.3,
    wanderRadius: 3,
    wanderSpeed: 0.35,
    wanderPauseMs: [800, 2500],
    aggroRadius: 8,
    replanMs: 300,
    needsSight: true,
    // Packs wake together.
    spreadRadius: 2.5,
    attack: { kind: "melee", reach: 1.1, reachGrace: 0.25, arcDegrees: 60 },
    windUpMs: 250,
    rootMs: 150,
    recoveryMs: 700,
    jitterMs: 300,
    maxAttackers: 0,
    leash: 16,
    returnSpeed: 1.2,
    graceMs: 2000,
    flinchChance: 0.25,
    flinchMs: 200,
    flinchInterrupts: false,
    // The Skeleton's rates, so it stays as fragile next to one in every Area.
    growth: {
      life: 0.25,
      damage: 0.2,
      attackRating: 0.1,
      defense: 0.15,
      experience: 3,
    },
  },
  // The outdoors' mortar: slow, fragile and far off, it lobs Muck at where the
  // Hero stands and waits a long while before the next. Moving is the dodge,
  // and reaching it the reward. Set against the Skeleton's numbers (T471);
  // expected to move in playtesting.
  bog_spitter: {
    name: "Bog Spitter",
    resistances: { fire: -50, lightning: 25 },
    // Muck is cold.
    damageTypes: { cold: 1 },
    life: 45,
    experience: 120,
    speed: 1.2,
    damage: [5, 9],
    defense: 110,
    attackRating: 25,
    radius: 0.35,
    wanderRadius: 1.5,
    wanderSpeed: 0.35,
    wanderPauseMs: [1500, 4500],
    // Further than its range, so it notices the Hero before they are in reach
    // of its Muck.
    aggroRadius: 9,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    // Muck flies at 4 tiles/s: from its furthest shot it takes 1.75 s to land,
    // time enough to step out of the 1-tile mark at a walk of 5.5.
    attack: {
      kind: "ranged",
      projectile: "muck",
      range: 7,
      projectileSpeed: 4,
      projectileRange: 7,
      lob: { radius: 1 },
    },
    windUpMs: 700,
    rootMs: 200,
    recoveryMs: 3000,
    jitterMs: 600,
    maxAttackers: 0,
    leash: 14,
    returnSpeed: 1.2,
    graceMs: 2000,
    // Hitting it often cancels the shot it's winding up, so reaching it pays.
    flinchChance: 0.5,
    flinchMs: 200,
    flinchInterrupts: true,
    // The Skeleton's rates.
    growth: {
      life: 0.25,
      damage: 0.2,
      attackRating: 0.1,
      defense: 0.15,
      experience: 3,
    },
  },
  // The outdoors' bruiser: big, slow and sturdy, its Slam hits everything of
  // the Hero's in a circle after a long wind-up that hitting it can't stop, so
  // stepping out is the only counter. Set against the Skeleton's numbers
  // (T472); expected to move in playtesting.
  wockbrute: {
    name: "Wockbrute",
    life: 300,
    // About 3.5 Skeletons' worth.
    experience: 350,
    speed: 1.2,
    damage: [10, 18],
    defense: 130,
    attackRating: 30,
    radius: 0.55,
    wanderRadius: 1.5,
    wanderSpeed: 0.35,
    wanderPauseMs: [2000, 5000],
    aggroRadius: 7,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    // It starts winding up with the Hero a body's width inside the circle.
    attack: {
      kind: "melee",
      reach: 1.6,
      reachGrace: 0,
      arcDegrees: 0,
      slam: { radius: 2 },
    },
    windUpMs: 1200,
    rootMs: 400,
    recoveryMs: 1600,
    jitterMs: 400,
    maxAttackers: 0,
    leash: 14,
    returnSpeed: 1.2,
    graceMs: 2000,
    // Hits never flinch it, so its Slam always comes.
    flinchChance: 0,
    flinchMs: 200,
    flinchInterrupts: false,
    // The Skeleton's rates.
    growth: {
      life: 0.25,
      damage: 0.2,
      attackRating: 0.1,
      defense: 0.15,
      experience: 3,
    },
  },
  // The Act 1 boss's type: slow and sturdy, with a heavy blow after a long
  // wind-up. What makes him a threat is the Skeletons he raises in waves
  // (`graveWockingtonTuning`). First tuning pass (T513).
  grave_wockington: {
    name: "Grave Wockington",
    resistances: { fire: 50 },
    life: 150,
    experience: 300,
    speed: 1.6,
    damage: [6, 12],
    defense: 120,
    attackRating: 30,
    radius: 0.45,
    wanderRadius: 1,
    wanderSpeed: 0.35,
    wanderPauseMs: [2000, 5000],
    aggroRadius: 9,
    replanMs: 400,
    needsSight: true,
    spreadRadius: 1.5,
    // Gravefire, lobbed at where the Hero stands, from a standstill; a target
    // within his reach gets his blow instead. First pass (T513).
    attack: {
      kind: "ranged",
      projectile: "gravefire",
      // Fire: the Hero's Fire Resistance pays off against the burn.
      damageTypes: { fire: 1 },
      range: 8,
      projectileSpeed: 5,
      projectileRange: 8,
      lob: {
        radius: 2.2,
        atHero: true,
        burn: { burnMs: 4000, tickMs: 500, damage: 0.2 },
      },
      melee: { reach: 1.5, reachGrace: 0.25, arcDegrees: 70 },
      recoveryMs: [2200, 1300],
    },
    windUpMs: 900,
    rootMs: 400,
    recoveryMs: 1500,
    jitterMs: 400,
    maxAttackers: 0,
    // From his spawn in the Ossuary this reaches every corner of his room (12
    // tiles at most) and stops short of the corridor's far end (15 tiles).
    leash: 13,
    returnSpeed: 1.2,
    graceMs: 2000,
    flinchChance: 0,
    flinchMs: 200,
    flinchInterrupts: false,
    growth: {
      life: 0.25,
      damage: 0.2,
      attackRating: 0.1,
      defense: 0.15,
      experience: 3,
    },
  },
};

/**
 * The share of a kill's Experience the Hero gains, by how many Levels the
 * Monster Level is below the Hero's Level: index 0 is a Monster at the Hero's
 * Level, 1 is one Level below, and so on. Further below than the last entry
 * gives the last entry. A Monster above the Hero's Level gives it all, with
 * no bonus.
 */
export const experienceDropOff: readonly number[] = [
  // Full Experience up to 5 Levels below...
  1, 1, 1, 1, 1, 1,
  // ...then a steep fall to 5% at 10 or more below.
  0.81, 0.62, 0.43, 0.24, 0.05,
];

export function isMonsterType(value: unknown): value is MonsterType {
  return typeof value === "string" && Object.hasOwn(monsterTuning, value);
}
