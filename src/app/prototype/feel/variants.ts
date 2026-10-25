// PROTOTYPE (throwaway): movement + melee feel variants for ticket #77.
// Each variant disagrees about the movement model, input model and attack model,
// not just the numbers. Knobs in the panel override the numbers live.

export type FeelConfig = {
  name: string;
  blurb: string;
  /** tile: walk tile centre to tile centre. free: walk straight lines anywhere. */
  moveMode: "tile" | "free";
  /** click: one click sets a destination. hold: holding the mouse keeps steering. */
  input: "click" | "hold";
  /** 8: sprite-style 8 direction facing. free: any angle. */
  facing: "8" | "free";
  /** tiles per second */
  speed: number;
  /** seconds for one full swing */
  attackTime: number;
  /** 0..1, moment within the swing the hit lands */
  hitFrac: number;
  /** melee reach in tiles */
  range: number;
  /** tiles a Monster is pushed on hit */
  knockback: number;
  /** ms the simulation freezes on hit */
  hitstopMs: number;
  /** px of camera shake on hit */
  shake: number;
  /** clicks during a swing are queued and run after it */
  buffer: boolean;
  /** a move order cancels the swing once the hit has landed */
  cancelAfterHit: boolean;
  /** holding the mouse on a Monster keeps swinging */
  repeatWhileHeld: boolean;
};

export const VARIANTS = {
  A: {
    name: "D1 classic",
    blurb:
      "Tile-locked steps, one click = one order, swings fully commit. Deliberate.",
    moveMode: "tile",
    input: "click",
    facing: "8",
    speed: 3,
    attackTime: 0.6,
    hitFrac: 0.6,
    range: 1.5,
    knockback: 0,
    hitstopMs: 0,
    shake: 0,
    buffer: false,
    cancelAfterHit: false,
    repeatWhileHeld: true,
  },
  B: {
    name: "D2 fluid",
    blurb:
      "Free movement, hold mouse to steer, Shift = swing in place, small flinch.",
    moveMode: "free",
    input: "hold",
    facing: "8",
    speed: 4.5,
    attackTime: 0.5,
    hitFrac: 0.5,
    range: 1.2,
    knockback: 0.15,
    hitstopMs: 0,
    shake: 0,
    buffer: false,
    cancelAfterHit: false,
    repeatWhileHeld: true,
  },
  C: {
    name: "Modern snappy",
    blurb:
      "Free-angle facing, buffered clicks, move cancels after hit, hitstop + shake + knockback.",
    moveMode: "free",
    input: "hold",
    facing: "free",
    speed: 5.5,
    attackTime: 0.35,
    hitFrac: 0.4,
    range: 1.3,
    knockback: 0.5,
    hitstopMs: 60,
    shake: 6,
    buffer: true,
    cancelAfterHit: true,
    repeatWhileHeld: true,
  },
} satisfies Record<string, FeelConfig>;

export type VariantKey = keyof typeof VARIANTS;
export const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];
