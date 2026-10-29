/** What the query can switch on. */
export type DevOptions = {
  /** Which World is drawn: `?renderer=3d` draws the 3D World. */
  world: "2d" | "3d";
  /** `?stats` shows fps, frame time, draw calls and triangles. */
  stats: boolean;
};

/**
 * The options in a query such as `?renderer=3d&stats`. Every build honours
 * `?renderer=3d`; only `devBuild`s, dev builds and Vercel previews (see
 * `GameCanvas`), honour `?stats`.
 */
export function devOptionsOf(search: string, devBuild: boolean): DevOptions {
  const query = new URLSearchParams(search);
  return {
    world: query.get("renderer") === "3d" ? "3d" : "2d",
    stats: devBuild && query.has("stats"),
  };
}
