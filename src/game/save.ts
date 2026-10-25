import {
  ATTRIBUTES,
  FRESH_PROGRESS,
  levelExperience,
  nextLevelExperience,
  type Progress,
  type SimEvent,
} from "./sim/world";
import { heroTuning } from "./tuning/hero";

/**
 * Raised whenever the stored text changes shape. Text of any other version
 * is no Save, so the Hero starts fresh instead of loading something
 * misread.
 */
export const SAVE_VERSION = 2;

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
];

/** Whether a step's events changed the Hero's progress. */
export function changesProgress(events: SimEvent[]): boolean {
  return events.some((event) => PROGRESS_EVENTS.includes(event.type));
}

/** The stored Hero progress, or null for no Save. */
export function readSave(storage: SaveStorage): Progress | null {
  return parseSave(storage.get(SAVE_KEY));
}

/** Stores the Hero's progress, replacing the Save. */
export function writeSave(storage: SaveStorage, progress: Progress) {
  storage.set(SAVE_KEY, encodeSave(progress));
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

/** Hero progress as stored text, with the version it was written in. */
export function encodeSave(progress: Progress): string {
  return JSON.stringify({ version: SAVE_VERSION, ...progress });
}

/**
 * Stored text as Hero progress, or null for no Save: missing, corrupt or
 * another version's text, a Level and Experience that don't fit the
 * Experience table, or Attributes and unspent points that don't fit the
 * Level.
 */
export function parseSave(text: string | null): Progress | null {
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
  return fitsTable(progress.level, progress.experience) && fitsPoints(progress)
    ? progress
    : null;
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
