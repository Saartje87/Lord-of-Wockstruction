import { describe, expect, it } from "vitest";
import { buildSave } from "./devSave";
import { parseSave, SAVE_VERSION } from "./save";
import { FRESH_BELONGINGS } from "./sim/inventory";
import { QUEST_IDS, questPointsOf } from "./sim/quests";
import { FRESH_PROGRESS, levelExperience, SKILLS } from "./sim/world";
import { heroTuning } from "./tuning/hero";
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
});
