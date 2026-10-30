import { TOWN } from "./sim/area";
import { emptyBelt, isValidBelt } from "./sim/belt";
import {
  type Belongings,
  belongingsOf,
  isValidBelongings,
} from "./sim/inventory";
import {
  freshQuests,
  partsOf,
  QUEST_IDS,
  type QuestLog,
  type QuestState,
  questPointsOf,
} from "./sim/quests";
import { SKILL_BAR_SLOTS, type SkillBar } from "./sim/skillBar";
import {
  ATTRIBUTES,
  FRESH_PROGRESS,
  levelExperience,
  nextLevelExperience,
  type Progress,
  progressOf,
  type SimEvent,
  SKILLS,
  type Skill,
  type World,
} from "./sim/world";
import { heroTuning } from "./tuning/hero";
import { questTuning } from "./tuning/quests";

/**
 * Raised whenever the stored text changes shape. Text of any other version
 * is no Save, so the Hero starts fresh instead of loading something
 * misread, but for `BELTLESS_VERSION`, `WAYPOINTLESS_VERSION` and
 * `QUESTLESS_VERSION`.
 */
export const SAVE_VERSION = 9;

/**
 * The version before Waypoints: its text, otherwise the same, loads with
 * only Wockville's Waypoint touched.
 */
const WAYPOINTLESS_VERSION = 7;

/**
 * The version before Quests: its text, otherwise the same, loads with every
 * Quest Not given.
 */
const QUESTLESS_VERSION = 8;

/**
 * The version before the Belt: its text, otherwise the same, loads with an
 * empty Belt.
 */
const BELTLESS_VERSION = 6;

/** The states a Quest goes through, in order. */
const QUEST_STATES: readonly QuestState[] = [
  "notGiven",
  "given",
  "ready",
  "done",
];

/** What the Save keeps of the Hero: their progress and their Belongings. */
export type HeroSave = { progress: Progress; belongings: Belongings };

/** What the Save would keep of the World's Hero now. */
export function saveOf(world: World): HeroSave {
  return { progress: progressOf(world), belongings: belongingsOf(world) };
}

/** The one key the Save is stored under. */
const SAVE_KEY = "wockstruction.save";

/**
 * Where the Save is kept: the browser's storage in the game, a Map in
 * tests.
 */
export type SaveStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
};

/** The events after which the Save is written again. */
const SAVE_CHANGING_EVENTS: readonly SimEvent["type"][] = [
  "ExperienceGained",
  "LevelReached",
  "AttributeRaised",
  "SkillLevelRaised",
  "SkillBarChanged",
  "ItemPickedUp",
  "InventoryChanged",
  "ItemEquipped",
  "ItemUnequipped",
  "BeltChanged",
  "WaypointTouched",
  "QuestGiven",
  "QuestCounted",
  "QuestReady",
  "QuestDone",
];

/** Whether a step's events changed what the Save keeps: progress or Belongings. */
export function changesSave(events: SimEvent[]): boolean {
  return events.some((event) => SAVE_CHANGING_EVENTS.includes(event.type));
}

/** The stored Hero, or null for no Save. */
export function readSave(storage: SaveStorage): HeroSave | null {
  return parseSave(storage.get(SAVE_KEY));
}

/** Stores the Hero, replacing the Save. */
export function writeSave(storage: SaveStorage, save: HeroSave) {
  storage.set(SAVE_KEY, encodeSave(save));
}

/** Removes the Save, so the next start is a fresh Hero. */
export function removeSave(storage: SaveStorage) {
  storage.remove(SAVE_KEY);
}

/**
 * The browser's `localStorage`. It can be unavailable or refuse a write (a
 * private window, blocked site data, a full quota); then reads find no Save
 * and writes are dropped, so the game still runs, just without keeping
 * progress.
 */
export function browserStorage(): SaveStorage {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    },
  };
}

/**
 * The Hero as stored text, with the version it was written in: the progress
 * fields, then the Inventory, Equipment and Belt Columns by Item type.
 */
export function encodeSave({ progress, belongings }: HeroSave): string {
  return JSON.stringify({
    version: SAVE_VERSION,
    ...progress,
    inventory: belongings.inventory,
    equipment: belongings.equipment,
    belt: belongings.belt,
  });
}

/**
 * Stored text as the Hero, or null for no Save: missing, corrupt or another
 * version's text, a Level and Experience that don't fit the Experience
 * table, Attributes and unspent points or Skill Levels and unspent Skill
 * Points that don't fit the Level, a Skill Bar holding anything but learned
 * Skills each in one slot, or Belongings the Hero couldn't have (see
 * `isValidBelongings`).
 */
