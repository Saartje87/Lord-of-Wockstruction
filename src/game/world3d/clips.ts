/**
 * How far into KayKit's attack clips the weapon makes contact, as a fraction
 * of the clip (the Chop's downswing, from the weapon hand's speed along the clip). A swing is
 * scrubbed so this frame falls on the step its hit lands.
 */
export const ATTACK_CONTACT = 0.57;

/** The Hero's animations as the 3D World view names them. */
export type HeroClip = "idle" | "run" | "swing" | "cast" | "flinch" | "death";

/** The KayKit clip that plays each of the Hero's animations. */
export const HERO_CLIPS: Record<HeroClip, string> = {
  idle: "Idle",
  run: "Running_A",
  swing: "1H_Melee_Attack_Chop",
  cast: "Spellcast_Shoot",
  flinch: "Hit_A",
  death: "Death_A",
};
