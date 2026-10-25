// PROTOTYPE (throwaway): HUD variants for ticket #86.
// Monster behaviour is pinned to the #82 verdict and the #83 numbers; only the HUD varies.
// Each variant disagrees about where the HUD lives (Pixi vs DOM) and what it shows.

export type MonsterConfig = {
  heroLife: number;
  monsterLife: number;
  monsterSpeed: number;
  wander: boolean;
  wanderRadius: number;
  aggroRadius: number;
  needsSight: boolean;
  spreadRadius: number;
  pathing: "direct" | "astar";
  reach: number;
  windUp: number;
  recovery: number;
  jitter: number;
  maxAttackers: number;
  leash: number;
  flinchChance: number;
  flinchTime: number;
  flinchInterrupts: boolean;
  heroFlinchChance: number;
  heroFlinchTime: number;
  shake: number;
  showRadii: boolean;
};

/** #82 "D2 pack" with the #83 numbers. */
export const MONSTERS: MonsterConfig = {
  heroLife: 100,
  monsterLife: 60,
  monsterSpeed: 2.8,
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
  shake: 0,
  showRadii: false,
};

export type HudConfig = {
  name: string;
  blurb: string;
  /** Who draws the screen-space HUD */
  layer: "pixi" | "dom" | "hybrid";
  /** Hero Life display */
  life: "orb" | "bar" | "ring";
  /** Monster Life bars over heads */
  monsterBars: "damaged" | "always" | "hover";
  /** Diablo-style name + Life plate at top-centre when hovering a Monster */
  nameplate: boolean;
  /** Pop-up damage numbers */
  numbers: "float" | "none" | "arc";
  /** How the 0.15 s, 30% red hit flash is drawn */
  flash: "fullscreen" | "vignette" | "tint";
  /** Look of the death screen */
  death: "classic" | "blackout" | "d2";
  /** Where the CC-BY-SA credits live */
  credits: "menu" | "corner" | "title";
};

export const VARIANTS = {
  A: {
    name: "Diablo orb, all Pixi",
    blurb:
      "Everything drawn in Pixi. Life orb bottom-left on a stone strip, with a crossed-swords badge while In Combat and a rising shimmer while regenerating. Monster bars once damaged, nameplate on hover, floating numbers, full-screen red flash, serif 'You died'. Credits in the Esc menu.",
    layer: "pixi",
    life: "orb",
    monsterBars: "damaged",
    nameplate: true,
    numbers: "float",
    flash: "fullscreen",
    death: "classic",
    credits: "menu",
  },
  B: {
    name: "Clean bar, DOM overlay",
    blurb:
      "Pixi draws only the world; the HUD is HTML over the canvas. Life bar top-left with numbers and a status pill (In Combat / Regenerating / Full). Thin bars on every Monster, no nameplate, no damage numbers. Edge vignette flash, black fade on death. Credits link always in the corner.",
    layer: "dom",
    life: "bar",
    monsterBars: "always",
    nameplate: false,
    numbers: "none",
    flash: "vignette",
    death: "blackout",
    credits: "corner",
  },
  C: {
    name: "Diegetic, hybrid",
    blurb:
      "No HUD chrome. Life is a ring at the Hero's feet in the world (pulses red In Combat, glints green while regenerating). Monster Life only on hover, as a DOM nameplate. Damage numbers arc out, sized by damage. Hit tints the Hero and the screen edge. Death greys out the world, D2-style text. Credits on a title card at start.",
    layer: "hybrid",
    life: "ring",
    monsterBars: "hover",
    nameplate: true,
    numbers: "arc",
    flash: "tint",
    death: "d2",
    credits: "title",
  },
} satisfies Record<string, HudConfig>;

export type VariantKey = keyof typeof VARIANTS;
export const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];
