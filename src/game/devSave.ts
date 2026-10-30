import { encodeSave, parseSave } from "./save";
import { FRESH_BELONGINGS } from "./sim/inventory";
import { freshQuests, type QuestStates, questPointsOf } from "./sim/quests";
import { smithQuestDone } from "./sim/smith";
import {
  ATTRIBUTES,
  type Attribute,
  FRESH_PROGRESS,
  levelExperience,
  type Progress,
  SKILLS,
  type Skill,
} from "./sim/world";
import { heroTuning } from "./tuning/hero";

/**
 * What a playtest asks of `loadSave`. Everything left out is a New Hero's.
 * The Attributes are the values wanted, not the points raised.
 */
export type SaveOptions = Partial<Record<Attribute, number>> & {
  level?: number;
  gold?: number;
  skillLevels?: Partial<Record<Skill, number>>;
  quests?: Partial<QuestStates>;
  /** The touched Waypoints; Wockville's always is. */
  waypoints?: string[];
};

/**
 * Save text for a Hero with the progress `options` ask for, at the current
 * Save version. Unspent Attribute Points and Skill Points are what the Level
 * and the Done Quests gave, less what was asked for. Throws when that is more
 * than they gave, or when the game would refuse the text. Dev builds only:
 * see `GameCanvas`.
 */
export function buildSave(options: SaveOptions = {}): string {
  const level = options.level ?? FRESH_PROGRESS.level;
  const quests: QuestStates = { ...freshQuests(), ...options.quests };
  const skillLevels = {
    ...FRESH_PROGRESS.skillLevels,
    ...options.skillLevels,
  };
  const given = questPointsOf(quests);

  const attributes = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      options[attribute] ?? FRESH_PROGRESS[attribute],
    ]),
  ) as Record<Attribute, number>;
  const raised = ATTRIBUTES.reduce(
    (sum, attribute) => sum + attributes[attribute] - FRESH_PROGRESS[attribute],
    0,
  );
  const attributePoints =
    heroTuning.attributePointsPerLevel * (level - 1) +
    given.attributePoints -
    raised;
  if (attributePoints < 0) {
    throw new Error(
      `Attribute Points: ${-attributePoints} more raised than Level ${level} gives`,
    );
  }
  const spent = SKILLS.reduce((sum, skill) => sum + skillLevels[skill], 0);
  const skillPoints =
    heroTuning.skillPointsPerLevel * (level - 1) + given.skillPoints - spent;
  if (skillPoints < 0) {
    throw new Error(
      `Skill Points: ${-skillPoints} more Skill Levels than Level ${level} gives`,
    );
  }

  const progress: Progress = {
    ...FRESH_PROGRESS,
    ...attributes,
    level,
    experience: levelExperience(level),
    gold: options.gold ?? FRESH_PROGRESS.gold,
    attributePoints,
    skillPoints,
    skillLevels,
    skillBar: { ...FRESH_PROGRESS.skillBar },
    touchedWaypoints: [
      ...new Set([
        ...FRESH_PROGRESS.touchedWaypoints,
        ...(options.waypoints ?? []),
      ]),
    ],
    quests,
    smithService: smithQuestDone(quests) ? "unlocked" : "locked",
  };
  const text = encodeSave({ progress, belongings: FRESH_BELONGINGS });
  if (!parseSave(text)) throw new Error("invalid Save");
  return text;
}
