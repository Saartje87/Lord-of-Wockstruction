import { isValidGear } from "./sim/inventory";
import {
  ATTRIBUTES,
  FRESH_PROGRESS,
  type Gear,
  gearOf,
  levelExperience,
  nextLevelExperience,
  type Progress,
  progressOf,
  type SimEvent,
  type World,
} from "./sim/world";
import { heroTuning } from "./tuning/hero";

/**
 * Raised whenever the stored text changes shape. Text of any other version
 * is no Save, so the Hero starts fresh instead of loading something
 * misread.
 */
export const SAVE_VERSION = 3;

/** What the Save keeps of the Hero: their progress and their gear. */
export type HeroSave = { progress: Progress; gear: Gear };

/** What the Save would keep of the World's Hero now. */
export function saveOf(world: World): HeroSave {
  return { progress: progressOf(world), gear: gearOf(world) };
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
const PROGRESS_EVENTS: readonly SimEvent["type"][] = [
  "ExperienceGained",
  "LevelReached",
  "AttributeRaised",
  "ItemPickedUp",
];

/** Whether a step's events changed what the Save keeps: progress or gear. */
export function changesProgress(events: SimEvent[]): boolean {
  return events.some((event) => PROGRESS_EVENTS.includes(event.type));
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
export function encodeSave({ progress, gear }: HeroSave): string {
  return JSON.stringify({
    version: SAVE_VERSION,
    ...progress,
    inventory: gear.inventory,
    equipment: gear.equipment,
  });
}

/**
 * Stored text as the Hero, or null for no Save: missing, corrupt or another
 * version's text, a Level and Experience that don't fit the Experience
 * table, Attributes and unspent points that don't fit the Level, or gear
 * the Hero couldn't have (see `isValidGear`).
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
  const progress = Object.fromEntries(
    PROGRESS_FIELDS.map((field) => [field, fields[field]]),
  ) as Progress;
  if (!fitsTable(progress.level, progress.experience)) return null;
  if (!fitsPoints(progress)) return null;
  const gear = parseGear(fields.inventory, fields.equipment);
  return gear && { progress, gear };
}

/**
 * The stored Inventory and Equipment as gear, or null when they aren't a
 * list of Item types at cells and an object of Item types by slot, or the
 * Hero couldn't have them.
 */
function parseGear(inventory: unknown, equipment: unknown): Gear | null {
  if (!Array.isArray(inventory)) return null;
  if (typeof equipment !== "object" || equipment === null) return null;
  if (Array.isArray(equipment)) return null;
  const placed: Gear["inventory"] = [];
  for (const entry of inventory) {
    if (typeof entry !== "object" || entry === null) return null;
    const { type, cell } = entry;
    if (typeof cell !== "object" || cell === null) return null;
    placed.push({ type, cell: { column: cell.column, row: cell.row } });
  }
  const gear: Gear = { inventory: placed, equipment: { ...equipment } };
  return isValidGear(gear) ? gear : null;
}

/** Every field of the stored progress, each a whole number. */
const PROGRESS_FIELDS = Object.keys(FRESH_PROGRESS) as (keyof Progress)[];

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
