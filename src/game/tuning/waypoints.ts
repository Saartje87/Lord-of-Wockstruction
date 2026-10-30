/** Waypoint tuning, in human units. */
export type WaypointTuning = {
  /**
   * How near its centre the Hero walks onto a Waypoint (tiles). It is drawn
   * this wide.
   */
  radius: number;
  /**
   * How far from a Waypoint's centre the Hero arrives by travelling to it
   * (tiles): past `radius`, so arriving doesn't open the list again.
   */
  arriveDistance: number;
};

export const waypointTuning: WaypointTuning = {
  radius: 0.6,
  arriveDistance: 1.2,
};
