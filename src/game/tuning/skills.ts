import type { MinionType } from "./minions";
import type { ProjectileKind } from "./projectiles";

/** What every Skill has: where it sits in the Skill Tree and what it takes. */
type SkillBase = {
  /** Shown in the Skill Tree. */
  name: string;
  /** The Branch of the Skill Tree it belongs to. */
  branch: Branch;
  /**
   * The Skill before it in its Branch, which must have a Skill Level before
   * a Skill Point can go into this one; null for the first of a Branch.
   * It gates spending only, never casting.
   */
  prerequisite: Skill | null;
  /** The Hero's Level from which a Skill Point can be spent on it. */
  requiredLevel: number;
  /** The Synergies it gets: the Skills whose Skill Levels make it stronger. */
  synergies: Synergy[];
};

/** Skill tuning, in human units. The sim converts it to steps once. */
export type SkillTuning = CastSkillTuning | PassiveSkillTuning;

/** A Skill the Hero casts from the Skill Bar. */
export type CastSkillTuning = SkillBase & {
  /** The Mana a cast costs at Skill Level 1. */
  manaCost: number;
  /** The Mana cost added by each Skill Level past the first. */
  manaCostPerSkillLevel: number;
  /** How long a cast roots the Hero (ms). */
  castMs: number;
  /** What a cast does, as it starts. */
  effect: SkillEffect;
  passive?: undefined;
};

/**
 * A Passive Skill: never cast, costing no Mana, working for as long as it
 * has a Skill Level. It neither gives nor gets Synergies, so its
 * `synergies` stay empty.
 */
export type PassiveSkillTuning = SkillBase & {
  passive: PassiveEffect;
  manaCost?: undefined;
  castMs?: undefined;
  effect?: undefined;
};

/**
 * What a Passive Skill gives: each Skill Level it has multiplies the main
 * number of every Skill in `boosts` (and a boosted Curse's radius) by a
 * further `percentPerSkillLevel` percent of itself, as its own factor apart
 * from the Skill's Synergies.
 */
export type PassiveEffect = {
  boosts: CastSkill[];
  percentPerSkillLevel: number;
};

/**
 * What a Skill gets from each Skill Level the Hero has in `skill`, wherever
 * those came from and whether or not it is on the Skill Bar: its main
 * number grows by `percentPerSkillLevel` percent of itself.
 */
export type Synergy = {
  skill: CastSkill;
  percentPerSkillLevel: number;
};

/**
 * What a Skill's cast does: summon a Minion at the cast point, the Hero
 * having one of it; raise one from a Corpse (see `RaiseEffect`); burst a
 * Corpse (see `ExplodeEffect`); Curse Monsters (see `CurseEffect`); loose
 * a Projectile (see `ProjectileEffect`); put a Bone Ward on the Hero (see
 * `WardEffect`); raise a Bone Wall (see `WallEffect`); or loose a fan of
 * shards (see `VolleyEffect`).
 */
export type SkillEffect =
  | { type: "summon"; minion: MinionType }
  | RaiseEffect
  | ExplodeEffect
  | CurseEffect
  | ProjectileEffect
  | WardEffect
  | WallEffect
  | VolleyEffect;

/**
 * Raise a Minion from the Corpse nearest the cast point, using the Corpse
 * up. The Hero has up to `count` of it at Skill Level 1, and one more every
 * `countEvery` Skill Levels; raising one past that replaces the oldest.
 */
export type RaiseEffect = {
  type: "raise";
  minion: MinionType;
  count: number;
  countEvery: number;
};

/**
 * Burst the Corpse nearest the cast point, using it up. Every Monster within
 * `radius` of it, and `radiusPerSkillLevel` more each Skill Level past the
 * first (tiles), takes a roll of `share` (least and most) of the dead
 * Monster's max Life at its Monster Level.
 */
export type ExplodeEffect = {
  type: "explode";
  radius: number;
  radiusPerSkillLevel: number;
  share: [number, number];
};

