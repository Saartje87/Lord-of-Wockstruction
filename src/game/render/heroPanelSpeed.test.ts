import { describe, expect, it } from "vitest";
import { emptyBelt } from "../sim/belt";
import type { Belongings } from "../sim/inventory";
import { createWorld } from "../sim/world";
import { heroSheet } from "./heroPanel";

const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

const worldWith = (equipment: Belongings["equipment"]) =>
  createWorld({
    areas: { town },
    seed: 1,
    belongings: { inventory: [], equipment, belt: emptyBelt() },
  });

const gloves: Belongings["equipment"] = {
  gloves: {
    type: "leatherGloves",
    rarity: "magic",
    affixes: [{ kind: "attackSpeed", grade: 0, value: 12 }],
  },
};
const boots: Belongings["equipment"] = {
  boots: {
    type: "leatherBoots",
    rarity: "magic",
    affixes: [{ kind: "walkSpeed", grade: 0, value: 9 }],
  },
};

const lines = (equipment: Belongings["equipment"]) =>
  heroSheet(worldWith(equipment))
    .derived.filter((d) => /speed/i.test(d.name))
    .map(({ name, value }) => ({ name, value }));

describe("heroSheet with Gloves and Boots of speed", () => {
  it("shows neither line while both bonuses are 0", () => {
    expect(lines({})).toEqual([]);
  });

  it("shows the attack speed bonus when it isn't 0", () => {
    expect(lines(gloves)).toEqual([{ name: "Attack Speed", value: "+12%" }]);
  });

  it("shows the walk speed bonus when it isn't 0", () => {
    expect(lines(boots)).toEqual([{ name: "Walk Speed", value: "+9%" }]);
  });
});
