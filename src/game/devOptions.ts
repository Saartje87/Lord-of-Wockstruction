/** What a dev build can switch on from the query. */
export type DevOptions = {
  /** Which World is drawn: `?renderer=3d` draws the 3D World. */
  world: "2d" | "3d";
  /** `?stats` shows fps, frame time, draw calls and triangles. */
  stats: boolean;
};

/**
 * The dev options in a query such as `?renderer=3d&stats`. Only `devBuild`s
 * honour them, dev builds and Vercel previews (see `GameCanvas`); others get
 * the 2D World and no stats.
 */
export function devOptionsOf(search: string, devBuild: boolean): DevOptions {
  if (!devBuild) return { world: "2d", stats: false };
  const query = new URLSearchParams(search);
  return {
    world: query.get("renderer") === "3d" ? "3d" : "2d",
    stats: query.has("stats"),
  };
}
