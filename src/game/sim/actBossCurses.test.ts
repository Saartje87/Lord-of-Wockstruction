import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import {
  createWorld,
  FRESH_PROGRESS,
  type Monster,
  type Progress,
  step,
  type World,
} from "./world";

function point(type: string, name: string, x: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: 48 };
}

/** The Hero's Entry, then Grave Wockington 6 tiles on, in a roomy hall. */
function hall() {
  const width = 30;
  return combatArea(
    {
      orientation: "orthogonal",
      width,
      height: 3,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          type: "tilelayer",
          name: "floor",
          width,
          height: 3,
          data: new Array(width * 3).fill(1),
        },
        {
          type: "objectgroup",
          name: "objects",
          objects: [
            point("entry", "start", 1),
            {
              ...point("actBoss", "Grave Wockington", 7),
              properties: [
                { name: "monster", type: "string", value: "grave_wockington" },
              ],
            },
          ],
        },
      ],
    },
    11,
  );
}

/** A Level 15 Hero with every Curse learned, on the keys. */
function necromancer(): Progress {
  const level = 15;
  return {
    ...FRESH_PROGRESS,
    level,
    experience: heroTuning.experienceTable[level - 1],
    skillPoints: 0,
    skillLevels: {
      ...FRESH_PROGRESS.skillLevels,
      amplifyDamage: 1,
      weaken: 1,
      leadenLimbs: 1,
      dread: 1,
    },
    skillBar: {
      ...emptySkillBar(),
      right: "dread",
      key1: "amplifyDamage",
      key2: "weaken",
      key3: "leadenLimbs",
    },
  };
}

const town = {
  orientation: "orthogonal",
  width: 6,
  height: 3,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    {
      type: "tilelayer",
      name: "floor",
      width: 6,
      height: 3,
      data: new Array(18).fill(1),
    },
    {
      type: "objectgroup",
      name: "objects",
      objects: [point("entry", "start", 1)],
    },
  ],
};

function inHall(): World {
  return createWorld({
    areas: { town, hall: hall() },
    seed: 1,
    progress: necromancer(),
    start: { area: "hall", entry: "start" },
  });
}

const bossOf = (w: World) =>
  w.monsters.find((m) => m.type === "grave_wockington") as Monster;

const cast = (
  w: World,
  slot: "key1" | "key2" | "key3" | "right",
  at: Monster,
) => step(w, [{ type: "Cast", slot, target: { ...at.pos } }]);

describe("Curses on the Act Boss", () => {
  for (const [slot, skill] of [
    ["key1", "amplifyDamage"],
    ["key2", "weaken"],
    ["key3", "leadenLimbs"],
  ] as const) {
    it(`${skill} takes hold on him`, () => {
      const w = inHall();
      cast(w, slot, bossOf(w));
      expect(bossOf(w).curse?.skill).toBe(skill);
    });
  }

  it("Dread leaves him without a Curse and never sets him Fleeing", () => {
    const w = inHall();
    for (let i = 0; i < 20; i++) {
      w.hero.life = 1_000_000;
      cast(w, "right", bossOf(w));
      expect(bossOf(w).curse).toBeNull();
      expect(bossOf(w).state).not.toBe("flee");
    }
  });

  it("Dread leaves a Curse he already has", () => {
    const w = inHall();
    cast(w, "key2", bossOf(w));
    cast(w, "right", bossOf(w));
    expect(bossOf(w).curse?.skill).toBe("weaken");
    expect(bossOf(w).state).not.toBe("flee");
  });

  it("Dread sets his raised Monsters Fleeing as usual", () => {
    const w = inHall();
    let raised: Monster | undefined;
    for (let i = 0; i < 60 * 20 && !raised; i++) {
      w.hero.life = 1_000_000;
      step(w, []);
      raised = w.monsters.find((m) => m.type === "skeleton");
    }
    if (!raised) throw new Error("He raised nothing");
    cast(w, "right", raised);
    expect(raised.curse?.skill).toBe("dread");
    expect(raised.state).toBe("flee");
    expect(bossOf(w).curse).toBeNull();
  });
});
