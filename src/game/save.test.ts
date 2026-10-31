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
import { FRESH_PROGRESS, type Progress } from "./sim/world";
import { affixTuning } from "./tuning/items";

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
  equipment: { weapon: { type: "shortSword" } },
  belt: [[], [], [], []],
};

/** What version 6 to 10 text holds of Belongings: Items by type alone. */
const SWORD_V10 = {
  inventory: [],
  equipment: { weapon: "shortSword" },
  belt: [[], [], [], []],
};

/** Some Belongings carried and worn, as a Hero might have it later on. */
const WELL_EQUIPPED: Belongings = {
  inventory: [
    { type: "shortSword", cell: { column: 0, row: 0 } },
    { type: "chainMail", cell: { column: 8, row: 1 } },
    { type: "ring", cell: { column: 1, row: 3 } },
  ],
  equipment: {
    weapon: { type: "axe" },
    armour: { type: "leatherArmour" },
    amulet: { type: "amulet" },
    ring1: { type: "ring" },
    ring2: { type: "ring" },
    belt: { type: "heavyBelt" },
  },
  belt: [["lifePotion", "manaPotion", "lifePotion"], [], ["lifePotion"], []],
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
    skillLevels: { ...FRESH_PROGRESS.skillLevels, golem },
    skillBar,
    touchedWaypoints: [...FRESH_PROGRESS.touchedWaypoints],
    quests: structuredClone(FRESH_PROGRESS.quests),
    smithService: "locked",
    gold: 0,
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
    const item = {
      id: 3,
      type: "axe" as const,
      rarity: "normal" as const,
      affixes: [],
    };
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
    const item = {
      id: 3,
      type: "axe" as const,
      rarity: "normal" as const,
      affixes: [],
    };
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
        {
          type: "HitLanded",
          attacker: "hero",
          target: 1,
          damage: 20,
          damageType: "physical",
        },
        { type: "HeroDied" },
        { type: "AreaChanged", area: "town", entry: "start" },
        // Ground Items are never saved.
        {
          type: "ItemDropped",
          item: { id: 3, type: "axe", rarity: "normal", affixes: [] },
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

  it("round-trips Raise Skeleton's Skill Level and Skill Bar slot", () => {
    const kept = save({
      ...progress(4, 3_750, {}, 1),
      skillPoints: 0,
      skillLevels: {
        ...FRESH_PROGRESS.skillLevels,
        golem: 1,
        raiseSkeleton: 2,
      },
      skillBar: { ...emptySkillBar(), right: "raiseSkeleton", key1: "golem" },
    });

    expect(parseSave(encodeSave(kept))).toEqual(kept);
  });

  // What Saves before Raise Skeleton held: the same version, as only a
  // Skill Level is missing.
  it("loads a Save without a Skill's Skill Level with it at 0", () => {
    const loaded = parseSave(
      v10({ skillPoints: 0, skillLevels: { golem: 1 } }),
    );

    expect(loaded?.progress.skillLevels).toEqual({
      ...FRESH_PROGRESS.skillLevels,
      golem: 1,
      raiseSkeleton: 0,
    });
  });

  it("loads a Save from before Weaken with Weaken at Skill Level 0", () => {
    const loaded = parseSave(
      v10({ skillPoints: 0, skillLevels: { golem: 1 } }),
    );

    expect(loaded?.progress.skillLevels.golem).toBe(1);
    expect(loaded?.progress.skillLevels.weaken).toBe(0);
  });

  // Prerequisites gate only spending: loading never checks them.
  it("loads a Save with Golem learned and Raise Skeleton at 0 unchanged", () => {
    const kept = save({
      ...progress(4, 3_750, {}, 1),
      skillPoints: 1,
      skillLevels: {
        ...FRESH_PROGRESS.skillLevels,
        golem: 2,
        raiseSkeleton: 0,
      },
      skillBar: { ...emptySkillBar(), right: "golem" },
    });

    expect(parseSave(encodeSave(kept))).toEqual(kept);
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
      ["lifePotion", "manaPotion", "lifePotion"],
      [],
      ["lifePotion"],
      [],
    ]);
  });

  it("keeps the Equipped Belt", () => {
    const kept = save(progress(2, 600), WELL_EQUIPPED);

    expect(parseSave(encodeSave(kept))?.belongings.equipment.belt).toEqual({
      type: "heavyBelt",
    });
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
      version: 14,
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
    ["without Experience", v10({ experience: undefined })],
    ["without Strength", v10({ strength: undefined })],
    ["without unspent points", v10({ attributePoints: undefined })],
    ["with a Level that isn't a whole number", v10({ level: 2.5 })],
    ["with a Level below 1", v10(progress(0, 0))],
    ["with a Level above 99", v10(progress(100, 3_520_485_254))],
    ["with negative Experience", v10(progress(1, -1))],
    ["with Experience past the cap", v10(progress(99, 3_520_485_255))],
    ["with too little Experience for its Level", v10(progress(2, 499))],
    ["with enough Experience for the next Level", v10(progress(2, 1_500))],
    ["with Dexterity that isn't a whole number", v10({ dexterity: 20.5 })],
    ["with Vitality below where a Hero starts", v10({ vitality: 19 })],
    ["without Energy", v10({ energy: undefined })],
    ["with Energy below where a Hero starts", v10({ energy: 19 })],
    ["with more Energy than its Level gave", v10({ energy: 21 })],
    ["with negative unspent points", v10({ attributePoints: -1 })],
    ["with more points than its Level gave", v10({ attributePoints: 6 })],
    ["with fewer points than its Level gave", v10({ attributePoints: 4 })],
    ["with more spent than its Level gave", v10({ strength: 21 })],
    ["without unspent Skill Points", v10({ skillPoints: undefined })],
    ["without Skill Levels", v10({ skillLevels: undefined })],
    ["with Skill Levels that aren't an object", v10({ skillLevels: [1] })],
    [
      "with a Skill Level that isn't a whole number",
      v10({ skillPoints: 0.5, skillLevels: { golem: 0.5 } }),
    ],
    [
      "with a negative Skill Level",
      v10({ skillPoints: 2, skillLevels: { golem: -1 } }),
    ],
    [
      "with negative unspent Skill Points",
      v10({ skillPoints: -1, skillLevels: { golem: 2 } }),
    ],
    ["with more Skill Points than its Level gave", v10({ skillPoints: 2 })],
    ["with fewer Skill Points than its Level gave", v10({ skillPoints: 0 })],
    [
      "with more Skill Levels than its Level gave",
      v10({ skillPoints: 0, skillLevels: { golem: 2 } }),
    ],
    [
      "with an unknown Skill",
      v10({ skillPoints: 0, skillLevels: { golem: 0, teeth: 1 } }),
    ],
    ["without a Skill Bar", v10({ skillBar: undefined })],
    ["with a Skill Bar that isn't an object", v10({ skillBar: [null] })],
    ["with a Skill Bar slot missing", v10({ skillBar: { right: null } })],
    [
      "with an unknown Skill Bar slot",
      v10({ skillBar: { ...emptySkillBar(), key5: null } }),
    ],
    [
      "with an unknown Skill on the Skill Bar",
      v10({ skillBar: { ...emptySkillBar(), key1: "teeth" } }),
    ],
    [
      "with a Passive Skill on the Skill Bar",
      v10({
        skillPoints: 0,
        skillLevels: { ossifiedWill: 1 },
        skillBar: { ...emptySkillBar(), key1: "ossifiedWill" },
      }),
    ],
    [
      "with a Skill in two Skill Bar slots",
      v10({
        skillPoints: 0,
        skillLevels: { golem: 1 },
        skillBar: { ...emptySkillBar(), right: "golem", key2: "golem" },
      }),
    ],
    ["without an Inventory", v10({ inventory: undefined })],
    ["without Equipment", v10({ equipment: undefined })],
    ["with an Inventory that isn't a list", v10({ inventory: {} })],
    ["with Equipment that isn't an object", v10({ equipment: [] })],
    [
      "with an unknown Item type",
      v10({ inventory: [{ type: "bow", cell: { column: 0, row: 0 } }] }),
    ],
    ["with an Item without a cell", v10({ inventory: [{ type: "axe" }] })],
    [
      "with an Item off the grid's left",
      v10({ inventory: [{ type: "axe", cell: { column: -1, row: 0 } }] }),
    ],
    [
      // The Axe is 2×3: from column 9 it hangs off the right edge.
      "with an Item hanging off the grid's right",
      v10({ inventory: [{ type: "axe", cell: { column: 9, row: 0 } }] }),
    ],
    [
      // The Short Sword is 1×3: from row 2 it hangs off the bottom.
      "with an Item hanging off the grid's bottom",
      v10({ inventory: [{ type: "shortSword", cell: { column: 0, row: 2 } }] }),
    ],
    [
      "with an Item at a cell that isn't whole",
      v10({
        inventory: [{ type: "ringOfLife", cell: { column: 0.5, row: 0 } }],
      }),
    ],
    [
      "with overlapping Items",
      v10({
        inventory: [
          { type: "axe", cell: { column: 0, row: 0 } },
          { type: "ringOfLife", cell: { column: 1, row: 2 } },
        ],
      }),
    ],
    [
      "with an Item in a slot of another kind",
      v10({ equipment: { weapon: "leatherArmour" } }),
    ],
    ["with a Ring as the Amulet", v10({ equipment: { amulet: "ringOfLife" } })],
    ["with an unknown slot", v10({ equipment: { helm: "chainMail" } })],
    ["with an unknown Equipped type", v10({ equipment: { weapon: "bow" } })],
    ["without a Belt", v10({ belt: undefined })],
    ["with a Belt that isn't a list", v10({ belt: {} })],
    ["with three Belt Columns", v10({ belt: [[], [], []] })],
    ["with a Belt Column that isn't a list", v10({ belt: [[], [], [], 1] })],
    [
      "with more Potions in a Belt Column than it holds",
      v10({ belt: [["lifePotion", "lifePotion"], [], [], []] }),
    ],
    [
      "with more Potions in a Belt Column than the Equipped Belt's rows",
      v10({
        equipment: { weapon: "shortSword", belt: "sash" },
        belt: [["lifePotion", "lifePotion", "lifePotion"], [], [], []],
      }),
    ],
    [
      "with a Belt that isn't one in the Belt slot",
      v10({ equipment: { weapon: "shortSword", belt: "chainMail" } }),
    ],
    [
      "with an Item that isn't a Potion in the Belt",
      v10({ belt: [["axe"], [], [], []] }),
    ],
    [
      "with an unknown type in the Belt",
      v10({ belt: [["elixir"], [], [], []] }),
    ],
  ])("gives no Save for text %s", (_, text) => {
    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for another version", () => {
    expect(parseSave(stored(5, fields(progress(2, 500))))).toBeNull();
    expect(parseSave(stored(13, fields(progress(2, 500))))).toBeNull();
  });

  // What Saves before Waypoints held: the Hero loads with only Wockville's
  // Waypoint touched.
  it("loads version 7 text without Waypoints with only Wockville's touched", () => {
    const { touchedWaypoints, quests, smithService, ...before } = progress(
      2,
      500,
    );
    const text = stored(7, { ...before, ...SWORD_V10 });

    expect(parseSave(text)?.progress.touchedWaypoints).toEqual(["town"]);
    expect(parseSave(text)?.progress.level).toBe(2);
  });

  it("still checks the rest of version 7 text", () => {
    const { touchedWaypoints, quests, smithService, ...before } = progress(
      2,
      500,
    );
    const text = stored(7, { ...before, ...SWORD_V10, level: 3 });

    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for version 7 text that has Waypoints", () => {
    expect(parseSave(stored(7, fields(progress(2, 500))))).toBeNull();
  });

  // What Saves before Quests held: every Quest Not given.
  it("loads version 8 text without Quests with every Quest Not given", () => {
    const { quests, smithService, ...before } = progress(2, 500);
    const text = stored(8, { ...before, ...SWORD_V10 });

    expect(parseSave(text)?.progress.quests).toEqual(FRESH_PROGRESS.quests);
    expect(parseSave(text)?.progress.level).toBe(2);
  });

  it("still checks the rest of version 8 text", () => {
    const { quests, smithService, ...before } = progress(2, 500);
    const text = stored(8, { ...before, ...SWORD_V10, level: 3 });

    expect(parseSave(text)).toBeNull();
  });

  it("gives no Save for version 8 text that has Quests", () => {
    expect(parseSave(stored(8, fields(progress(2, 500))))).toBeNull();
  });

  it("keeps how far each Quest has got", () => {
    const quests = {
      ...progress(2, 500).quests,
      "bog-off": { state: "given" as const, count: 2 },
      "spa-day": { state: "ready" as const, count: 1 },
    };
    const saved = { ...progress(2, 500), quests };

    expect(parseSave(encodeSave(save(saved)))).toEqual(save(saved));
  });

  it("accounts for the points a Done Quest gave", () => {
    // Lost Wanderer paid 5 Attribute Points, Bog Off 1 Skill Point.
    const base = progress(2, 500);
    const saved = {
      ...base,
      attributePoints: base.attributePoints + 5,
      skillPoints: base.skillPoints + 1,
      quests: {
        ...base.quests,
        "lost-wanderer": { state: "done" as const, count: 0 },
        "bog-off": { state: "done" as const, count: 3 },
      },
    };

    expect(parseSave(encodeSave(save(saved)))).toEqual(save(saved));
  });

  it("gives no Save for points a Quest that isn't Done couldn't have given", () => {
    const base = progress(2, 500);
    const saved = {
      ...base,
      attributePoints: base.attributePoints + 5,
      quests: {
        ...base.quests,
        "lost-wanderer": { state: "ready" as const, count: 0 },
      },
    };

    expect(parseSave(encodeSave(save(saved)))).toBeNull();
  });

  it.each([
    ["missing", undefined],
    ["a list", []],
    ["holding an unknown Quest", { "wock-off": { state: "done", count: 0 } }],
    ["holding an unknown state", { "bog-off": { state: "lost", count: 0 } }],
    [
      "holding a count that isn't whole",
      { "bog-off": { state: "given", count: 0.5 } },
    ],
    [
      "holding a count past the Quest's parts",
      { "bog-off": { state: "given", count: 4 } },
    ],
    ["holding a negative count", { "bog-off": { state: "given", count: -1 } }],
    ["holding something else than a state", { "bog-off": "done" }],
  ])("gives no Save for Quests %s", (_, quests) => {
    expect(parseSave(v10({ quests }))).toBeNull();
  });

  it("loads a Quest left out as Not given", () => {
    const loaded = parseSave(v10({ quests: {} }));

    expect(loaded?.progress.quests).toEqual(FRESH_PROGRESS.quests);
  });

  it("changes after a Quest is given, counted, ready or done", () => {
    for (const type of ["QuestGiven", "QuestReady", "QuestDone"] as const) {
      expect(changesSave([{ type, quest: "bog-off" }])).toBe(true);
    }
    expect(
      changesSave([{ type: "QuestCounted", quest: "bog-off", count: 1 }]),
    ).toBe(true);
  });

  it("keeps the touched Waypoints", () => {
    const touched = {
      ...progress(2, 500),
      touchedWaypoints: ["town", "soggy-bog"],
    };

    expect(parseSave(encodeSave(save(touched)))).toEqual(save(touched));
  });

  it("always has Wockville's Waypoint touched", () => {
    const text = v10({ touchedWaypoints: ["soggy-bog"] });

    expect(parseSave(text)?.progress.touchedWaypoints).toEqual([
      "town",
      "soggy-bog",
    ]);
  });

  it.each([
    ["missing", undefined],
    ["not a list", "town"],
    ["holding a number", ["town", 3]],
    ["holding an Area twice", ["town", "town"]],
  ])("gives no Save for touched Waypoints %s", (_, touchedWaypoints) => {
    expect(parseSave(v10({ touchedWaypoints }))).toBeNull();
  });

  // What Saves before the Belt held: the Hero loads with an empty Belt.
  it("loads version 6 text without a Belt with an empty Belt", () => {
    const { belt, ...before } = WELL_EQUIPPED;
    const { touchedWaypoints, quests, smithService, ...older } = progress(
      2,
      600,
    );
    const text = stored(6, {
      ...older,
      ...before,
      equipment: Object.fromEntries(
        Object.entries(before.equipment).map(([slot, { type }]) => [
          slot,
          type,
        ]),
      ),
    });

    expect(parseSave(text)).toEqual(
      save(progress(2, 600), { ...before, belt: [[], [], [], []] }),
    );
  });

  it("still checks the rest of version 6 text", () => {
    const { touchedWaypoints, quests, smithService, ...older } = progress(
      2,
      600,
    );
    const text = stored(6, {
      ...older,
      ...SWORD_V10,
      belt: undefined,
      equipment: { weapon: "bow" },
    });

    expect(parseSave(text)).toBeNull();
  });

  // What Saves before the Skill Bar held: no migration, so a Hero from then
  // starts afresh.
  it("gives no Save for version 5 text without a Skill Bar", () => {
    const { skillBar, ...before } = progress(2, 500);
    expect(parseSave(stored(5, { ...before, ...SWORD_V10 }))).toBeNull();
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
    expect(parseSave(stored(4, { ...before, ...SWORD_V10 }))).toBeNull();
  });
});

