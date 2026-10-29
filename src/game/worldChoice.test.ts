import { describe, expect, it } from "vitest";
import type { SaveStorage } from "./save";
import {
  readWorldChoice,
  startingWorld,
  writeWorldChoice,
} from "./worldChoice";

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

describe("the 3D World choice", () => {
  it("defaults to the 2D World when nothing is stored", () => {
    expect(readWorldChoice(memoryStorage())).toBe("2d");
  });

  it("is remembered once made, either way", () => {
    const storage = memoryStorage();

    writeWorldChoice(storage, "3d");
    expect(readWorldChoice(storage)).toBe("3d");

    writeWorldChoice(storage, "2d");
    expect(readWorldChoice(storage)).toBe("2d");
  });

  it("reads as the 2D World when what is stored makes no sense", () => {
    const storage = memoryStorage();
    storage.set("wiablo.world", "{broken");

    expect(readWorldChoice(storage)).toBe("2d");
  });

  it("is kept apart from the Save", () => {
    const storage = memoryStorage();

    writeWorldChoice(storage, "3d");

    expect(storage.keys()).not.toContain("wiablo.save");
    expect(storage.keys()).toHaveLength(1);
  });
});

describe("the World a game starts with", () => {
  it("is the stored choice", () => {
    expect(startingWorld("2d", "3d")).toBe("3d");
    expect(startingWorld("2d", "2d")).toBe("2d");
  });

  it("is the 3D World for ?renderer=3d, whatever is stored", () => {
    expect(startingWorld("3d", "2d")).toBe("3d");
  });
});
