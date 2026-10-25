const WIDTH = 12;
const HEIGHT = 10;
const FLOOR = 1;
const WALL = 2;

// An L of wall north-east of `start` and a short one to its south-west, to
// walk around.
const walls = new Array(WIDTH * HEIGHT).fill(0);
for (let x = 3; x <= 8; x++) walls[2 * WIDTH + x] = WALL;
for (let y = 3; y <= 5; y++) walls[y * WIDTH + 8] = WALL;
for (let x = 2; x <= 5; x++) walls[7 * WIDTH + x] = WALL;

/** A `monsterSpawn` of `count` Skeletons at a point in tile units. */
function skeletons(x: number, y: number, count: number) {
  return {
    name: "",
    type: "monsterSpawn",
    point: true,
    x: x * 32,
    y: y * 32,
    properties: [
      { name: "monster", type: "string", value: "skeleton" },
      { name: "count", type: "int", value: count },
    ],
  };
}

/**
 * A tiny inline Town in Tiled's `.tmj` shape, until real `.tmj` files are
 * authored. Isometric 64×32 tiles; Tiled measures object positions in
 * tileheight units.
 */
export const town = {
  orientation: "isometric",
  width: WIDTH,
  height: HEIGHT,
  tilewidth: 64,
  tileheight: 32,
  tilesets: [
    {
      firstgid: FLOOR,
      name: "placeholder",
      tiles: [
        {
          id: WALL - FLOOR,
          properties: [{ name: "blocks", type: "bool", value: true }],
        },
      ],
    },
  ],
  layers: [
    {
      type: "tilelayer",
      name: "floor",
      width: WIDTH,
      height: HEIGHT,
      data: new Array(WIDTH * HEIGHT).fill(FLOOR),
    },
    {
      type: "tilelayer",
      name: "walls & props",
      width: WIDTH,
      height: HEIGHT,
      data: walls,
    },
    {
      type: "objectgroup",
      name: "entries",
      objects: [{ name: "start", type: "entry", point: true, x: 176, y: 144 }],
    },
    {
      // Something to fight until the Combat Area exists.
      type: "objectgroup",
      name: "monsters",
      objects: [skeletons(3, 5.5, 3), skeletons(10.5, 7.5, 1)],
    },
  ],
};