/**
 * Curse every Monster within `radius` of the cast point, and
 * `radiusPerSkillLevel` more each Skill Level past the first (tiles), for
 * `durationMs`, and `durationMsPerSkillLevel` more each Skill Level past the
 * first. What the Curse does depends on its `kind`: a Monster with Amplify
 * Damage takes `damageTaken` times the damage; one with Weaken deals
 * `damageDealt` times the damage of its swings and Arrows; one with Leaden
 * Limbs walks at `walkSpeed` times its speed and attacks `attackSpeed` times
 * as often (Projectiles already loosed keep their speed); one with Dread is
 * Fleeing, with nothing more to tune than the Curse's own numbers.
 */
export type CurseEffect = {
  type: "curse";
  radius: number;
  radiusPerSkillLevel: number;
  durationMs: number;
  durationMsPerSkillLevel: number;
} & (
  | { kind: "amplifyDamage"; damageTaken: number }
  | { kind: "weaken"; damageDealt: number }
  | { kind: "leadenLimbs"; walkSpeed: number; attackSpeed: number }
  | { kind: "dread" }
);

/**
 * Loose a `projectile` from the Hero toward the cast point, flying `speed`
 * (tiles per second) until a wall or `range` (tiles). Every Monster it
 * touches takes a roll of `damage`, each end `damagePerSkillLevel` more each
 * Skill Level past the first.
 */
export type ProjectileEffect = {
  type: "projectile";
  projectile: ProjectileKind;
  speed: number;
  range: number;
  damage: [number, number];
  damagePerSkillLevel: number;
};

/**
 * Put a Bone Ward on the Hero soaking up `amount` damage, and
 * `amountPerSkillLevel` more each Skill Level past the first, filling an
 * existing one back up to that instead of adding to it.
 */
export type WardEffect = {
  type: "ward";
  amount: number;
  amountPerSkillLevel: number;
};

/**
 * Raise a Bone Wall: a line of `length` tiles across the way the Hero faces
 * the cast point, centred on it, of bone Props with Life (`pieceLife` each,
 * one to a tile) that stand for `durationMs` unless broken. No one can walk
 * through it, and a Monster's Projectile stops at it, but the Hero's fly
 * through. A tile it would stand on that is not floor to walk, or that a
 * Body is standing in, gets no piece.
 */
export type WallEffect = {
  type: "wall";
  length: number;
  pieceLife: number;
  durationMs: number;
};

/**
 * Loose `shards` of a `projectile` from the Hero in a fan `spreadDegrees`
 * wide (first to last), centred on the line to the cast point. Each is an
 * ordinary Hero Projectile: it flies `speed` (tiles per second) until a wall
 * or `range` (tiles), hitting each Monster it touches once for a roll of
 * `damage`, each end `damagePerSkillLevel` more each Skill Level past the
 * first, so several can hit one Monster up close.
 */
export type VolleyEffect = {
  type: "volley";
  projectile: ProjectileKind;
  shards: number;
  spreadDegrees: number;
  speed: number;
  range: number;
  damage: [number, number];
  damagePerSkillLevel: number;
};

/** Skills that use a Corpse up. */
export const corpseTuning = {
  /** How near the cast point a Corpse must lie to be used (tiles). */
  reach: 2,
};

/** A themed group of Skills in the Skill Tree. */
export type Branch = "bone" | "summoning" | "curses";

/** The Branches in the order the Skill Tree shows them. */
export const BRANCHES: Branch[] = ["bone", "summoning", "curses"];

/**
 * What the Skill Tree makes room for in each Branch: its name and how many
 * Skills it is built to hold (Bone 6, Summoning 4, Curses 5).
 */
export const branchTuning: Record<Branch, { name: string; room: number }> = {
  bone: { name: "Bone", room: 6 },
  summoning: { name: "Summoning", room: 4 },
  curses: { name: "Curses", room: 5 },
};

/** One of the Skills, by the name the sim and the Save know it by. */
export type Skill =
  | "golem"
  | "raiseSkeleton"
  | "amplifyDamage"
  | "weaken"
  | "leadenLimbs"
  | "dread"
  | "boneWard"
  | "corpseExplosion"
  | "boneSpear"
  | "boneWall"
  | "splinterVolley"
  | "raiseArcher"
  | "ossifiedWill"
  | "graveCommand"
  | "lingeringMalice";

/** The Passive Skills: one at the end of each Branch. */
export const PASSIVE_SKILLS = [
  "ossifiedWill",
  "graveCommand",
  "lingeringMalice",
] as const;

