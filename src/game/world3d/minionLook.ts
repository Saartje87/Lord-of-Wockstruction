import type { MinionType } from "../tuning/minions";
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
    // The two-handed slam lands later than the one-handed chop's 0.42.
    contact: 0.5,
    weapons: [],
  },
  // A Skeleton without its blade and shield: Raised Skeletons are many, and
  // each weapon is more draws.
  raisedSkeleton: {
    model: "Skeleton",
    scale: 0.36,
    height: 0.9,
    clips: { ...STANDING, attack: "1H_Melee_Attack_Chop" },
    contact: 0.42,
    look: "raised",
    weapons: [],
  },
};
