/** Town Portal tuning, in human units. The sim converts it to steps once. */
export type TownPortalTuning = {
  /** How long opening one roots the Hero, as a cast does (ms). */
  openingMs: number;
  /** How far ahead of the Hero it opens, centre to centre (tiles). */
  openDistance: number;
  /**
   * How near its centre the Hero walks into it (tiles). It is drawn this
   * wide.
   */
  radius: number;
  /**
   * How far from the other end's centre the Hero arrives (tiles): past
   * `radius`, so they don't walk straight back through.
   */
  arriveDistance: number;
};

export const townPortalTuning: TownPortalTuning = {
  openingMs: 500,
  openDistance: 1,
  radius: 0.4,
  arriveDistance: 1,
};
