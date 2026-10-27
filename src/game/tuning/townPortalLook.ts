/**
 * How a Town Portal looks, in human units: an upright swirling green oval
 * drawn procedurally in square pixels, with sparks and a glow on the floor.
 * Both ends look the same.
 */
export type TownPortalLookTuning = {
  /** How long it takes to burst open from a point into its oval (ms). */
  openMs: number;
  /**
   * How far past its full size it springs while bursting open, as a share of
   * that size: the splash.
   */
  overshoot: number;
  /** How long it takes to shrink away to nothing on closing (ms). */
  closeMs: number;
  /** How wide the oval is (tiles across the screen). */
  width: number;
  /** How many times as tall as wide the oval is. */
  tallness: number;
  /** How big one of its square pixels is at native scale (CSS px). */
  pixel: number;
  colours: {
    /** The dark green edge of the oval. */
    rim: number;
    /** The swirl's dark and bright bands. */
    dark: number;
    bright: number;
    /** The lighter core at its middle. */
    core: number;
    spark: number;
    glow: number;
    /** The screen's flash on going through. */
    flash: number;
  };
  /** How many arms the spiral swirl has. */
  arms: number;
  /** How far the arms wind from the rim to the middle (turns). */
  twist: number;
  /** How fast the swirl turns (turns per second). */
  swirlTurnsPerSecond: number;
  /** How much of the oval the lighter core spans (0..1 of its size). */
  coreSize: number;
  /** How fast it pulses, and how much bigger it gets at a pulse's top. */
  pulsesPerSecond: number;
  pulse: number;
  /** How many sparks are in the air at once. */
  sparks: number;
  /** How big a spark's square is at native scale (CSS px). */
  sparkSize: number;
  /** How far from the rim a spark gets before it is gone (tiles). */
  sparkReach: number;
  /** How long a spark flies (ms). */
  sparkMs: number;
  /** How many sparks the splash flings out while it bursts open. */
  splashSparks: number;
  /** How far the green glow spreads on the floor around it (tiles). */
  glowRadius: number;
  /** How opaque the glow is at its middle (0..1). */
  glowAlpha: number;
  /**
   * How long going through takes (ms): a green flash, at its brightest when
   * the Areas swap halfway, instead of an Exit's fade to black.
   */
  flashMs: number;
};

export const townPortalLook: TownPortalLookTuning = {
  openMs: 450,
  overshoot: 0.25,
  closeMs: 350,
  width: 0.6,
  tallness: 1.6,
  pixel: 4,
  colours: {
    rim: 0x1d7a2c,
    dark: 0x2fc045,
    bright: 0x7dff6a,
    core: 0xdcffc8,
    spark: 0xb4ff8c,
    glow: 0x3fe060,
    flash: 0xa8ff90,
  },
  arms: 3,
  twist: 0.9,
  swirlTurnsPerSecond: 0.5,
  coreSize: 0.3,
  pulsesPerSecond: 1.2,
  pulse: 0.05,
  sparks: 12,
  sparkSize: 6,
  sparkReach: 0.45,
  sparkMs: 700,
  splashSparks: 16,
  glowRadius: 0.9,
  glowAlpha: 0.35,
  flashMs: 350,
};
