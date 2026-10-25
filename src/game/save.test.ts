import { describe, expect, it } from "vitest";
import {
  changesProgress,
  encodeSave,
  parseSave,
  readSave,
  removeSave,
  type SaveStorage,
  writeSave,
} from "./save";
import type { Progress } from "./sim/world";

/** Storage kept in a Map, standing in for the browser's. */
function memoryStorage(): SaveStorage & { keys(): string[] } {
  const stored = new Map<string, string>();
  return {
    get: (key) => stored.get(key) ?? null,
    set: (key, value) => {
      stored.set(key, value);
    },
    remove: (key) => {
      stored.delete(key);
    },
    keys: () => [...stored.keys()],
  };
}

/**
 * A Hero's progress at `level` with `experience`, from 20/20/20 raised as
 * `raised` says, with the rest of their 5 points a Level unspent.
 */
function progress(
  level: number,
  experience: number,
  raised: Partial<Pick<Progress, "strength" | "dexterity" | "vitality">> = {},
): Progress {
  const attributes = { strength: 20, dexterity: 20, vitality: 20, ...raised };
  const spent =
    attributes.strength + attributes.dexterity + attributes.vitality - 60;
  return {
    level,
    experience,
    ...attributes,
    attributePoints: 5 * (level - 1) - spent,
  };
}

describe("whether a step's events change the Hero's progress", () => {
  it("is yes for ExperienceGained, LevelReached or AttributeRaised", () => {
    expect(changesProgress([{ type: "ExperienceGained", amount: 100 }])).toBe(
      true,
    );
    expect(
      changesProgress([
        { type: "MonsterDied", id: 1 },
        { type: "LevelReached", level: 2 },
      ]),
    ).toBe(true);
    expect(
      changesProgress([{ type: "AttributeRaised", attribute: "vitality" }]),
    ).toBe(true);
  });

  it("is no for any other events", () => {
    expect(changesProgress([])).toBe(false);
    expect(
      changesProgress([
        { type: "HitLanded", attacker: "hero", target: 1, damage: 20 },
        { type: "HeroDied" },
        { type: "AreaChanged", area: "town", entry: "start" },
      ]),
    ).toBe(false);
  });
});

describe("the Save in storage", () => {
  it("is no Save before anything is written", () => {
    expect(readSave(memoryStorage())).toBeNull();
  });

  it("reads back what was last written, under one key", () => {
    const storage = memoryStorage();
    writeSave(storage, progress(2, 600));
    writeSave(storage, progress(3, 1_600, { strength: 24 }));

    expect(readSave(storage)).toEqual(progress(3, 1_600, { strength: 24 }));
    expect(storage.keys()).toHaveLength(1);
  });

  it("is no Save once removed", () => {
    const storage = memoryStorage();
    writeSave(storage, progress(2, 600));

    removeSave(storage);

    expect(readSave(storage)).toBeNull();
    expect(storage.keys()).toEqual([]);
  });

  it("is no Save when what's stored is corrupt", () => {
    const storage = memoryStorage();
    writeSave(storage, progress(2, 600));
    const [key] = storage.keys();
    storage.set(key, "{level: 2");

    expect(readSave(storage)).toBeNull();
  });
});

describe("stored text", () => {
  it("round-trips the Hero's progress", () => {
    const kept = progress(12, 100_000, {
      strength: 35,
      dexterity: 30,
      vitality: 40,
    });

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("carries a version number", () => {
    expect(JSON.parse(encodeSave(progress(1, 0)))).toMatchObject({
      version: 2,
    });
  });

  it("gives no Save when missing", () => {
    expect(parseSave(null)).toBeNull();
  });

  it.each([
    ["that isn't JSON", "{level: 2"],
    ["that isn't an object", "42"],
    ["of null", "null"],
    ["without a version", stored(undefined, progress(2, 500))],
    ["without Experience", v2({ experience: undefined })],
    ["without Strength", v2({ strength: undefined })],
    ["without unspent points", v2({ attributePoints: undefined })],
    ["with a Level that isn't a whole number", v2({ level: 2.5 })],
    ["with a Level below 1", v2(progress(0, 0))],
    ["with a Level above 99", v2(progress(100, 3_520_485_254))],
    ["with negative Experience", v2(progress(1, -1))],
    ["with Experience past the cap", v2(progress(99, 3_520_485_255))],
    ["with too little Experience for its Level", v2(progress(2, 499))],
    ["with enough Experience for the next Level", v2(progress(2, 1_500))],
    ["with Dexterity that isn't a whole number", v2({ dexterity: 20.5 })],
    ["with Vitality below where a Hero starts", v2({ vitality: 19 })],
    ["with negative unspent points", v2({ attributePoints: -1 })],
    ["with more points than its Level gave", v2({ attributePoints: 6 })],
    ["with fewer points than its Level gave", v2({ attributePoints: 4 })],
    ["with more spent than its Level gave", v2({ strength: 21 })],
  ])("gives no Save for text %s", (_, text) => {
    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for another version", () => {
    expect(parseSave(stored(1, progress(2, 500)))).toBeNull();
    expect(parseSave(stored(3, progress(2, 500)))).toBeNull();
  });
});

/**
 * Version 2 stored text for a Level 2 Hero with 500 Experience and their 5
 * points unspent, with `changes` made to it.
 */
function v2(changes: Partial<Record<keyof Progress, number | undefined>>) {
  return stored(2, { ...progress(2, 500), ...changes });
}

/** Stored text of `version` holding `fields`. */
function stored(version: number | undefined, fields: object): string {
  return JSON.stringify({ version, ...fields });
}