export function parseSave(text: string | null): HeroSave | null {
  if (text === null) return null;
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof stored !== "object" || stored === null) return null;
  const fields = stored as Record<string, unknown>;
  if (fields.version === BELTLESS_VERSION) {
    if (fields.belt !== undefined) return null;
    fields.belt = emptyBelt();
  }
  if (
    fields.version === BELTLESS_VERSION ||
    fields.version === WAYPOINTLESS_VERSION
  ) {
    if (fields.touchedWaypoints !== undefined) return null;
    fields.touchedWaypoints = [...FRESH_PROGRESS.touchedWaypoints];
  }
  if (
    fields.version === BELTLESS_VERSION ||
    fields.version === WAYPOINTLESS_VERSION ||
    fields.version === QUESTLESS_VERSION
  ) {
    if (fields.quests !== undefined) return null;
    fields.quests = freshQuests();
  } else if (fields.version !== SAVE_VERSION) {
    return null;
  }
  if (!PROGRESS_FIELDS.every((field) => Number.isInteger(fields[field]))) {
    return null;
  }
  const skillLevels = parseSkillLevels(fields.skillLevels);
  if (!skillLevels) return null;
  const skillBar = parseSkillBar(fields.skillBar, skillLevels);
  if (!skillBar) return null;
  const touchedWaypoints = parseTouchedWaypoints(fields.touchedWaypoints);
  if (!touchedWaypoints) return null;
  const quests = parseQuests(fields.quests);
  if (!quests) return null;
  const progress = {
    ...Object.fromEntries(
      PROGRESS_FIELDS.map((field) => [field, fields[field]]),
    ),
    skillLevels,
    skillBar,
    touchedWaypoints,
    quests,
  } as Progress;
  if (!fitsTable(progress.level, progress.experience)) return null;
  if (!fitsPoints(progress)) return null;
  if (!fitsSkillPoints(progress)) return null;
  const belongings = parseBelongings(
    fields.inventory,
    fields.equipment,
    fields.belt,
  );
  return belongings && { progress, belongings };
}

/**
 * The stored Inventory, Equipment and Belt Columns as Belongings, or null
 * when they aren't a list of Item types at cells, an object of Item types by
 * slot and a list of Potion types per Belt Column, or the Hero couldn't
 * have them.
 */
function parseBelongings(
  inventory: unknown,
  equipment: unknown,
  belt: unknown,
): Belongings | null {
  // How many rows the Belt Columns have is checked with the Equipment.
  if (!isValidBelt(belt, Number.POSITIVE_INFINITY)) return null;
  if (!Array.isArray(inventory)) return null;
  if (typeof equipment !== "object" || equipment === null) return null;
  if (Array.isArray(equipment)) return null;
  const placed: Belongings["inventory"] = [];
  for (const entry of inventory) {
    if (typeof entry !== "object" || entry === null) return null;
    const { type, cell } = entry;
    if (typeof cell !== "object" || cell === null) return null;
    placed.push({ type, cell: { column: cell.column, row: cell.row } });
  }
  const belongings: Belongings = {
    inventory: placed,
    equipment: { ...equipment },
    belt: belt.map((column) => [...column]),
  };
  return isValidBelongings(belongings) ? belongings : null;
}

/**
 * The stored Skill Levels, or null when they aren't an object holding a
 * whole number at least 0 for Skills and nothing else. A Skill missing from
 * them, as from a Save written before it was added, is at 0.
 */
function parseSkillLevels(stored: unknown): Record<Skill, number> | null {
  const levels = objectWithin(stored, SKILLS);
  if (!levels) return null;
  const levelOf = (skill: Skill) => levels[skill] ?? 0;
  const fits = (skill: Skill) => {
    const level = levelOf(skill);
    return Number.isInteger(level) && (level as number) >= 0;
  };
  if (!SKILLS.every(fits)) return null;
  return Object.fromEntries(
    SKILLS.map((skill) => [skill, levelOf(skill)]),
  ) as Record<Skill, number>;
}

/**
 * The stored Skill Bar, or null when it isn't an object holding each slot
 * and nothing else, every slot empty or holding a Skill learned in
 * `skillLevels`, none in two slots.
 */
