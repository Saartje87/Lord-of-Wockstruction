import { describe, expect, it } from "vitest";
import { emptySkillBar } from "./skillBar";
import {
  createWorld,
  isInCombat,
  maxMana,
  type Progress,
  progressOf,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` a pack of `pack` Skeletons, centred on their tile.
 */
function map(rows: string[], pack = 1) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
          { name: "count", type: "int", value: pack },
        ],
      });
    }
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height,
        data: new Array(width * height).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/** A Town with the Hero next to a pack of `pack` Skeletons. */
function world(pack = 1, progress?: Progress): World {
  return createWorld({
    areas: { town: map(["H.S.."], pack) },
    seed: 1,
    progress,
  });
}

describe("a fresh Hero", () => {
  it("has 20 Energy and 40 max Mana, with full Mana", () => {
    const w = world();

    expect(progressOf(w).energy).toBe(20);
    expect(maxMana(w)).toBe(40);
    expect(w.hero.mana).toBe(40);
  });
});

describe("a new Level", () => {
  it("adds 1 max Mana and fills Mana", () => {
    const w = world(5);
    let levelled = false;
    for (let i = 0; !levelled; i++) {
      if (i > 60 * 60) throw new Error("The Hero didn't reach Level 2");
      // Low, so regeneration alone can't fill it before the kill.
      w.hero.mana = 1;
      const [nearest] = w.monsters;
      const events = step(w, [{ type: "Attack", monster: nearest.id }]);
      levelled = events.some((event) => event.type === "LevelReached");
    }

    expect(progressOf(w).level).toBe(2);
    expect(maxMana(w)).toBe(41);
    expect(w.hero.mana).toBe(41);
  });
});

describe("Mana regeneration", () => {
  it("runs at 2 Mana/s In Combat, with a Skeleton hitting the Hero", () => {
    const w = world();
    for (let i = 0; !isInCombat(w); i++) {
      if (i > 600) throw new Error("The Hero was never In Combat");
      step(w, []);
    }
    w.hero.mana = 10;

    for (let i = 0; i < 60; i++) {
      step(w, []);
      expect(isInCombat(w)).toBe(true);
    }

    expect(w.hero.mana).toBeCloseTo(12);
  });

  it("runs at 2 Mana/s outside combat too, stopping at max Mana", () => {
    const w = createWorld({ areas: { town: map(["H.."]) }, seed: 1 });
    w.hero.mana = 30;

    for (let i = 0; i < 60; i++) step(w, []);
    expect(isInCombat(w)).toBe(false);
    expect(w.hero.mana).toBeCloseTo(32);

    for (let i = 0; i < 10 * 60; i++) step(w, []);
    expect(w.hero.mana).toBe(40);
  });
});

/** A Level 3 Hero at 20/20/20/20 with all 10 of their points unspent. */
const UNSPENT: Progress = {
  level: 3,
  experience: 1_500,
  strength: 20,
  dexterity: 20,
  vitality: 20,
  energy: 20,
  attributePoints: 10,
  skillPoints: 2,
  skillLevels: { golem: 0 },
  skillBar: emptySkillBar(),
};

describe("Energy", () => {
  it("is raised by an Attribute Point, adding 2 to both max and current Mana", () => {
    const w = world(1, UNSPENT);
    w.hero.mana = 10;

    const events = step(w, [
      { type: "SpendAttributePoint", attribute: "energy" },
    ]);

    expect(events).toContainEqual({
      type: "AttributeRaised",
      attribute: "energy",
    });
    expect(progressOf(w)).toMatchObject({ energy: 21, attributePoints: 9 });
    // 42 at Level 3, and 2 more.
    expect(maxMana(w)).toBe(44);
    // And a step's worth of regeneration.
    expect(w.hero.mana).toBeCloseTo(12 + 2 / 60);
  });
});
