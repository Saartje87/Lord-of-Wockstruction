/**
 * A tiny inline Town in Tiled's `.tmj` shape, until real `.tmj` files are authored.
 * Isometric 64×32 tiles; Tiled measures object positions in tileheight units.
 */
export const town = {
  orientation: "isometric",
  width: 8,
  height: 6,
  tilewidth: 64,
  tileheight: 32,
  layers: [
    {
      type: "tilelayer",
      name: "floor",
      width: 8,
      height: 6,
      // biome-ignore format: keep the grid readable
      data: [
        0, 1, 1, 1, 1, 1, 1, 0,
        1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 0, 0, 1, 1,
        1, 1, 1, 1, 0, 1, 1, 1,
        0, 1, 1, 1, 1, 1, 1, 0,
      ],
    },
    {
      type: "objectgroup",
      name: "entries",
      objects: [{ name: "start", type: "entry", point: true, x: 80, y: 80 }],
    },
  ],
};