function parseSkillBar(
  stored: unknown,
  skillLevels: Record<Skill, number>,
): SkillBar | null {
  const slots = objectWithin(stored, SKILL_BAR_SLOTS);
  if (!slots) return null;
  const held: unknown[] = [];
  for (const slot of SKILL_BAR_SLOTS) {
    const skill = slots[slot];
    if (skill === null) continue;
    if (!(SKILLS as unknown[]).includes(skill)) return null;
    if (skillLevels[skill as Skill] === 0 || held.includes(skill)) return null;
    held.push(skill);
  }
  return Object.fromEntries(
    SKILL_BAR_SLOTS.map((slot) => [slot, slots[slot]]),
  ) as SkillBar;
}

/**
 * The stored touched Waypoints, or null when they aren't a list of Area
 * names with none twice. Wockville's is always touched.
 */
function parseTouchedWaypoints(stored: unknown): string[] | null {
  if (!Array.isArray(stored)) return null;
  const areas: unknown[] = stored;
  const valid = areas.every(
    (area, i) =>
      typeof area === "string" && area !== "" && areas.indexOf(area) === i,
  );
  if (!valid) return null;
  const names = stored as string[];
  return names.includes(TOWN) ? [...names] : [TOWN, ...names];
}

/**
 * The stored Quests, or null when they aren't an object holding, for Quests
 * and nothing else, a state and a count of parts done that the Quest has. A
 * Quest missing from them is Not given.
 */
function parseQuests(stored: unknown): QuestLog | null {
  const log = objectWithin(stored, QUEST_IDS);
  if (!log) return null;
  const quests = freshQuests();
  for (const id of QUEST_IDS) {
    const quest = log[id];
    if (quest === undefined) continue;
    const entry = objectWithin(quest, ["state", "count"]);
    if (!entry) return null;
    const { state, count } = entry;
    if (!QUEST_STATES.includes(state as QuestState)) return null;
    const parts = partsOf(questTuning[id].trigger);
    if (!Number.isInteger(count) || (count as number) < 0) return null;
    if ((count as number) > parts) return null;
    quests[id] = { state: state as QuestState, count: count as number };
  }
  return quests;
}

/**
 * A stored value as an object, or null when it isn't a plain object with
 * no keys but `keys`.
 */
function objectWithin(
  stored: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (typeof stored !== "object" || stored === null) return null;
  if (Array.isArray(stored)) return null;
  const object = stored as Record<string, unknown>;
  return Object.keys(object).every((key) => keys.includes(key)) ? object : null;
}

/** The fields of the stored progress that aren't whole numbers. */
const OBJECT_FIELDS = [
  "skillLevels",
  "skillBar",
  "touchedWaypoints",
  "quests",
] as const;

type ObjectField = (typeof OBJECT_FIELDS)[number];

/** Every whole-number field of the stored progress. */
const PROGRESS_FIELDS = (
  Object.keys(FRESH_PROGRESS) as (keyof Progress)[]
).filter(
  (field): field is Exclude<keyof Progress, ObjectField> =>
    !(OBJECT_FIELDS as readonly string[]).includes(field),
);

/**
 * Whether a Level and Experience could have been earned: the Experience at
 * least what the Level needs and short of what the next one does.
 */
function fitsTable(level: number, experience: number): boolean {
  if (level < 1 || level > heroTuning.experienceTable.length) return false;
  const next = nextLevelExperience(level);
  // At the last Level, Experience stops at what it needs.
  const most = next === null ? levelExperience(level) : next - 1;
  return experience >= levelExperience(level) && experience <= most;
}

/**
 * Whether the Attributes and unspent points could have come from the Level:
 * no Attribute below where a fresh Hero starts it, and the points spent and
 * unspent adding up to what the Levels gained gave.
 */
function fitsPoints(progress: Progress): boolean {
  const raisedBy = ATTRIBUTES.map(
    (attribute) => progress[attribute] - FRESH_PROGRESS[attribute],
  );
  const raised = raisedBy.reduce((sum, points) => sum + points, 0);
  return (
    raisedBy.every((points) => points >= 0) &&
    progress.attributePoints >= 0 &&
    raised + progress.attributePoints ===
      heroTuning.attributePointsPerLevel * (progress.level - 1) +
        questPointsOf(progress.quests).attributePoints
  );
}

/**
 * Whether the Skill Levels and unspent Skill Points could have come from the
 * Level: the Skill Points spent and unspent adding up to what the Levels
 * gained gave.
 */
function fitsSkillPoints(progress: Progress): boolean {
  const spent = SKILLS.reduce(
    (sum, skill) => sum + progress.skillLevels[skill],
    0,
  );
  return (
    progress.skillPoints >= 0 &&
    spent + progress.skillPoints ===
      heroTuning.skillPointsPerLevel * (progress.level - 1) +
        questPointsOf(progress.quests).skillPoints
  );
}
