import {
  type Belongings,
  belongingsOf,
  isValidBelongings,
} from "./sim/inventory";
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

/**
 * Raised whenever the stored text changes shape. Text of any other version
 * is no Save, so the Hero starts fresh instead of loading something
 * misread.
 */
export const SAVE_VERSION = 6;

/** What the Save keeps of the Hero: their progress and their Belongings. */
export type HeroSave = { progress: Progress; belongings: Belongings };

/** What the Save would keep of the World's Hero now. */
export function saveOf(world: World): HeroSave {
  return { progress: progressOf(world), belongings: belongingsOf(world) };
}

/** The one key the Save is stored under. */
const SAVE_KEY = "wiablo.save";

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
 * fields, then the Inventory and Equipment by Item type.
 */
export function encodeSave({ progress, belongings }: HeroSave): string {
  return JSON.stringify({
    version: SAVE_VERSION,
    ...progress,
    inventory: belongings.inventory,
    equipment: belongings.equipment,
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
  if (fields.version !== SAVE_VERSION) return null;
  if (!PROGRESS_FIELDS.every((field) => Number.isInteger(fields[field]))) {
    return null;
  }
  const skillLevels = parseSkillLevels(fields.skillLevels);
  if (!skillLevels) return null;
  const skillBar = parseSkillBar(fields.skillBar, skillLevels);
  if (!skillBar) return null;
  const progress = {
    ...Object.fromEntries(
      PROGRESS_FIELDS.map((field) => [field, fields[field]]),
    ),
    skillLevels,
    skillBar,
  } as Progress;
  if (!fitsTable(progress.level, progress.experience)) return null;
  if (!fitsPoints(progress)) return null;
  if (!fitsSkillPoints(progress)) return null;
  const belongings = parseBelongings(fields.inventory, fields.equipment);
  return belongings && { progress, belongings };
}

/**
 * The stored Inventory and Equipment as Belongings, or null when they aren't a
 * list of Item types at cells and an object of Item types by slot, or the
 * Hero couldn't have them.
 */
function parseBelongings(
  inventory: unknown,
  equipment: unknown,
): Belongings | null {
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
  };
  return isValidBelongings(belongings) ? belongings : null;
}

/**
 * The stored Skill Levels, or null when they aren't an object holding a
 * whole number at least 0 for each Skill and nothing else.
 */
function parseSkillLevels(stored: unknown): Record<Skill, number> | null {
  if (typeof stored !== "object" || stored === null) return null;
  if (Array.isArray(stored)) return null;
  const levels = stored as Record<string, unknown>;
  const known = (key: string) => (SKILLS as string[]).includes(key);
  if (!Object.keys(levels).every(known)) return null;
  const fits = (skill: Skill) => {
    const level = levels[skill];
    return Number.isInteger(level) && (level as number) >= 0;
  };
  if (!SKILLS.every(fits)) return null;
  return Object.fromEntries(
    SKILLS.map((skill) => [skill, levels[skill]]),
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
  if (typeof stored !== "object" || stored === null) return null;
  if (Array.isArray(stored)) return null;
  const slots = stored as Record<string, unknown>;
  const known = (key: string) =>
    (SKILL_BAR_SLOTS as readonly string[]).includes(key);
  if (!Object.keys(slots).every(known)) return null;
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

/** The fields of the stored progress that aren't whole numbers. */
type ObjectField = "skillLevels" | "skillBar";

/** Every whole-number field of the stored progress. */
const PROGRESS_FIELDS = (
  Object.keys(FRESH_PROGRESS) as (keyof Progress)[]
).filter(
  (field): field is Exclude<keyof Progress, ObjectField> =>
    field !== "skillLevels" && field !== "skillBar",
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
      heroTuning.attributePointsPerLevel * (progress.level - 1)
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
      heroTuning.skillPointsPerLevel * (progress.level - 1)
  );
}
