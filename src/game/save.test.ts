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

describe("whether a step's events change the Hero's progress", () => {
  it("is yes for ExperienceGained or LevelReached", () => {
    expect(changesProgress([{ type: "ExperienceGained", amount: 100 }])).toBe(
      true,
    );
    expect(
      changesProgress([
        { type: "MonsterDied", id: 1 },
        { type: "LevelReached", level: 2 },
      ]),
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
    writeSave(storage, { level: 2, experience: 600 });
    writeSave(storage, { level: 3, experience: 1_600 });

    expect(readSave(storage)).toEqual({ level: 3, experience: 1_600 });
    expect(storage.keys()).toHaveLength(1);
  });

  it("is no Save once removed", () => {
    const storage = memoryStorage();
    writeSave(storage, { level: 2, experience: 600 });

    removeSave(storage);

    expect(readSave(storage)).toBeNull();
    expect(storage.keys()).toEqual([]);
  });

  it("is no Save when what's stored is corrupt", () => {
    const storage = memoryStorage();
    writeSave(storage, { level: 2, experience: 600 });
    const [key] = storage.keys();
    storage.set(key, "{level: 2");

    expect(readSave(storage)).toBeNull();
  });
});

describe("stored text", () => {
  it("round-trips the Hero's progress", () => {
    const progress = { level: 12, experience: 100_000 };

    expect(parseSave(encodeSave(progress))).toEqual(progress);
  });

  it("carries a version number", () => {
    expect(JSON.parse(encodeSave({ level: 1, experience: 0 }))).toMatchObject({
      version: 1,
    });
  });

  it("gives no Save when missing", () => {
    expect(parseSave(null)).toBeNull();
  });

  it.each([
    ["that isn't JSON", "{level: 2"],
    ["that isn't an object", "42"],
    ["of null", "null"],
    ["without a version", '{"level":2,"experience":500}'],
    ["without Experience", '{"version":1,"level":2}'],
    ["with a Level that isn't a whole number", v1(2.5, 500)],
    ["with a Level below 1", v1(0, 0)],
    ["with a Level above 99", v1(100, 3_520_485_254)],
    ["with negative Experience", v1(1, -1)],
    ["with Experience past the cap", v1(99, 3_520_485_255)],
    ["with too little Experience for its Level", v1(2, 499)],
    ["with enough Experience for the next Level", v1(2, 1_500)],
  ])("gives no Save for text %s", (_, text) => {
    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for another version", () => {
    expect(parseSave('{"version":2,"level":2,"experience":500}')).toBeNull();
  });
});

/** Version 1 stored text for a Level and Experience. */
function v1(level: number, experience: number): string {
  return JSON.stringify({ version: 1, level, experience });
}
