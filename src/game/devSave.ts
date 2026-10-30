import { encodeSave, parseSave } from "./save";
import { isValidRoll } from "./sim/affixes";
import type { BeltTypes } from "./sim/belt";
import {
  type Belongings,
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
  FRESH_BELONGINGS,
  firstFreeCell,
  SLOT_KINDS,
  type StoredItem,
} from "./sim/inventory";
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
import { type ItemType, itemTuning } from "./tuning/items";

/** An Item as a playtest names it: a type, for a Normal Item, or a whole one. */
export type ItemSpec = ItemType | StoredItem;

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
  /** Items for the Inventory, each in the first cell it fits. */
  inventory?: ItemSpec[];
  /** Items by slot over a New Hero's; null empties a slot. */
  equipment?: Partial<Record<EquipmentSlot, ItemSpec | null>>;
  /** The Potions in each Belt Column, from the left and each from the bottom up. */
  belt?: BeltTypes;
};

/** An Item spec as a stored Item, throwing when no drop could give it. */
function storedOf(spec: ItemSpec): StoredItem {
  const stored: StoredItem = typeof spec === "string" ? { type: spec } : spec;
  if (!Object.hasOwn(itemTuning, stored.type)) {
    throw new Error(`unknown Item type ${String(stored.type)}`);
  }
  const { rarity = "normal", affixes = [], rareName } = stored;
  if (!isValidRoll(stored.type, rarity, affixes, rareName)) {
    throw new Error(
      `${stored.type}: its Rarity, Affixes or Rare name are not valid`,
    );
  }
  return stored;
}

/** The Belongings the options ask for, over a New Hero's. */
function belongingsOf(options: SaveOptions): Belongings {
  const inventory: Belongings["inventory"] = [];
  for (const spec of options.inventory ?? []) {
    const stored = storedOf(spec);
    const cell = firstFreeCell(inventory, stored.type);
    if (!cell) throw new Error(`${stored.type} fits nowhere in the Inventory`);
    inventory.push({ ...stored, cell });
  }
  const given = options.equipment ?? {};
  for (const slot of Object.keys(given)) {
    if (!EQUIPMENT_SLOTS.includes(slot as EquipmentSlot)) {
      throw new Error(`unknown Equipment slot ${slot}`);
    }
  }
  const equipment: Belongings["equipment"] = {
    ...FRESH_BELONGINGS.equipment,
  };
  for (const slot of EQUIPMENT_SLOTS) {
    const spec = given[slot];
    if (spec === undefined) continue;
    if (spec === null) {
      delete equipment[slot];
      continue;
    }
    const stored = storedOf(spec);
    if (itemTuning[stored.type].kind !== SLOT_KINDS[slot]) {
      throw new Error(
        `${stored.type} is not a ${SLOT_KINDS[slot]}, so not for ${slot}`,
      );
    }
    equipment[slot] = stored;
  }
  return {
    inventory,
    equipment,
    belt: options.belt ?? FRESH_BELONGINGS.belt,
  };
}

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
  const text = encodeSave({ progress, belongings: belongingsOf(options) });
  if (!parseSave(text)) throw new Error("invalid Save");
  return text;
}
