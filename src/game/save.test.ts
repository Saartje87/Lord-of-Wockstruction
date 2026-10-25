import { describe, expect, it } from "vitest";
import {
  changesSave,
  encodeSave,
  parseSave,
  readSave,
  removeSave,
  type SaveStorage,
  writeSave,
} from "./save";
import type { Belongings, Progress } from "./sim/world";

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

/** A New Hero's Belongings: the Short Sword Equipped and nothing carried. */
const SWORD_ONLY: Belongings = {
  inventory: [],
  equipment: { weapon: "shortSword" },
};

/** Some Belongings carried and worn, as a Hero might have it later on. */
const WELL_EQUIPPED: Belongings = {
  inventory: [
    { type: "shortSword", cell: { column: 0, row: 0 } },
    { type: "chainMail", cell: { column: 8, row: 1 } },
    { type: "ringOfLife", cell: { column: 1, row: 3 } },
  ],
  equipment: {
    weapon: "axe",
    armour: "leatherArmour",
    amulet: "amuletOfVitality",
    ring1: "ringOfStrength",
    ring2: "ringOfDexterity",
  },
};

/** A Save of `progress`, with only the Short Sword unless `belongings` is given. */
function save(progress: Progress, belongings: Belongings = SWORD_ONLY) {
  return { progress, belongings };
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
    expect(changesSave([{ type: "ExperienceGained", amount: 100 }])).toBe(true);
    expect(
      changesSave([
        { type: "MonsterDied", id: 1 },
        { type: "LevelReached", level: 2 },
      ]),
    ).toBe(true);
    expect(
      changesSave([{ type: "AttributeRaised", attribute: "vitality" }]),
    ).toBe(true);
  });

  it("is yes for ItemPickedUp, which changes the Inventory", () => {
    const item = { id: 3, type: "axe" as const };
    expect(
      changesSave([
        { type: "ItemPickedUp", item, cell: { column: 0, row: 0 } },
      ]),
    ).toBe(true);
  });

  it("is yes for InventoryChanged, any move of an Item by hand", () => {
    expect(changesSave([{ type: "InventoryChanged" }])).toBe(true);
  });

  it("is yes for ItemEquipped and ItemUnequipped", () => {
    const item = { id: 3, type: "axe" as const };
    expect(changesSave([{ type: "ItemEquipped", item, slot: "weapon" }])).toBe(
      true,
    );
    expect(
      changesSave([{ type: "ItemUnequipped", item, slot: "weapon" }]),
    ).toBe(true);
  });

  it("is no for any other events", () => {
    expect(changesSave([])).toBe(false);
    expect(
      changesSave([
        { type: "HitLanded", attacker: "hero", target: 1, damage: 20 },
        { type: "HeroDied" },
        { type: "AreaChanged", area: "town", entry: "start" },
        // Ground Items are never saved.
        {
          type: "ItemDropped",
          item: { id: 3, type: "axe" },
          pos: { x: 1, y: 1 },
        },
        { type: "NoRoom" },
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
    writeSave(storage, save(progress(2, 600)));
    writeSave(
      storage,
      save(progress(3, 1_600, { strength: 24 }), WELL_EQUIPPED),
    );

    expect(readSave(storage)).toEqual(
      save(progress(3, 1_600, { strength: 24 }), WELL_EQUIPPED),
    );
    expect(storage.keys()).toHaveLength(1);
  });

  it("is no Save once removed", () => {
    const storage = memoryStorage();
    writeSave(storage, save(progress(2, 600)));

    removeSave(storage);

    expect(readSave(storage)).toBeNull();
    expect(storage.keys()).toEqual([]);
  });

  it("is no Save when what's stored is corrupt", () => {
    const storage = memoryStorage();
    writeSave(storage, save(progress(2, 600)));
    const [key] = storage.keys();
    storage.set(key, "{level: 2");

    expect(readSave(storage)).toBeNull();
  });
});

describe("stored text", () => {
  it("round-trips the Hero's progress", () => {
    const kept = save(
      progress(12, 100_000, { strength: 35, dexterity: 30, vitality: 40 }),
    );

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("round-trips the Inventory and Equipment", () => {
    const kept = save(progress(2, 600), WELL_EQUIPPED);

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("round-trips a Hero with nothing Equipped", () => {
    const kept = save(progress(2, 600), { inventory: [], equipment: {} });

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("carries a version number", () => {
    expect(JSON.parse(encodeSave(save(progress(1, 0))))).toMatchObject({
      version: 3,
    });
  });

  it("gives no Save when missing", () => {
    expect(parseSave(null)).toBeNull();
  });

  it.each([
    ["that isn't JSON", "{level: 2"],
    ["that isn't an object", "42"],
    ["of null", "null"],
    ["without a version", stored(undefined, fields(progress(2, 500)))],
    ["without Experience", v3({ experience: undefined })],
    ["without Strength", v3({ strength: undefined })],
    ["without unspent points", v3({ attributePoints: undefined })],
    ["with a Level that isn't a whole number", v3({ level: 2.5 })],
    ["with a Level below 1", v3(progress(0, 0))],
    ["with a Level above 99", v3(progress(100, 3_520_485_254))],
    ["with negative Experience", v3(progress(1, -1))],
    ["with Experience past the cap", v3(progress(99, 3_520_485_255))],
    ["with too little Experience for its Level", v3(progress(2, 499))],
    ["with enough Experience for the next Level", v3(progress(2, 1_500))],
    ["with Dexterity that isn't a whole number", v3({ dexterity: 20.5 })],
    ["with Vitality below where a Hero starts", v3({ vitality: 19 })],
    ["with negative unspent points", v3({ attributePoints: -1 })],
    ["with more points than its Level gave", v3({ attributePoints: 6 })],
    ["with fewer points than its Level gave", v3({ attributePoints: 4 })],
    ["with more spent than its Level gave", v3({ strength: 21 })],
    ["without an Inventory", v3({ inventory: undefined })],
    ["without Equipment", v3({ equipment: undefined })],
    ["with an Inventory that isn't a list", v3({ inventory: {} })],
    ["with Equipment that isn't an object", v3({ equipment: [] })],
    [
      "with an unknown Item type",
      v3({ inventory: [{ type: "bow", cell: { column: 0, row: 0 } }] }),
    ],
    ["with an Item without a cell", v3({ inventory: [{ type: "axe" }] })],
    [
      "with an Item off the grid's left",
      v3({ inventory: [{ type: "axe", cell: { column: -1, row: 0 } }] }),
    ],
    [
      // The Axe is 2×3: from column 9 it hangs off the right edge.
      "with an Item hanging off the grid's right",
      v3({ inventory: [{ type: "axe", cell: { column: 9, row: 0 } }] }),
    ],
    [
      // The Short Sword is 1×3: from row 2 it hangs off the bottom.
      "with an Item hanging off the grid's bottom",
      v3({ inventory: [{ type: "shortSword", cell: { column: 0, row: 2 } }] }),
    ],
    [
      "with an Item at a cell that isn't whole",
      v3({
        inventory: [{ type: "ringOfLife", cell: { column: 0.5, row: 0 } }],
      }),
    ],
    [
      "with overlapping Items",
      v3({
        inventory: [
          { type: "axe", cell: { column: 0, row: 0 } },
          { type: "ringOfLife", cell: { column: 1, row: 2 } },
        ],
      }),
    ],
    [
      "with an Item in a slot of another kind",
      v3({ equipment: { weapon: "leatherArmour" } }),
    ],
    ["with a Ring as the Amulet", v3({ equipment: { amulet: "ringOfLife" } })],
    ["with an unknown slot", v3({ equipment: { helm: "chainMail" } })],
    ["with an unknown Equipped type", v3({ equipment: { weapon: "bow" } })],
  ])("gives no Save for text %s", (_, text) => {
    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for another version", () => {
    expect(parseSave(stored(2, fields(progress(2, 500))))).toBeNull();
    expect(parseSave(stored(4, fields(progress(2, 500))))).toBeNull();
  });

  // What Saves before Items held, so a Hero from then starts afresh.
  it("gives no Save for version 2 progress without Belongings", () => {
    expect(parseSave(stored(2, progress(2, 500)))).toBeNull();
  });
});

/** The stored fields of a Save of `progress` with only the Short Sword. */
function fields(kept: Progress): object {
  return { ...kept, ...SWORD_ONLY };
}

/**
 * Version 3 stored text for a Level 2 Hero with 500 Experience, their 5
 * points unspent and only the Short Sword, with `changes` made to it.
 */
function v3(changes: Record<string, unknown>) {
  return stored(3, { ...fields(progress(2, 500)), ...changes });
}

/** Stored text of `version` holding `fields`. */
function stored(version: number | undefined, fields: object): string {
  return JSON.stringify({ version, ...fields });
}
