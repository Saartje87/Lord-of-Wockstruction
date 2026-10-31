import { beforeEach, describe, expect, it } from "vitest";
import { RESISTANCE_PENALTIES } from "../tuning/damage";
import { emptyBelt } from "./belt";
import { createWorld, heroResistance, type World } from "./world";

const town = (act: number) => ({
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  properties: [{ name: "act", type: "int", value: act }],
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
});

/** A Hero in Town of Act `act`, wearing Fire Resistance worth `fire` in all. */
function inAct(act: number, fire: number): World {
  return createWorld({
    areas: { town: town(act) },
    seed: 1,
    belongings: {
      inventory: [],
      equipment: {
        armour: {
          type: "leatherArmour",
          rarity: "magic",
          affixes: [{ kind: "fireResistance", grade: 2, value: fire }],
        },
      },
      belt: emptyBelt(),
    },
  });
}

describe("the Resistance Penalty", () => {
  beforeEach(() => {
    RESISTANCE_PENALTIES[2] = 30;
    RESISTANCE_PENALTIES[3] = 200;
  });
  it("is 0 in Act 1", () => {
    expect(RESISTANCE_PENALTIES[1]).toBe(0);
    expect(heroResistance(inAct(1, 20), "fire")).toEqual({
      total: 20,
      effective: 20,
    });
  });

  it("eats a capped excess first: 90% less 30 is 60% effective", () => {
    expect(heroResistance(inAct(2, 90), "fire")).toEqual({
      total: 60,
      effective: 60,
    });
  });

  it("goes below 0: 20% less 30 is -10%", () => {
    expect(heroResistance(inAct(2, 20), "fire")).toEqual({
      total: -10,
      effective: -10,
    });
  });

  it("still caps what is left at 75%", () => {
    expect(heroResistance(inAct(2, 120), "fire")).toEqual({
      total: 90,
      effective: 75,
    });
  });

  it("takes off every Element, and floors at -100", () => {
    const w = inAct(3, 0);
    for (const element of ["fire", "cold", "lightning"] as const) {
      expect(heroResistance(w, element)).toEqual({
        total: -200,
        effective: -100,
      });
    }
  });
});