/** One of the Passive Skills. */
export type PassiveSkill = (typeof PASSIVE_SKILLS)[number];

/** One of the Skills the Hero casts. */
export type CastSkill = Exclude<Skill, PassiveSkill>;

/** Whether `skill` is a Passive Skill. */
export function isPassive(skill: Skill): skill is PassiveSkill {
  return (PASSIVE_SKILLS as readonly Skill[]).includes(skill);
}

/** The tuning of a Skill the Hero casts. */
export function castTuning(skill: CastSkill): CastSkillTuning {
  return skillTuning[skill];
}

/**
 * Every Skill's tuning. Each cast roots the Hero 400 ms, a touch longer than
 * the Hero's 350 ms swing, so casting and fighting keep about the same pace.
 * Mana costs are Diablo 2's: playtests in the Crypt and Ossuary found that
 * Mana, not damage, paces a Necromancer's fights (a Level 6 Hero with the
 * starting Energy has 45, six Bone Spears).
 * Synergies are percent of the receiving Skill's main number per Skill Level
 * of the giver; Diablo 2's run 5 to 20, and these sit at the low end, as
 * every Skill has a giver or two to raise. The yardstick is a Skill Point in
 * the receiver itself: a Bone Spear's own 8 damage is 7% of it at Skill
 * Level 5, so a 7% Synergy makes a Skill Point in the giver worth about one
 * in the Spear, not a trap and not a must-have. Curses have no such
 * yardstick (their own growth, 2 to 3 s a Skill Level, dwarfs a Synergy's)
 * and sit a little higher, at 10%. A Hero has a Skill Point a Level and a
 * Quest's, about 11 at the end of Act 1 (Hero Level 11, Ossuary), against
 * 12 cast Skills to open, so Synergies are what a Hero raises once a
 * Branch is open, not what they open it for. Passive Skills open at Level
 * 12, the first Level past Act 1's Monsters, and are tuned for Acts after.
 * The numbers to check them against: `npm run tuning:report`.
 */
