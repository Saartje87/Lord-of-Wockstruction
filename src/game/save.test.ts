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
import type { Belongings } from "./sim/inventory";
import { emptySkillBar, type SkillBar } from "./sim/skillBar";
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

/** A New Hero's Belongings: the Short Sword Equipped and nothing carried. */
const SWORD_ONLY: Belongings = {
  inventory: [],
  equipment: { weapon: "shortSword" },
  belt: [[], [], [], []],
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
  belt: [["lifePotion"], [], ["lifePotion"], []],
};

/** A Save of `progress`, with only the Short Sword unless `belongings` is given. */
function save(progress: Progress, belongings: Belongings = SWORD_ONLY) {
  return { progress, belongings };
}

/**
 * A Hero's progress at `level` with `experience`, from 20/20/20/20 raised as
 * `raised` says, with the rest of their 5 points a Level unspent, the Golem
 * at `golem` with the rest of their Skill Point a Level unspent, and
 * `skillBar` on the Skill Bar.
 */
function progress(
  level: number,
  experience: number,
  raised: Partial<
    Pick<Progress, "strength" | "dexterity" | "vitality" | "energy">
  > = {},
  golem = 0,
  skillBar: SkillBar = emptySkillBar(),
): Progress {
  const attributes = {
    strength: 20,
    dexterity: 20,
    vitality: 20,
    energy: 20,
    ...raised,
  };
  const spent =
    attributes.strength +
    attributes.dexterity +
    attributes.vitality +
    attributes.energy -
    80;
  return {
    level,
    experience,
    ...attributes,
    attributePoints: 5 * (level - 1) - spent,
    skillPoints: level - 1 - golem,
    skillLevels: { golem },
    skillBar,
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

  it("is yes for SkillLevelRaised", () => {
    expect(
      changesSave([
        { type: "SkillLevelRaised", skill: "golem", skillLevel: 1 },
      ]),
    ).toBe(true);
  });

  it("is yes for SkillBarChanged, which rearranges the Skill Bar", () => {
    expect(changesSave([{ type: "SkillBarChanged" }])).toBe(true);
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

  it("is yes for BeltChanged, a Potion into or out of the Belt", () => {
    expect(changesSave([{ type: "BeltChanged" }])).toBe(true);
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
      progress(12, 100_000, {
        strength: 35,
        dexterity: 30,
        vitality: 30,
        energy: 25,
      }),
    );

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("round-trips Skill Levels and unspent Skill Points", () => {
    const learned = save(progress(5, 10_000, {}, 3));
    const unspent = save(progress(5, 10_000, {}, 0));

    expect(parseSave(encodeSave(learned))?.progress).toMatchObject({
      skillPoints: 1,
      skillLevels: { golem: 3 },
    });
    expect(parseSave(encodeSave(unspent))?.progress).toMatchObject({
      skillPoints: 4,
      skillLevels: { golem: 0 },
    });
  });

  it("round-trips the Skill Bar", () => {
    const inKeyedSlot = { ...emptySkillBar(), key3: "golem" as const };
    const inRightSlot = { ...emptySkillBar(), right: "golem" as const };

    for (const skillBar of [inKeyedSlot, inRightSlot, emptySkillBar()]) {
      const kept = save(progress(3, 1_600, {}, 1, skillBar));
      expect(parseSave(encodeSave(kept))).toEqual(kept);
    }
  });

  it("round-trips the Inventory and Equipment", () => {
    const kept = save(progress(2, 600), WELL_EQUIPPED);

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("round-trips the Belt Columns' Potions", () => {
    const kept = save(progress(2, 600), WELL_EQUIPPED);

    expect(parseSave(encodeSave(kept))?.belongings.belt).toEqual([
      ["lifePotion"],
      [],
      ["lifePotion"],
      [],
    ]);
  });

  it("round-trips Mana and Rejuvenation Potions, in the Belt and Inventory", () => {
    const kept = save(progress(2, 600), {
      inventory: [{ type: "rejuvenationPotion", cell: { column: 3, row: 2 } }],
      equipment: {},
      belt: [["manaPotion"], ["rejuvenationPotion"], [], ["lifePotion"]],
    });

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("round-trips a Hero with nothing Equipped", () => {
    const kept = save(progress(2, 600), {
      inventory: [],
      equipment: {},
      belt: [[], [], [], []],
    });

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  it("carries a version number", () => {
    expect(JSON.parse(encodeSave(save(progress(1, 0))))).toMatchObject({
      version: 7,
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
    ["without Experience", v7({ experience: undefined })],
    ["without Strength", v7({ strength: undefined })],
    ["without unspent points", v7({ attributePoints: undefined })],
    ["with a Level that isn't a whole number", v7({ level: 2.5 })],
    ["with a Level below 1", v7(progress(0, 0))],
    ["with a Level above 99", v7(progress(100, 3_520_485_254))],
    ["with negative Experience", v7(progress(1, -1))],
    ["with Experience past the cap", v7(progress(99, 3_520_485_255))],
    ["with too little Experience for its Level", v7(progress(2, 499))],
    ["with enough Experience for the next Level", v7(progress(2, 1_500))],
    ["with Dexterity that isn't a whole number", v7({ dexterity: 20.5 })],
    ["with Vitality below where a Hero starts", v7({ vitality: 19 })],
    ["without Energy", v7({ energy: undefined })],
    ["with Energy below where a Hero starts", v7({ energy: 19 })],
    ["with more Energy than its Level gave", v7({ energy: 21 })],
    ["with negative unspent points", v7({ attributePoints: -1 })],
    ["with more points than its Level gave", v7({ attributePoints: 6 })],
    ["with fewer points than its Level gave", v7({ attributePoints: 4 })],
    ["with more spent than its Level gave", v7({ strength: 21 })],
    ["without unspent Skill Points", v7({ skillPoints: undefined })],
    ["without Skill Levels", v7({ skillLevels: undefined })],
    ["with Skill Levels that aren't an object", v7({ skillLevels: [1] })],
    ["without the Golem's Skill Level", v7({ skillLevels: {} })],
    [
      "with a Skill Level that isn't a whole number",
      v7({ skillPoints: 0.5, skillLevels: { golem: 0.5 } }),
    ],
    [
      "with a negative Skill Level",
      v7({ skillPoints: 2, skillLevels: { golem: -1 } }),
    ],
    [
      "with negative unspent Skill Points",
      v7({ skillPoints: -1, skillLevels: { golem: 2 } }),
    ],
    ["with more Skill Points than its Level gave", v7({ skillPoints: 2 })],
    ["with fewer Skill Points than its Level gave", v7({ skillPoints: 0 })],
    [
      "with more Skill Levels than its Level gave",
      v7({ skillPoints: 0, skillLevels: { golem: 2 } }),
    ],
    [
      "with an unknown Skill",
      v7({ skillPoints: 0, skillLevels: { golem: 0, teeth: 1 } }),
    ],
    ["without a Skill Bar", v7({ skillBar: undefined })],
    ["with a Skill Bar that isn't an object", v7({ skillBar: [null] })],
    ["with a Skill Bar slot missing", v7({ skillBar: { right: null } })],
    [
      "with an unknown Skill Bar slot",
      v7({ skillBar: { ...emptySkillBar(), key5: null } }),
    ],
    [
      "with an unknown Skill on the Skill Bar",
      v7({ skillBar: { ...emptySkillBar(), key1: "teeth" } }),
    ],
    [
      "with an unlearned Skill on the Skill Bar",
      v7({ skillBar: { ...emptySkillBar(), right: "golem" } }),
    ],
    [
      "with a Skill in two Skill Bar slots",
      v7({
        skillPoints: 0,
        skillLevels: { golem: 1 },
        skillBar: { ...emptySkillBar(), right: "golem", key2: "golem" },
      }),
    ],
    ["without an Inventory", v7({ inventory: undefined })],
    ["without Equipment", v7({ equipment: undefined })],
    ["with an Inventory that isn't a list", v7({ inventory: {} })],
    ["with Equipment that isn't an object", v7({ equipment: [] })],
    [
      "with an unknown Item type",
      v7({ inventory: [{ type: "bow", cell: { column: 0, row: 0 } }] }),
    ],
    ["with an Item without a cell", v7({ inventory: [{ type: "axe" }] })],
    [
      "with an Item off the grid's left",
      v7({ inventory: [{ type: "axe", cell: { column: -1, row: 0 } }] }),
    ],
    [
      // The Axe is 2×3: from column 9 it hangs off the right edge.
      "with an Item hanging off the grid's right",
      v7({ inventory: [{ type: "axe", cell: { column: 9, row: 0 } }] }),
    ],
    [
      // The Short Sword is 1×3: from row 2 it hangs off the bottom.
      "with an Item hanging off the grid's bottom",
      v7({ inventory: [{ type: "shortSword", cell: { column: 0, row: 2 } }] }),
    ],
    [
      "with an Item at a cell that isn't whole",
      v7({
        inventory: [{ type: "ringOfLife", cell: { column: 0.5, row: 0 } }],
      }),
    ],
    [
      "with overlapping Items",
      v7({
        inventory: [
          { type: "axe", cell: { column: 0, row: 0 } },
          { type: "ringOfLife", cell: { column: 1, row: 2 } },
        ],
      }),
    ],
    [
      "with an Item in a slot of another kind",
      v7({ equipment: { weapon: "leatherArmour" } }),
    ],
    ["with a Ring as the Amulet", v7({ equipment: { amulet: "ringOfLife" } })],
    ["with an unknown slot", v7({ equipment: { helm: "chainMail" } })],
    ["with an unknown Equipped type", v7({ equipment: { weapon: "bow" } })],
    ["without a Belt", v7({ belt: undefined })],
    ["with a Belt that isn't a list", v7({ belt: {} })],
    ["with three Belt Columns", v7({ belt: [[], [], []] })],
    ["with a Belt Column that isn't a list", v7({ belt: [[], [], [], 1] })],
    [
      "with more Potions in a Belt Column than it holds",
      v7({ belt: [["lifePotion", "lifePotion"], [], [], []] }),
    ],
    [
      "with an Item that isn't a Potion in the Belt",
      v7({ belt: [["axe"], [], [], []] }),
    ],
    [
      "with an unknown type in the Belt",
      v7({ belt: [["elixir"], [], [], []] }),
    ],
  ])("gives no Save for text %s", (_, text) => {
    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for another version", () => {
    expect(parseSave(stored(5, fields(progress(2, 500))))).toBeNull();
    expect(parseSave(stored(8, fields(progress(2, 500))))).toBeNull();
  });

  // What Saves before the Belt held: the Hero loads with an empty Belt.
  it("loads version 6 text without a Belt with an empty Belt", () => {
    const { belt, ...before } = WELL_EQUIPPED;
    const text = stored(6, { ...progress(2, 600), ...before });

    expect(parseSave(text)).toEqual(
      save(progress(2, 600), { ...before, belt: [[], [], [], []] }),
    );
  });

  it("still checks the rest of version 6 text", () => {
    const text = stored(6, {
      ...progress(2, 600),
      ...SWORD_ONLY,
      belt: undefined,
      equipment: { weapon: "bow" },
    });

    expect(parseSave(text)).toBeNull();
  });

  // What Saves before the Skill Bar held: no migration, so a Hero from then
  // starts afresh.
  it("gives no Save for version 5 text without a Skill Bar", () => {
    const { skillBar, ...before } = progress(2, 500);
    expect(parseSave(stored(5, { ...before, ...SWORD_ONLY }))).toBeNull();
  });

  // What Saves before Energy held, so a Hero from then starts afresh.
  it("gives no Save for version 3 progress without Energy", () => {
    const { energy: _, ...withoutEnergy } = progress(2, 500);
    expect(parseSave(stored(3, fields(withoutEnergy)))).toBeNull();
  });

  // What Saves before Items held, so a Hero from then starts afresh.
  it("gives no Save for version 2 progress without Belongings", () => {
    expect(parseSave(stored(2, progress(2, 500)))).toBeNull();
  });

  // What Saves before Skills held: no migration, so a Hero from then starts
  // afresh rather than with a Skill Point for each Level.
  it("gives no Save for version 4 text without Skills", () => {
    const { skillPoints, skillLevels, ...before } = progress(2, 500);
    expect(parseSave(stored(4, { ...before, ...SWORD_ONLY }))).toBeNull();
  });
});

/** The stored fields of a Save of `progress` with only the Short Sword. */
function fields(kept: Omit<Progress, "energy">): object {
  return { ...kept, ...SWORD_ONLY };
}

/**
 * Version 7 stored text for a Level 2 Hero with 500 Experience, their 5
 * points and 1 Skill Point unspent and only the Short Sword, with `changes`
 * made to it.
 */
function v7(changes: Record<string, unknown>) {
  return stored(7, { ...fields(progress(2, 500)), ...changes });
}

/** Stored text of `version` holding `fields`. */
function stored(version: number | undefined, fields: object): string {
  return JSON.stringify({ version, ...fields });
}