describe("the Smith's service and bonuses", () => {
  const doneSpa = {
    ...FRESH_PROGRESS.quests,
    "spa-day": { state: "done" as const, count: 1 },
  };

  it("keeps the service unlocked or used", () => {
    for (const smithService of ["unlocked", "used"] as const) {
      const kept = {
        ...progress(2, 500),
        quests: doneSpa,
        smithService,
      };
      expect(parseSave(encodeSave(save(kept)))).toEqual(save(kept));
    }
  });

  it.each([
    ["missing", undefined],
    ["unknown", "broken"],
    ["a number", 1],
  ])("gives no Save for a service %s", (_, smithService) => {
    expect(parseSave(v10({ smithService }))).toBeNull();
  });

  it("gives no Save for an unlocked service while Spa Day isn't Done", () => {
    expect(parseSave(v10({ smithService: "unlocked" }))).toBeNull();
    expect(parseSave(v10({ smithService: "used" }))).toBeNull();
  });

  it("gives no Save for a locked service once Spa Day is Done", () => {
    expect(parseSave(v10({ quests: doneSpa }))).toBeNull();
  });

  it("keeps a Smith bonus on Equipped and carried Items", () => {
    const belongings: Belongings = {
      ...SWORD_ONLY,
      inventory: [
        {
          type: "chainMail",
          cell: { column: 2, row: 1 },
          smithBonus: { bonus: "defense", amount: 12 },
        },
      ],
      equipment: {
        weapon: {
          type: "shortSword",
          smithBonus: { bonus: "strength", amount: 4 },
        },
      },
    };
    const kept = {
      ...progress(2, 500),
      quests: doneSpa,
      smithService: "used" as const,
    };

    expect(parseSave(encodeSave(save(kept, belongings)))).toEqual(
      save(kept, belongings),
    );
  });

  it("loads text with no Smith bonuses as having none", () => {
    expect(
      parseSave(v10({}))?.belongings.equipment.weapon?.smithBonus,
    ).toBeUndefined();
  });

  it("folds a version 10 Save's Smith bonuses into its slots", () => {
    const loaded = parseSave(
      v10({ smithBonuses: { weapon: { bonus: "strength", amount: 4 } } }),
    );

    expect(loaded?.belongings.equipment.weapon).toEqual({
      type: "shortSword",
      smithBonus: { bonus: "strength", amount: 4 },
    });
  });

  it.each([
    [
      "on a Ring",
      {
        inventory: [
          {
            type: "ringOfLife",
            cell: { column: 0, row: 0 },
            smithBonus: { bonus: "life", amount: 5 },
          },
        ],
      },
    ],
    [
      "of an unknown kind",
      { smithBonuses: { weapon: { bonus: "luck", amount: 5 } } },
    ],
    [
      "that isn't whole",
      { smithBonuses: { weapon: { bonus: "strength", amount: 1.5 } } },
    ],
    [
      "that isn't positive",
      { smithBonuses: { weapon: { bonus: "strength", amount: 0 } } },
    ],
    [
      "in an empty slot",
      { smithBonuses: { armour: { bonus: "defense", amount: 5 } } },
    ],
    [
      "in a slot that isn't a Weapon or Armour",
      {
        equipment: { weapon: "shortSword", amulet: "amuletOfVitality" },
        smithBonuses: { amulet: { bonus: "life", amount: 5 } },
      },
    ],
    ["not an object", { smithBonuses: [] }],
  ])("gives no Save for a Smith bonus %s", (_, changes) => {
    expect(parseSave(v10(changes))).toBeNull();
  });

  it("changes after the Smith gives a bonus", () => {
    expect(
      changesSave([
        {
          type: "SmithBonusGiven",
          item: 1,
          bonus: { bonus: "strength", amount: 4 },
        },
      ]),
    ).toBe(true);
  });

  // What Saves before the Smith's service held: it is unlocked if Spa Day is Done.
  it("loads version 9 text with the service unlocked once Spa Day is Done", () => {
    const { smithService, ...before } = progress(2, 500);
    const done = stored(9, { ...before, ...SWORD_V10, quests: doneSpa });
    const notDone = stored(9, { ...before, ...SWORD_V10 });

    expect(parseSave(done)?.progress.smithService).toBe("unlocked");
    expect(parseSave(notDone)?.progress.smithService).toBe("locked");
  });

  it("gives no Save for version 9 text that has the service", () => {
    expect(parseSave(stored(9, fields(progress(2, 500))))).toBeNull();
  });
});

