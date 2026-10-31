import type { RolledAffix } from "./sim/affixes";
import { TOWN } from "./sim/area";
import { emptyBelt, isValidBelt } from "./sim/belt";
import {
  type Belongings,
  belongingsOf,
  EQUIPMENT_SLOTS,
  isValidBelongings,
  type SmithBonus,
  type StoredItem,
  savedItem,
  storedOf,
} from "./sim/inventory";
import {
  freshQuests,
  QUEST_IDS,
  type QuestState,
  type QuestStates,
  questPartsOf,
  questPointsOf,
} from "./sim/quests";
import { SKILL_BAR_SLOTS, type SkillBar } from "./sim/skillBar";
import { smithQuestDone } from "./sim/smith";
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
  type SmithService,
  type World,
} from "./sim/world";
import { heroTuning } from "./tuning/hero";
import { AFFIX_KINDS, type AffixKind, affixOf } from "./tuning/items";
import { questTuning } from "./tuning/quests";
import { isPassive } from "./tuning/skills";

/**
 * Raised whenever the stored text changes shape. Text of a version before
 * `OLDEST_LOADABLE_VERSION` or after this one is no Save, so the Hero starts
 * fresh instead of loading something misread; text of the versions between
 * loads through `ADDED_FIELDS`.
 */
export const SAVE_VERSION = 14;

/** The oldest version whose text still loads (the one before the Belt). */
const OLDEST_LOADABLE_VERSION = 6;

/**
 * The fields the versions since `OLDEST_LOADABLE_VERSION` added, each with
 * the version that first wrote it and what text from before it loads with.
 * Older text must not hold the field.
 */
const ADDED_FIELDS: readonly {
  since: number;
  field: string;
  fresh: () => unknown;
}[] = [
  // An empty Belt.
  { since: 7, field: "belt", fresh: emptyBelt },
  // Only Wockville's Waypoint touched.
  {
    since: 8,
    field: "touchedWaypoints",
    fresh: () => [...FRESH_PROGRESS.touchedWaypoints],
  },
  // Every Quest Not given.
  { since: 9, field: "quests", fresh: freshQuests },
  // No Gold.
  { since: 12, field: "gold", fresh: () => 0 },
];

/**
 * The version that added the Smith's service and bonuses: older text loads
 * with the service unlocked if "Spa Day" is Done, else locked, and no Item
 * with a Smith bonus.
 */
const SMITH_SINCE_VERSION = 10;

/**
 * The version that added Rarity and Affixes and saved each Equipment slot
 * as a whole stored Item: older text loads with every Item Normal, its
 * `smithBonuses` side map folded into the slots.
 */
const AFFIXES_SINCE_VERSION = 11;

/**
 * The version that added the Off-hand, Helm, Gloves and Boots slots: older
 * text loads with them empty, and must not hold them.
 */
const NEW_SLOTS_SINCE_VERSION = 13;

/**
 * The version that gave an elemental damage Affix a low and a high value:
 * older text names one value, which loads as the range from it to itself.
 */
const DAMAGE_RANGE_SINCE_VERSION = 14;

/** Whether `kind` is an Affix kind that adds a damage range. */
function isDamageKind(kind: unknown): boolean {
  return (
    AFFIX_KINDS.includes(kind as AffixKind) &&
    !!affixOf(kind as AffixKind).grades[0].highRange
  );
}

/** The Equipment slots that version `NEW_SLOTS_SINCE_VERSION` added. */
const NEW_SLOTS: readonly string[] = ["offHand", "helm", "gloves", "boots"];

/** The states the Smith's service goes through, in order. */
const SMITH_SERVICES: readonly SmithService[] = ["locked", "unlocked", "used"];

/** The Equipment slots, as a Save names them. */
const SLOTS: readonly string[] = EQUIPMENT_SLOTS;

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
  "GoldPickedUp",
  "ItemBought",
  "ItemSold",
  "InventoryChanged",
  "ItemEquipped",
  "ItemUnequipped",
  "BeltChanged",
  "WaypointTouched",
  "QuestGiven",
  "QuestCounted",
  "QuestReady",
  "QuestDone",
  "SmithBonusGiven",
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

