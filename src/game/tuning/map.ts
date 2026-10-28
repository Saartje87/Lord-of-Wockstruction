/** Map tuning, in human units. */
export type MapTuning = {
  /**
   * How far the Hero sees for Explored (tiles): every tile whose centre lies
   * within this of them is revealed, walls or not. About the width of the
   * World on screen.
   */
  exploredRadius: number;
};

export const mapTuning: MapTuning = {
  exploredRadius: 6,
};
