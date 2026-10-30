import type { MinionType } from "./minions";
import type { ProjectileKind } from "./projectiles";

/** Skill tuning, in human units. The sim converts it to steps once. */
export type SkillTuning = {
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
  /** The Mana a cast costs at Skill Level 1. */
  manaCost: number;
  /** The Mana cost added by each Skill Level past the first. */
  manaCostPerSkillLevel: number;
  /** How long a cast roots the Hero (ms). */
  castMs: number;
  /** What a cast does, as it starts. */
  effect: SkillEffect;
};

/**
 * What a Skill's cast does: summon a Minion at the cast point, the Hero
 * having one of it; raise one from a Corpse (see `RaiseEffect`); burst a
 * Corpse (see `ExplodeEffect`); Curse Monsters (see `CurseEffect`); loose
 * a Projectile (see `ProjectileEffect`); or put a Bone Ward on the Hero (see
 * `WardEffect`).
 */
export type SkillEffect =
  | { type: "summon"; minion: MinionType }
  | RaiseEffect
  | ExplodeEffect
  | CurseEffect
  | ProjectileEffect
  | WardEffect;

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
 * first. A Cursed Monster takes `damageTaken` times the damage.
 */
export type CurseEffect = {
  type: "curse";
  radius: number;
  radiusPerSkillLevel: number;
  durationMs: number;
  durationMsPerSkillLevel: number;
  damageTaken: number;
};

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
  | "boneWard"
  | "corpseExplosion"
  | "boneSpear";

/**
 * Every Skill's tuning. Each cast roots the Hero 400 ms, a touch longer than
 * the Hero's 350 ms swing, so casting and fighting keep about the same pace.
 * Mana costs are Diablo 2's: playtests in the Crypt and Ossuary found that
 * Mana, not damage, paces a Necromancer's fights (a Level 6 Hero with the
 * starting Energy has 45, six Bone Spears).
 */
export const skillTuning: Record<Skill, SkillTuning> = {
  // Diablo 2's Clay Golem.
  golem: {
    name: "Golem",
    branch: "summoning",
    prerequisite: "raiseSkeleton",
    requiredLevel: 1,
    manaCost: 15,
    manaCostPerSkillLevel: 2,
    castMs: 400,
    effect: { type: "summon", minion: "golem" },
  },
  // Diablo 2's Raise Skeleton, and its Mana: 2 at Skill Level 1, one more at
  // 4, 7, 10 … A Raised Skeleton is a Monster Level 1 Skeleton grown 20% a
  // Skill Level, so given a Skill Point a Level it stays a little behind the
  // Skeletons of the Crypt and Ossuary (see `minionTuning`).
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
  },
  // Diablo 2's Amplify Damage: its Mana, 8 seconds and 3 more each Skill
  // Level. Its +100% damage taken there is softened to +50%, so a Cursed
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
      radius: 2,
      radiusPerSkillLevel: 0.5,
      durationMs: 8000,
      durationMsPerSkillLevel: 3000,
      damageTaken: 1.5,
    },
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