export const skillTuning: Record<CastSkill, CastSkillTuning> &
  Record<PassiveSkill, PassiveSkillTuning> = {
  // Diablo 2's Clay Golem. One Minion of 180 Life, three Raised Skeletons'
  // worth, for 15 Mana (a Level 6 Hero has 45, three Golems), where the
  // Skeletons cost 6 for two but need Corpses. Bone Ward's 8% Synergy: a
  // Golem at Skill Level 5 (324 Life) gains 26 Life from each of its points.
  golem: {
    name: "Golem",
    branch: "summoning",
    prerequisite: "raiseSkeleton",
    requiredLevel: 1,
    manaCost: 15,
    manaCostPerSkillLevel: 2,
    castMs: 400,
    effect: { type: "summon", minion: "golem" },
    synergies: [{ skill: "boneWard", percentPerSkillLevel: 8 }],
  },
  // Diablo 2's Raise Skeleton, and its Mana: 2 at Skill Level 1, one more at
  // 4, 7, 10 … A Raised Skeleton is a Monster Level 1 Skeleton grown 20% a
  // Skill Level, so given a Skill Point a Level it stays a little behind the
  // Skeletons of the Crypt and Ossuary (see `minionTuning`). Its Synergies, 8%
  // each from Golem and Raise Archer, are its Summoning mates': at Skill Level
  // 5 (108 Life) each Skill Level in a giver adds 9 Life, about what one of
  // its own adds (12 Life and damage).
  raiseSkeleton: {
    name: "Raise Skeleton",
    branch: "summoning",
    prerequisite: null,
    requiredLevel: 1,
    manaCost: 6,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "raise",
      minion: "raisedSkeleton",
      count: 2,
      countEvery: 3,
    },
    synergies: [
      { skill: "golem", percentPerSkillLevel: 8 },
      { skill: "raiseArcher", percentPerSkillLevel: 8 },
    ],
  },
  // Diablo 2's Amplify Damage: its Mana, 8 seconds and 3 more each Skill
  // Level. It gives Weaken and Corpse Explosion a Synergy and gets none, being
  // the Branch's first. Its +100% damage taken there is softened to +50%, so a Cursed
  // own-Level Skeleton still takes two Bone Spears, rarely one. Its
  // radius at Skill Level 1 takes in a whole pack still standing at its
  // spawn, within a tile of it.
  amplifyDamage: {
    name: "Amplify Damage",
    branch: "curses",
    prerequisite: null,
    requiredLevel: 2,
    manaCost: 4,
    manaCostPerSkillLevel: 0,
    castMs: 400,
    effect: {
      type: "curse",
      kind: "amplifyDamage",
      radius: 2,
      radiusPerSkillLevel: 0.5,
      durationMs: 8000,
      durationMsPerSkillLevel: 3000,
      damageTaken: 1.5,
    },
    synergies: [],
  },
  // Diablo 2's Weaken (its -33% damage dealt rising to -40%), with Amplify
  // Damage's radius and a little less of its duration: a Weakened
  // own-Level Skeleton's swings fall from 6-13 to 4-8, an Archer's Arrows
  // from 3-6 to 2-4, enough to tell in a pack without making it harmless.
  weaken: {
    name: "Weaken",
    branch: "curses",
    prerequisite: "amplifyDamage",
    requiredLevel: 5,
    manaCost: 7,
    manaCostPerSkillLevel: 0,
    castMs: 400,
    effect: {
      type: "curse",
      kind: "weaken",
      radius: 2,
      radiusPerSkillLevel: 0.5,
      durationMs: 8000,
      durationMsPerSkillLevel: 2000,
      damageDealt: 0.6,
    },
    // 10%: Weaken's own 2 s a Skill Level is 12% of a Skill Level 5 Curse, so a
    // Synergy of 10% from Amplify Damage is about a Skill Point's worth.
    synergies: [{ skill: "amplifyDamage", percentPerSkillLevel: 10 }],
  },
  // Diablo 2's Decrepify, in spirit: a Cursed Monster walks at 60% of its
  // speed (an Archer's kiting and a Skeleton's closing both drag) and swings
  // or shoots at 60% as often, a little shorter than Weaken's duration so the
  // two Curses trade off rather than stack.
  leadenLimbs: {
    name: "Leaden Limbs",
    branch: "curses",
    prerequisite: "weaken",
    requiredLevel: 8,
    manaCost: 9,
    manaCostPerSkillLevel: 0,
    castMs: 400,
    effect: {
      type: "curse",
      kind: "leadenLimbs",
      radius: 2,
      radiusPerSkillLevel: 0.5,
      durationMs: 7000,
      durationMsPerSkillLevel: 2000,
      walkSpeed: 0.6,
      attackSpeed: 0.6,
    },
    // 10%, as Weaken's: its own 2 s a Skill Level is 13% of a Skill Level 5 Curse.
    synergies: [{ skill: "weaken", percentPerSkillLevel: 10 }],
  },
  // Diablo 2's Terror, in spirit: a Cursed Monster runs from the Hero for
  // 5 s, a little shorter than Leaden Limbs so a pack comes back before the
  // Hero can tire of waiting; it grows a second and a half each Skill Level.
  // Level 10, the Level before Act 1's Ossuary (11): a Hero with the points
  // for it has chosen Curses over a Bone Skill or two.
  dread: {
    name: "Dread",
    branch: "curses",
    prerequisite: "leadenLimbs",
    requiredLevel: 10,
    manaCost: 11,
    manaCostPerSkillLevel: 0,
    castMs: 400,
    effect: {
      type: "curse",
      kind: "dread",
      radius: 2,
      radiusPerSkillLevel: 0.5,
      durationMs: 5000,
      durationMsPerSkillLevel: 1500,
    },
    // 10%, as the other Curses: its own 1.5 s is 14% of a Skill Level 5 Curse.
    synergies: [{ skill: "leadenLimbs", percentPerSkillLevel: 10 }],
  },
  // Diablo 2's Bone Armor, and its Mana, scaled by starting Life (a Diablo 2
  // Necromancer's 45 to the Hero's 100): 45 soaks about five swings of a
  // Crypt Skeleton (6–13), and 15 more each Skill Level keeps it ahead of
  // Monster damage, as Diablo 2's 10 does.
  boneWard: {
    name: "Bone Ward",
    branch: "bone",
    prerequisite: null,
    requiredLevel: 3,
    manaCost: 11,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: { type: "ward", amount: 45, amountPerSkillLevel: 15 },
    // 6%, a little under the others: the Ward's own 15 a Skill Level is 14% of
    // a Skill Level 5 soak, and Golem's 8% already draws on it.
    synergies: [{ skill: "boneWall", percentPerSkillLevel: 6 }],
  },
  // Diablo 2's Corpse Explosion bursts for 60–100% of the dead Monster's
  // max Life, which kills its like in one cast, so it's softened to 40–70%:
  // an own-Level Skeleton's Corpse kills another in two casts, now and then
  // three, at any Level. Mana and radius are Diablo 2's.
  corpseExplosion: {
    name: "Corpse Explosion",
    branch: "bone",
    prerequisite: "boneWard",
    requiredLevel: 4,
    manaCost: 15,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "explode",
      radius: 2,
      radiusPerSkillLevel: 0.25,
      share: [0.4, 0.7],
    },
    // 7%: Corpse Explosion's own Skill Levels grow only its radius (a quarter
    // tile) and Mana, so its burst grows by Synergy and Passive alone.
    synergies: [{ skill: "amplifyDamage", percentPerSkillLevel: 7 }],
  },
  // Diablo 2's Bone Spear's 16–24 scaled to the game's Life: a Level 6 Hero
  // kills an own-Level Skeleton (135 Life) in two casts, now and then three.
  // Its growth stays Diablo 2's 8, about half the 15 Life a Skeleton gains
  // each Monster Level, so two casts keep up. Diablo 2's Mana; its range
  // outreaches a Skeleton's 7-tile notice.
  boneSpear: {
    name: "Bone Spear",
    branch: "bone",
    prerequisite: "corpseExplosion",
    requiredLevel: 6,
    manaCost: 7,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "projectile",
      projectile: "boneSpear",
      speed: 15,
      range: 12,
      damage: [60, 90],
      damagePerSkillLevel: 8,
    },
    // 7% each: the Spear's own 8 damage is 7% of a Skill Level 5 Spear, so a
    // Skill Point in Bone Wall or Splinter Volley is worth one in the Spear.
    synergies: [
      { skill: "boneWall", percentPerSkillLevel: 7 },
      { skill: "splinterVolley", percentPerSkillLevel: 7 },
    ],
  },
  // Three tiles hold a corridor's mouth or cover the Hero from a pack's front.
  // A Skeleton of the Crypt or Ossuary (swinging about every 2 s for 10-24)
  // breaks a 60 Life piece in three or four swings, so a Wall buys six or
  // seven seconds, and it crumbles on its own after 10 s so it can't close an
  // Area off for good. Level 8: two Levels past Bone Spear's 6. Its Skill
  // Levels grow nothing of its own, so they cost no more Mana: a Skill Point
  // in it is for the Bone Spear and Bone Ward Synergies, and costs nothing
  // else.
  boneWall: {
    name: "Bone Wall",
    branch: "bone",
    prerequisite: "boneSpear",
    requiredLevel: 8,
    manaCost: 14,
    manaCostPerSkillLevel: 0,
    castMs: 400,
    effect: { type: "wall", length: 3, pieceLife: 60, durationMs: 10000 },
    synergies: [],
  },
  // Diablo 2's Bone Spirit, in spirit, as a scatter: five splinters over 40
  // degrees, each about a fifth of a Bone Spear's punch, so at point-blank a
  // few land on one Monster and far off the fan thins to one or two. Short
  // range: it is the close-quarters Skill, Bone Spear being the reach one.
  // 20-30 a shard: a Spear is 75 for 7 Mana, a full fan at point-blank is 125
  // for 12, so it matches the Spear's damage per Mana only up close and falls
  // behind as shards miss (two hit: four casts for an Ossuary Skeleton's 210
  // Life). Its 3 a shard each Skill Level is 12% of a Skill Level 5 shard,
  // growing as fast as the Spear. Level 10, two past Bone Wall's.
  splinterVolley: {
    name: "Splinter Volley",
    branch: "bone",
    prerequisite: "boneWall",
    requiredLevel: 10,
    manaCost: 12,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "volley",
      projectile: "splinter",
      shards: 5,
      spreadDegrees: 40,
      speed: 14,
      range: 8,
      damage: [20, 30],
      damagePerSkillLevel: 3,
    },
    // 7% each, as Bone Spear's Synergies; Raise Archer's is the one bridge
    // from Summoning into Bone.
    synergies: [
      { skill: "boneSpear", percentPerSkillLevel: 7 },
      { skill: "raiseArcher", percentPerSkillLevel: 7 },
    ],
  },
  // Raise Skeleton's rules for a Minion that shoots instead of swinging: as
  // many at once, from a Corpse each, and a little more Mana for the reach.
  // Level 6 keeps it within SKILLS.length + 1 and after Golem's Level 1. An
  // Archer has 36 Life against a Skeleton's 60 and shoots for 3-6 from range,
  // so it trades Life for reach, and Mana is 2 more than Raise Skeleton's.
  raiseArcher: {
    name: "Raise Archer",
    branch: "summoning",
    prerequisite: "golem",
    requiredLevel: 6,
    manaCost: 8,
    manaCostPerSkillLevel: 1,
    castMs: 400,
    effect: {
      type: "raise",
      minion: "raisedArcher",
      count: 2,
      countEvery: 3,
    },
    // 8% from Raise Skeleton, as its own from Raise Archer; 7% from Splinter
    // Volley, as the Volley's from it.
    synergies: [
      { skill: "raiseSkeleton", percentPerSkillLevel: 8 },
      { skill: "splinterVolley", percentPerSkillLevel: 7 },
    ],
  },
  // Diablo 2's Skeleton Mastery, in spirit: Bone Branch's damage and soak.
  // Splinter Volley's Level 10 is the Branch's last, so the Passive sits a
  // little past it, within SKILLS.length + 1. 6% a Skill Level on each of
  // four Skills: a Hero uses two or three of them, so a Skill Point here is
  // worth 12 to 18% in all against 6 to 7% for one in the Spear alone, but it
  // costs Level 12 and five Prerequisites first, which an Act 1 Hero's 11
  // points can't reach alongside a Branch, so it never competes there.
  ossifiedWill: {
    name: "Ossified Will",
    branch: "bone",
    prerequisite: "splinterVolley",
    requiredLevel: 12,
    passive: {
      boosts: ["boneWard", "corpseExplosion", "boneSpear", "splinterVolley"],
      percentPerSkillLevel: 6,
    },
    synergies: [],
  },
  // Diablo 2's Skeleton Mastery for all Minions: Life and damage together,
  // so 6% a Skill Level is a Minion 6% tougher and 6% stronger, about what a
  // Skill Level 5 Raise Skeleton's own 11% a Skill Level is, spread over
  // three Skills as Ossified Will's is over four.
  graveCommand: {
    name: "Grave Command",
    branch: "summoning",
    prerequisite: "raiseArcher",
    requiredLevel: 12,
    passive: {
      boosts: ["golem", "raiseSkeleton", "raiseArcher"],
      percentPerSkillLevel: 6,
    },
    synergies: [],
  },
  // Curses that last longer and reach further: one percent for both, so 8% a
  // Skill Level is a Curse 8% longer and 8% wider. Higher than the other
  // Passives' 6%, as a Curse's duration and radius only matter near their
  // thresholds (a pack outside the radius is left alone), so some of a Skill
  // Point's bonus is not felt.
  lingeringMalice: {
    name: "Lingering Malice",
    branch: "curses",
    prerequisite: "dread",
    requiredLevel: 12,
    passive: {
      boosts: ["amplifyDamage", "weaken", "leadenLimbs", "dread"],
      percentPerSkillLevel: 8,
    },
    synergies: [],
  },
};

/**
 * Each Branch's Skills in Prerequisite order, the first having none and
 * each next one having the one before it.
 */
export const branchSkills = Object.fromEntries(
  BRANCHES.map((branch) => {
    const inBranch = (Object.keys(skillTuning) as Skill[]).filter(
      (skill) => skillTuning[skill].branch === branch,
    );
    const ordered: Skill[] = [];
    let next = inBranch.find((skill) => !skillTuning[skill].prerequisite);
    while (next) {
      ordered.push(next);
      const after: Skill | undefined = inBranch.find(
        (skill) => skillTuning[skill].prerequisite === next,
      );
      next = after;
    }
    return [branch, ordered];
  }),
) as Record<Branch, Skill[]>;
