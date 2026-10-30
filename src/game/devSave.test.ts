import { describe, expect, it } from "vitest";
import { buildSave } from "./devSave";
import { parseSave, SAVE_VERSION } from "./save";
import type { BeltTypes } from "./sim/belt";
import { FRESH_BELONGINGS, type StoredItem } from "./sim/inventory";
import { QUEST_IDS, questPointsOf } from "./sim/quests";
import { FRESH_PROGRESS, levelExperience, SKILLS } from "./sim/world";
import { heroTuning } from "./tuning/hero";
import { inventoryTuning, itemTuning } from "./tuning/items";
import { questTuning } from "./tuning/quests";

/** What the game would load from the built text. */
function loaded(options: Parameters<typeof buildSave>[0] = {}) {
  const save = parseSave(buildSave(options));
  if (!save) throw new Error("not loadable");
  return save;
}

/** A Quest whose reward is of `type`. */
function questPaying(type: string) {
  const id = QUEST_IDS.find((quest) => questTuning[quest].reward.type === type);
  if (!id) throw new Error(`no Quest pays ${type}`);
  return id;
}

describe("the dev Save builder", () => {
  it("builds a New Hero at the current Save version from no options", () => {
    expect(JSON.parse(buildSave()).version).toBe(SAVE_VERSION);
    const { progress, belongings } = loaded();
    expect(progress).toEqual(FRESH_PROGRESS);
    expect(belongings).toEqual(FRESH_BELONGINGS);
  });

  it("sets Level with its Experience threshold, and Gold", () => {
    const { progress } = loaded({ level: 30, gold: 500 });
    expect(progress.level).toBe(30);
    expect(progress.experience).toBe(levelExperience(30));
    expect(progress.gold).toBe(500);
  });

  it("sets Attributes and works out the unspent Attribute Points", () => {
    const { progress } = loaded({ level: 3, vitality: 20 });
    expect(progress.vitality).toBe(20);
    expect(progress.strength).toBe(FRESH_PROGRESS.strength);
    const raised = 20 - FRESH_PROGRESS.vitality;
    expect(progress.attributePoints).toBe(
      heroTuning.attributePointsPerLevel * 2 - raised,
    );
  });

  it("sets Skill Levels from the Save's own Skill list and works out Skill Points", () => {
    const [first, second] = SKILLS;
    const { progress } = loaded({
      level: 5,
      skillLevels: { [first]: 2, [second]: 1 },
    });
    expect(progress.skillLevels[first]).toBe(2);
    expect(progress.skillLevels[second]).toBe(1);
    expect(progress.skillPoints).toBe(heroTuning.skillPointsPerLevel * 4 - 3);
  });

  it("sets Quests and Waypoints, Wockville always among them", () => {
    const id = QUEST_IDS[0];
    const { progress } = loaded({
      quests: { [id]: { state: "given", count: 0 } },
      waypoints: ["catacombs"],
    });
    expect(progress.quests[id]).toEqual({ state: "given", count: 0 });
    expect(progress.touchedWaypoints).toEqual(["town", "catacombs"]);
  });

  it("counts what Done Quests paid towards unspent points", () => {
    const attributeQuest = questPaying("attributePoints");
    const skillQuest = questPaying("skillPoints");
    const { progress } = loaded({
      quests: {
        [attributeQuest]: { state: "done", count: 0 },
        [skillQuest]: { state: "done", count: 0 },
      },
    });
    const paid = questPointsOf(progress.quests);
    expect(paid.attributePoints).toBeGreaterThan(0);
    expect(progress.attributePoints).toBe(paid.attributePoints);
    expect(progress.skillPoints).toBe(paid.skillPoints);
  });

  it("unlocks the Smith's service when its Quest is Done", () => {
    const quest = questPaying("smithService");
    const { progress } = loaded({
      quests: { [quest]: { state: "done", count: 0 } },
    });
    expect(progress.smithService).toBe("unlocked");
  });

  it("throws naming Attribute Points and the shortfall when asking for too many", () => {
    const have = heroTuning.attributePointsPerLevel;
    expect(() =>
      buildSave({ level: 2, strength: FRESH_PROGRESS.strength + have + 7 }),
    ).toThrow(/Attribute Points.*\b7\b/);
  });

  it("throws naming Skill Points and the shortfall when asking for too many", () => {
    const have = heroTuning.skillPointsPerLevel;
    expect(() =>
      buildSave({ level: 2, skillLevels: { [SKILLS[0]]: have + 3 } }),
    ).toThrow(/Skill Points.*\b3\b/);
  });

  it("throws invalid Save when the game would refuse the text", () => {
    expect(() => buildSave({ level: 9999 })).toThrow("invalid Save");
    expect(() => buildSave({ waypoints: [""] })).toThrow("invalid Save");
  });

  describe("Items", () => {
    const magicAxe = {
      type: "axe",
      rarity: "magic",
      affixes: [{ kind: "brutality", grade: 1, value: 5 }],
    } satisfies StoredItem;
    const rareSword = {
      type: "shortSword",
      rarity: "rare",
      rareName: "Gloom Fang",
      affixes: [
        { kind: "brutality", grade: 1, value: 5 },
        { kind: "accuracy", grade: 0, value: 15 },
        { kind: "strength", grade: 1, value: 5 },
      ],
    } satisfies StoredItem;

    it("loads a type name as a Normal Item, in Inventory and Equipment", () => {
      const { belongings } = loaded({
        inventory: ["axe"],
        equipment: { armour: "leatherArmour" },
      });
      expect(belongings.inventory).toEqual([
        { type: "axe", cell: { column: 0, row: 0 } },
      ]);
      expect(belongings.equipment.armour).toEqual({ type: "leatherArmour" });
    });

    it("keeps a whole Magic or Rare Item's Rarity, Affixes and Rare name", () => {
      const { belongings } = loaded({
        inventory: [magicAxe],
        equipment: { weapon: rareSword },
      });
      expect(belongings.inventory[0]).toMatchObject(magicAxe);
      expect(belongings.equipment.weapon).toEqual(rareSword);
    });

    it("keeps the New Hero's other Equipment, and empties a slot given null", () => {
      expect(
        loaded({ equipment: { armour: "chainMail" } }).belongings.equipment,
      ).toEqual({
        weapon: { type: "shortSword" },
        armour: { type: "chainMail" },
      });
      expect(
        loaded({ equipment: { weapon: null } }).belongings.equipment,
      ).toEqual({});
    });

    it("places Inventory Items in free cells without overlapping", () => {
      const { inventory } = loaded({
        inventory: ["axe", "chainMail", "ring", "axe"],
      }).belongings;
      expect(inventory).toHaveLength(4);
      const taken = new Set<string>();
      for (const { type, cell } of inventory) {
        const { columns, rows } = itemTuning[type].size;
        for (let c = 0; c < columns; c++) {
          for (let r = 0; r < rows; r++) {
            const key = `${cell.column + c},${cell.row + r}`;
            expect(taken.has(key)).toBe(false);
            taken.add(key);
          }
        }
      }
      expect(inventory[0]?.cell).toEqual({ column: 0, row: 0 });
    });

    it("loads Belt Columns as given", () => {
      const belt: BeltTypes = [
        ["lifePotion", "manaPotion"],
        [],
        ["rejuvenationPotion"],
        [],
      ];
      expect(
        loaded({ equipment: { belt: "heavyBelt" }, belt }).belongings.belt,
      ).toEqual(belt);
    });

    it("throws for an Item that fits nowhere", () => {
      const { columns, rows } = inventoryTuning;
      const many = Array.from(
        { length: columns * rows + 1 },
        () => "ring" as const,
      );
      expect(() => buildSave({ inventory: many })).toThrow(/fits nowhere/);
    });

    it("throws for an Item in the wrong kind of slot", () => {
      expect(() => buildSave({ equipment: { weapon: "ring" } })).toThrow(
        /weapon/,
      );
    });

    it("throws for a whole Item the Affix rules refuse", () => {
      expect(() =>
        buildSave({
          inventory: [{ type: "axe", rarity: "magic", affixes: [] }],
        }),
      ).toThrow(/axe/);
    });
  });
});