describe("an older Save's named Rings and Amulet", () => {
  it.each([
    ["ringOfStrength", "ring1", "ring", "strength", 5, 1],
    ["ringOfDexterity", "ring2", "ring", "dexterity", 5, 1],
    ["ringOfLife", "ring1", "ring", "life", 10, 0],
    ["amuletOfVitality", "amulet", "amulet", "vitality", 5, 1],
  ] as const)("load %s worn as a Magic %s with one %s Affix", (old, slot, type, kind, value, grade) => {
    const loaded = parseSave(v10({ equipment: { [slot]: old } }));
    expect(loaded?.belongings.equipment[slot]).toEqual({
      type,
      rarity: "magic",
      affixes: [{ kind, grade, value }],
    });
    expect(affixTuning[kind].grades[grade].range[0]).toBeLessThanOrEqual(value);
  });

  it("load carried ones the same way", () => {
    const loaded = parseSave(
      v10({ inventory: [{ type: "ringOfLife", cell: { column: 0, row: 0 } }] }),
    );
    expect(loaded?.belongings.inventory).toEqual([
      {
        type: "ring",
        rarity: "magic",
        affixes: [{ kind: "life", grade: 0, value: 10 }],
        cell: { column: 0, row: 0 },
      },
    ]);
  });
});

/** The stored fields of a Save of `progress` with only the Short Sword. */
function fields(kept: Omit<Progress, "energy">): object {
  return { ...kept, ...SWORD_V10 };
}

/**
 * Version 10 stored text for a Level 2 Hero with 500 Experience, their 5
 * points and 1 Skill Point unspent and only the Short Sword, with `changes`
 * made to it.
 */
function v10(changes: Record<string, unknown>) {
  return stored(10, { ...fields(progress(2, 500)), ...changes });
}

/** Stored text of `version` holding `fields`. */
function stored(version: number | undefined, fields: object): string {
  // Gold came with version 12; older text must not hold it.
  const { gold: _gold, ...older } = fields as { gold?: number };
  return JSON.stringify({
    version,
    ...(version === undefined ? fields : older),
  });
}