/** Stores Save text as it is, replacing the Save (dev builds: see `loadSave`). */
export function writeSaveText(storage: SaveStorage, text: string) {
  storage.set(SAVE_KEY, text);
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
    inventory: belongings.inventory.map((placed) => ({
      ...savedItem(placed),
      cell: placed.cell,
    })),
    equipment: Object.fromEntries(
      Object.entries(belongings.equipment).map(([slot, stored]) => [
        slot,
        savedItem(stored),
      ]),
    ),
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
  const version = fields.version as number;
  if (
    !Number.isInteger(version) ||
    version < OLDEST_LOADABLE_VERSION ||
    version > SAVE_VERSION
  ) {
    return null;
  }
  for (const { since, field, fresh } of ADDED_FIELDS) {
    if (version >= since) continue;
    if (fields[field] !== undefined) return null;
    fields[field] = fresh();
  }
  const smithless = version < SMITH_SINCE_VERSION;
  if (smithless && fields.smithService !== undefined) return null;
  if (!PROGRESS_FIELDS.every((field) => Number.isInteger(fields[field]))) {
    return null;
  }
  const skillLevels = parseSkillLevels(fields.skillLevels);
  if (!skillLevels) return null;
  const skillBar = parseSkillBar(fields.skillBar);
  if (!skillBar) return null;
  const touchedWaypoints = parseTouchedWaypoints(fields.touchedWaypoints);
  if (!touchedWaypoints) return null;
  const quests = parseQuests(fields.quests);
  if (!quests) return null;
  const smithService = parseSmithService(
    smithless ? smithServiceFor(quests) : fields.smithService,
    quests,
  );
  if (!smithService) return null;
  const progress = {
    ...Object.fromEntries(
      PROGRESS_FIELDS.map((field) => [field, fields[field]]),
    ),
    skillLevels,
    skillBar,
    touchedWaypoints,
    quests,
    smithService,
  } as Progress;
  if (progress.gold < 0) return null;
  if (!fitsTable(progress.level, progress.experience)) return null;
  if (!fitsPoints(progress)) return null;
  if (!fitsSkillPoints(progress)) return null;
  const belongings = parseBelongings(
    fields.inventory,
    fields.equipment,
    fields.belt,
    fields.smithBonuses,
    version < AFFIXES_SINCE_VERSION,
    version < NEW_SLOTS_SINCE_VERSION,
    version < DAMAGE_RANGE_SINCE_VERSION,
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
  smithBonuses: unknown,
  older: boolean,
  withoutNewSlots: boolean,
  singleValued: boolean,
): Belongings | null {
  // How many rows the Belt Columns have is checked with the Equipment.
  if (!isValidBelt(belt, Number.POSITIVE_INFINITY)) return null;
  if (!Array.isArray(inventory)) return null;
  if (typeof equipment !== "object" || equipment === null) return null;
  if (Array.isArray(equipment)) return null;
  // Older text has no Off-hand, Helm, Gloves or Boots to hold anything.
  if (
    withoutNewSlots &&
    Object.keys(equipment).some((s) => NEW_SLOTS.includes(s))
  ) {
    return null;
  }
  // Older text kept Smith bonuses apart, by slot; this version has none.
  if (!older && smithBonuses !== undefined) return null;
  if (
    older &&
    smithBonuses !== undefined &&
    !objectWithin(smithBonuses, SLOTS)
  ) {
    return null;
  }
  const bonuses = (smithBonuses ?? {}) as Record<string, unknown>;
  const placed: Belongings["inventory"] = [];
  for (const entry of inventory) {
    if (typeof entry !== "object" || entry === null) return null;
    const { cell } = entry;
    if (typeof cell !== "object" || cell === null) return null;
    const stored = parseStoredItem(entry, older, singleValued);
    if (!stored) return null;
    placed.push({
      ...stored,
      cell: { column: cell.column, row: cell.row },
    });
  }
  const worn: Belongings["equipment"] = {};
  for (const [slot, entry] of Object.entries(equipment)) {
    const stored = older
      ? parseOlderEquipped(entry, bonuses[slot])
      : parseStoredItem(entry, false, singleValued);
    if (!stored) return null;
    worn[slot as keyof typeof worn] = stored;
  }
  // A Smith bonus for an empty slot belongs to nothing.
  if (older && Object.keys(bonuses).some((slot) => !(slot in worn))) {
    return null;
  }
  const belongings: Belongings = {
    inventory: placed,
    equipment: worn,
    belt: belt.map((column) => [...column]),
  };
  if (!isValidBelongings(belongings)) return null;
  return {
    inventory: belongings.inventory.map((item) => ({
      ...storedOf(item),
      cell: item.cell,
    })),
    equipment: Object.fromEntries(
      Object.entries(belongings.equipment).map(([slot, item]) => [
        slot,
        storedOf(item),
      ]),
    ),
    belt: belongings.belt,
  };
}

/**
 * The Rings and Amulet older Saves named, each as the plain type and the
 * one Affix that gives the bonus it had, in the grade whose range holds it.
 */
const NAMED_JEWELLERY: Record<
  string,
  { type: "ring" | "amulet"; affix: RolledAffix }
> = {
  ringOfStrength: {
    type: "ring",
    affix: { kind: "strength", grade: 1, value: 5 },
  },
  ringOfDexterity: {
    type: "ring",
    affix: { kind: "dexterity", grade: 1, value: 5 },
  },
  ringOfLife: { type: "ring", affix: { kind: "life", grade: 0, value: 10 } },
  amuletOfVitality: {
    type: "amulet",
    affix: { kind: "vitality", grade: 1, value: 5 },
  },
};

/**
 * A stored Item as a fresh one, its parts checked with the Belongings, or
 * null when it isn't an object. Text of this version names the Rarity and
 * the Affixes; older text names neither and its Items are Normal.
 */
function parseStoredItem(
  entry: unknown,
  older: boolean,
  singleValued: boolean,
): StoredItem | null {
  if (typeof entry !== "object" || entry === null) return null;
  const { type, rarity, affixes, rareName, smithBonus } = entry as Record<
    string,
    unknown
  >;
  if (older) {
    if (rarity !== undefined || affixes !== undefined || rareName !== undefined)
      return null;
  } else if (rarity === undefined || !Array.isArray(affixes)) {
    return null;
  }
  const named =
    older && typeof type === "string" && Object.hasOwn(NAMED_JEWELLERY, type)
      ? NAMED_JEWELLERY[type]
      : undefined;
  const rolled = (affixes ?? []) as unknown[];
  const item = {
    type: named?.type ?? type,
    rarity: named ? "magic" : (rarity ?? "normal"),
    affixes: named
      ? [{ ...named.affix }]
      : rolled.map((affix) => {
          const { kind, grade, value, high } = (affix ?? {}) as Record<
            string,
            unknown
          >;
          // Older text has one value; an elemental damage Affix's is its range.
          if (singleValued && isDamageKind(kind)) {
            return { kind, grade, value, high: value };
          }
          return { kind, grade, value, ...(high !== undefined && { high }) };
        }),
    ...(rareName !== undefined && { rareName }),
    ...(smithBonus !== undefined && { smithBonus: copyBonus(smithBonus) }),
  } as StoredItem;
  return item;
}

/** An older Save's Equipped Item type, with the Smith bonus kept for its slot. */
function parseOlderEquipped(
  type: unknown,
  smithBonus: unknown,
): StoredItem | null {
  if (typeof type !== "string") return null;
  return parseStoredItem(
    { type, ...(smithBonus !== undefined && { smithBonus }) },
    true,
    false,
  );
}

/** A stored Smith bonus as a fresh object, its parts checked with the Belongings. */
function copyBonus(stored: unknown): SmithBonus {
  const { bonus, amount, skill } = (stored ?? {}) as Record<string, unknown>;
  return {
    bonus,
    amount,
    ...(skill !== undefined && { skill }),
  } as SmithBonus;
}

/** What the service is for Quests that unlock it: unlocked once that Quest is Done. */
function smithServiceFor(quests: QuestStates): SmithService {
  return smithQuestDone(quests) ? "unlocked" : "locked";
}

/**
 * The stored Smith service, or null when it isn't a state, or doesn't fit
 * the Quests: locked until the Quest unlocking it is Done, and then not.
 */
function parseSmithService(
  stored: unknown,
  quests: QuestStates,
): SmithService | null {
  if (!SMITH_SERVICES.includes(stored as SmithService)) return null;
  const locked = stored === "locked";
  return locked === smithQuestDone(quests) ? null : (stored as SmithService);
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
 * and nothing else, every slot empty or holding a cast Skill, none in two
 * slots. A Skill with no learned Skill Level may be on it: a Wand raised it,
 * or did.
 */
function parseSkillBar(stored: unknown): SkillBar | null {
  const slots = objectWithin(stored, SKILL_BAR_SLOTS);
  if (!slots) return null;
  const held: unknown[] = [];
  for (const slot of SKILL_BAR_SLOTS) {
    const skill = slots[slot];
    if (skill === null) continue;
    if (!(SKILLS as unknown[]).includes(skill)) return null;
    // A Passive Skill is never cast, so it has no place on the bar.
    if (isPassive(skill as Skill)) return null;
    if (held.includes(skill)) return null;
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
function parseQuests(stored: unknown): QuestStates | null {
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
    const parts = questPartsOf(questTuning[id].trigger);
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
  "smithService",
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
 * The Attribute Points and Skill Points a Hero has gained at `level` with
 * `quests`: what the Levels gave plus what Done Quests paid.
 */
export function pointsGained(
  level: number,
  quests: QuestStates,
): { attributePoints: number; skillPoints: number } {
  const paid = questPointsOf(quests);
  return {
    attributePoints:
      heroTuning.attributePointsPerLevel * (level - 1) + paid.attributePoints,
    skillPoints:
      heroTuning.skillPointsPerLevel * (level - 1) + paid.skillPoints,
  };
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
      pointsGained(progress.level, progress.quests).attributePoints
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
      pointsGained(progress.level, progress.quests).skillPoints
  );
}
