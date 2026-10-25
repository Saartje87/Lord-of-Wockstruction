/**
 * A tiny inline Town in Tiled's `.tmj` shape, until real `.tmj` files are
 * authored. Open floor until walls and pathing arrive. Isometric 64×32 tiles;
 * Tiled measures object positions in tileheight units.
 */
export const town = {
  orientation: "isometric",
  width: 12,
  height: 10,
  tilewidth: 64,
  tileheight: 32,
  layers: [
    {
      type: "tilelayer",
      name: "floor",
      width: 12,
      height: 10,
      data: new Array(12 * 10).fill(1),
    },
    {
      type: "objectgroup",
      name: "entries",
      objects: [{ name: "start", type: "entry", point: true, x: 176, y: 144 }],
    },
  ],
};
