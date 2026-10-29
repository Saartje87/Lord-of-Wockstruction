/** What the query can switch on. */
export type DevOptions = {
  /** `?stats` shows fps, frame time, draw calls and triangles. */
  stats: boolean;
};

/**
 * The options in a query such as `?stats`. Only `devBuild`s, dev builds and
 * Vercel previews (see `GameCanvas`), honour `?stats`.
 */
export function devOptionsOf(search: string, devBuild: boolean): DevOptions {
  return { stats: devBuild && new URLSearchParams(search).has("stats") };
}
