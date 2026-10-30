import { describe, expect, it } from "vitest";
import { emptySkillBar } from "./skillBar";
import {
  createWorld,
  FRESH_PROGRESS,
  maxLife,
  maxMana,
  progressOf,
} from "./world";

/** A Town of open floor with its `start` Entry in the middle tile. */
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
      objects: [{ name: "start", type: "entry", point: true, x: 48, y: 16 }],
    },
  ],
};

describe("a World created from a saved progress", () => {
  it("starts the Hero in Town at start with that progress and full Life and Mana", () => {
    const saved = {
      level: 5,
      experience: 10_000,
      strength: 30,
      dexterity: 28,
      vitality: 22,
      energy: 25,
      attributePoints: 0,
      skillPoints: 1,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 3 },
      skillBar: emptySkillBar(),
      touchedWaypoints: ["town"],
      quests: structuredClone(FRESH_PROGRESS.quests),
    };
    const w = createWorld({
      areas: { town },
      seed: 1,
      progress: saved,
    });

    expect(w.areaName).toBe("town");
    expect(w.hero.pos).toEqual({ x: 1.5, y: 0.5 });
    expect(progressOf(w)).toEqual(saved);
    // 100, 2 more for each Level past the first and 3 for each Vitality
    // point past 20.
    expect(maxLife(w)).toBe(114);
    expect(w.hero.life).toBe(114);
    // 2 for each Energy point and 1 for each Level past the first.
    expect(maxMana(w)).toBe(54);
    expect(w.hero.mana).toBe(54);
  });
});

describe("a World created without a saved progress", () => {
  it("starts a fresh Level 1 Hero at 20/20/20/20 with 100 Life", () => {
    const w = createWorld({ areas: { town }, seed: 1 });

    expect(progressOf(w)).toEqual({
      level: 1,
      experience: 0,
      strength: 20,
      dexterity: 20,
      vitality: 20,
      energy: 20,
      attributePoints: 0,
      skillPoints: 0,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 0 },
      skillBar: emptySkillBar(),
      touchedWaypoints: [...FRESH_PROGRESS.touchedWaypoints],
      quests: structuredClone(FRESH_PROGRESS.quests),
    });
    expect(w.hero.life).toBe(100);
  });
});
