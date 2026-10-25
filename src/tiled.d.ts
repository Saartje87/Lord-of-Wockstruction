// Tiled's `.tmj` maps and `.tsj` tilesets import as their raw JSON, which the
// Area loader checks.
declare module "*.tmj" {
  const content: unknown;
  export default content;
}

declare module "*.tsj" {
  const content: unknown;
  export default content;
}
