import type { MinionType } from "../tuning/minions";
import { ATTACK_CONTACT } from "./clips";
import { type MonsterLook, STANDING } from "./monsterLook";

/** What each Minion type looks like. */
export const MINION_LOOKS: Record<MinionType, MonsterLook> = {
  // The Monstrosity, bare-fisted: its slam is the 2H chop retargeted onto
  // its rig by `import:kaykit`.
  golem: {
    model: "Monstrosity",
    scale: 0.32,
    height: 1.35,
    clips: {
      idle: "Idle_A",
      walk: "Walking_A",
      run: "Running_A",
      flinch: "Hit_A",
      death: "Death_A",
      attack: "2H_Melee_Attack_Chop",
    },
    // The two-handed slam stops dead at about 0.55 of its clip.
    contact: 0.55,
    weapons: [],
  },
  // A Skeleton without its blade and shield: Raised Skeletons are many, and
  // each weapon is more draws.
  raisedSkeleton: {
    model: "Skeleton",
    scale: 0.36,
    height: 0.9,
    clips: { ...STANDING, attack: "1H_Melee_Attack_Chop" },
    contact: ATTACK_CONTACT,
    look: "raised",
    weapons: [],
  },
  // The Skeleton Archer's rig and crossbow shot, in the raised look.
  raisedArcher: {
    model: "SkeletonArcher",
    scale: 0.36,
    height: 0.9,
    clips: { ...STANDING, attack: "2H_Ranged_Shoot" },
    contact: 0.3,
    look: "raised",
    weapons: [{ slot: "handslot.r", model: "Skeleton_Crossbow" }],
  },
  // The Skeleton_Mage with its staff, at Minion size: it casts its Frost Bolt
  // with a Spellcast clip, in a frosty pale-blue look.
  raisedMage: {
    model: "Skeleton_Mage",
    scale: 0.36,
    height: 0.9,
    clips: {
      ...STANDING,
      attack: "1H_Melee_Attack_Chop",
      lob: "Spellcast_Shoot",
    },
    contact: ATTACK_CONTACT,
    lobContact: 0.35,
    look: "frost",
    weapons: [{ slot: "handslot.r", model: "Skeleton_Staff" }],
  },
};
