import { areaTuning } from "../tuning/areas";
import { heroTuning } from "../tuning/hero";
import {
  type Bonus,
  dropTuning,
  itemOf,
  potionDropTuning,
} from "../tuning/items";
import { minionTuning } from "../tuning/minions";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import {
  corpseTuning,
  type RaiseEffect,
  type Skill,
  skillTuning,
} from "../tuning/skills";
import { townPortalTuning } from "../tuning/townPortal";
import { townPortalLook } from "../tuning/townPortalLook";
import {
  type Area,
  exitAt,
  isWalkable,
  loadArea,
  type Spawn,
  TOWN,
} from "./area";
import { type BeltColumns, emptyBelt, putInBelt } from "./belt";
import {
  type Belongings,
  type Cell,
  type CursorItem,
  EQUIPMENT_SLOTS,
  type Equipment,
  type EquipmentSlot,
  emptyEquipment,
  FRESH_BELONGINGS,
  firstFreeCell,
  giveBelongings,
  type Item,
  type ItemId,
  type ItemSpot,
  moveItem,
  type PlacedItem,
  returnCursorItem,
  taken,
} from "./inventory";
import { faceToward, lands } from "./melee";
import {
  type Minion,
  type MinionId,
  type MinionType,
  minionAttackRating,
  minionDamageRange,
  minionDefense,
  minionMaxLife,
  newMinion,
  placeBesideHero,
  stepMinions,
  summonPoint,
} from "./minions";
import {
  killExperience,
  type MonsterOfLevel,
  monsterAttack,
  monsterAttackRating,
  monsterDamageRange,
  monsterDefense,
  monsterMaxLife,
  noticeHit,
  sendHome,
  stepMonsters,
  wanderPause,
} from "./monsters";
import { findPath } from "./path";
import {
  drinkFromBelt,
  drinkItem,
  type PotionEffect,
  type PotionMaxima,
  potionEffectsOf,
  stepPotionEffects,
} from "./potions";
import {
  type AttackNumbers,
  type Projectile,
  stepProjectiles,
} from "./projectiles";
import { createRng, type Rng, random, randomInt } from "./random";
import {
  emptySkillBar,
  placeLearnedSkill,
  putSkillOnBar,
  type SkillBar,
  type SkillBarSlot,
} from "./skillBar";
import { msToSteps, perStep } from "./units";
import { validateAreas } from "./validate";
import { distance, type Vec } from "./vec";
import { stepInDirection } from "./walking";

const EXPERIENCE_TABLE = heroTuning.experienceTable;
/** The most Experience the Hero can have: what the last Level needs. */
const EXPERIENCE_CAP = EXPERIENCE_TABLE[EXPERIENCE_TABLE.length - 1];
const WALK_PER_STEP = perStep(heroTuning.walkSpeed);
/** How many steps a swing takes. */
export const SWING_STEPS = msToSteps(heroTuning.swingMs);
/** The step of a swing on which its hit lands. */
export const HIT_STEP = msToSteps(heroTuning.swingMs * heroTuning.hitAt);
const HITSTOP_STEPS = msToSteps(heroTuning.hitstopMs);
/** How many steps the Hero flinches for. */
export const HERO_FLINCH_STEPS = msToSteps(heroTuning.flinchMs);
const ARC = (heroTuning.arcDegrees * Math.PI) / 180;
/** How many steps dealing or taking damage keeps the Hero In Combat. */
const COMBAT_STEPS = msToSteps(heroTuning.combatMs);
/** Life the Hero regains per step outside In Combat. */
const REGEN_PER_STEP = perStep(heroTuning.regenPerSecond);
/** Mana the Hero regains per step, In Combat or not. */
const MANA_REGEN_PER_STEP = perStep(heroTuning.manaRegenPerSecond);
/** How many steps the Hero lies dead before `Continue` is heeded. */
export const DEATH_STEPS = msToSteps(heroTuning.deathMs);
/** How many steps walking through an Exit takes. */
export const AREA_CHANGE_STEPS = msToSteps(areaTuning.changeMs);
/** How many steps going through a Town Portal takes. */
const TOWN_PORTAL_CHANGE_STEPS = msToSteps(townPortalLook.flashMs);
/** How many steps each Monster type flinches for. */
export const FLINCH_STEPS = Object.fromEntries(
  Object.entries(monsterTuning).map(([type, tuning]) => [
    type,
    msToSteps(tuning.flinchMs),
  ]),
) as Record<MonsterType, number>;
/** How many steps a cast of each Skill roots the Hero for. */
export const CAST_STEPS = Object.fromEntries(
  Object.entries(skillTuning).map(([skill, tuning]) => [
    skill,
    msToSteps(tuning.castMs),
  ]),
) as Record<Skill, number>;

/** How many steps opening a Town Portal roots the Hero for. */
export const OPENING_STEPS = msToSteps(townPortalTuning.openingMs);

export type { Minion, MinionId, MinionType, SkillBar, SkillBarSlot };
export type { Projectile };
export { minionMaxLife, potionEffectsOf };

export type Hero = {
  life: number;
  /** Never kept by the Save: full on load and on each new Level. */
  mana: number;
  /** Level, Experience and Attributes, kept by the Save. */
  progress: Progress;
  /** The Items carried, none overlapping, kept by the Save. */
  inventory: PlacedItem[];
  /** The Items worn, kept by the Save. */
  equipment: Equipment;
  /** The Potions in the Belt Columns, kept by the Save (see `beltOf`). */
  belt: BeltColumns;
  /** The drunk Potions still running their course; all end on Death. */
  potionEffects: PotionEffect[];
  /**
   * The Item held on the cursor, if any. The Save keeps it at the cell it
   * was lifted from.
   */
  cursor: CursorItem | null;
  pos: Vec;
  /** Where the Hero was one step ago, for the renderer to interpolate from. */
  prevPos: Vec;
  /** Waypoints still to walk through, in order; empty when standing. */
  path: Vec[];
  /**
   * Which way the Hero faces, in radians in tile space: `atan2(dy, dx)` of
   * the direction last walked or swung.
   */
  facing: number;
  /** The Monster the Hero is walking into reach of, to swing at. */
  attacking: MonsterId | null;
  /** The Ground Item the Hero is walking to, to pick up. */
  pickingUp: ItemId | null;
  swing: Swing | null;
  /** The cast rooting the Hero, if any. */
  cast: Cast | null;
  /** The Town Portal opening, rooting the Hero as a cast does, if any. */
  opening: Opening | null;
  /** Steps of flinching left; 0 when not flinching. */
  flinch: number;
  /**
   * Steps left in which damage dealt or taken keeps the Hero In Combat,
   * counting through hitstop and Area changes; 0 once it no longer does.
   */
  combat: number;
  /**
   * The order given during a swing, a cast or a flinch, run when it ends;
   * the newest wins.
   */
  buffered: Order | null;
};

/** A Skill being cast: its effect happened as it started. */
export type Cast = {
  skill: Skill;
  /** Steps since the cast started, not counting hitstop. */
  elapsed: number;
};

/** A Town Portal opening: it opens once `OPENING_STEPS` have passed. */
export type Opening = {
  /** Steps since the opening started, not counting hitstop. */
  elapsed: number;
};

export type Swing = {
  /** Steps since the swing started, not counting hitstop. */
  elapsed: number;
  /** Whether its hit has landed yet. */
  landed: boolean;
  /** The Monster an `Attack` swings at, or null for a `SwingAt` arc. */
  monster: MonsterId | null;
};

export type MonsterId = number;

export type Monster = {
  /** Unique within the World and never reused. */
  id: MonsterId;
  type: MonsterType;
  /**
   * Its Monster Level, which scales its Life, damage, Attack Rating, Defense
   * and Experience: its Area's Area Level when it spawned.
   */
  monsterLevel: number;
  pos: Vec;
  prevPos: Vec;
  life: number;
  /** Steps of flinching left; 0 when not flinching. */
  flinch: number;
  state: MonsterState;
  /**
   * Which way it faces, in radians in tile space: the direction it last
   * walked, or its target's as it started winding up.
   */
  facing: number;
  /**
   * Who it last went after: the nearest of the Hero and their Minions. A
   * wind-up resolves against this one.
   */
  target: MonsterTarget;
  /**
   * While winding up, steps into the wind-up; while recovering, steps left
   * rooted.
   */
  attack: number;
  /** Steps left before it can wind up again. */
  cooldown: number;
  /** Where it was placed: it strolls around here and walks back here. */
  home: Vec;
  /**
   * Waypoints around walls to where it is going, empty on a clear line; or,
   * while wandering, the one point it strolls to.
   */
  path: Vec[];
  /** Steps until it re-plans `path`. */
  replan: number;
  /** Steps left in which it can't notice the Hero, after getting home. */
  grace: number;
  /** While idle, steps left before it strolls again. */
  pause: number;
};

/** Who a Monster goes after: the Hero, or one of their Minions. */
export type MonsterTarget = "hero" | MinionId;

/**
 * `idle` and `wander` stroll around the spawn, `chase` goes after the nearest
 * of the Hero and their Minions, `windup` telegraphs an attack on it,
 * `recover` stands rooted after it and `return` walks home after giving up,
 * ignoring both.
 */
export type MonsterState =
  | "idle"
  | "wander"
  | "chase"
  | "windup"
  | "recover"
  | "return";

/**
 * Walking through an Exit to Entry `entry` in Area `area`, or through a Town
 * Portal to Area `area`, beside its end there. The World stands still and
 * orders are ignored until it ends.
 */
export type AreaChange = {
  area: string;
  /** The Entry the Hero arrives at, or null through a Town Portal. */
  entry: string | null;
  /** Steps since the Hero walked into the Exit. */
  elapsed: number;
};

/**
 * The Hero lying dead. Orders are ignored but `Continue`, which goes back to
 * Town once `DEATH_STEPS` have passed.
 */
export type Death = {
  /** Steps since the Hero died. */
  elapsed: number;
};

/**
 * The Hero's one Town Portal: its end in Combat Area `area` stands at `pos`,
 * its Town end at Town's Town Portal spot. `area` is the Kept Area: `kept`
 * holds what it held as the Hero left it, while they are away.
 */
export type TownPortal = { area: string; pos: Vec; kept: KeptArea | null };

/**
 * What the Kept Area held as the Hero left it, set aside unchanged: nothing
 * in it is stepped until they arrive there again (ADR 0003).
 */
export type KeptArea = Pick<
  World,
  "monsters" | "projectiles" | "corpses" | "groundItems"
>;

/** What remains of a dead Monster: inert, not clickable, not blocking. */
export type Corpse = { id: MonsterId; type: MonsterType; pos: Vec };

/**
 * An Item lying in the active Area, until picked up or the Hero leaves, but
 * for the Kept Area.
 */
export type GroundItem = { item: Item; pos: Vec };

export type World = {
  seed: number;
  /** All randomness comes from here, so a seed and orders replay exactly. */
  rng: Rng;
  /** Steps taken since the World was created, hitstop included. */
  tick: number;
  /** Steps left in which the whole simulation stands still. */
  hitstop: number;
  /** Orders given during hitstop, applied once it ends. */
  heldOrders: Order[];
  areas: Record<string, Area>;
  /** The one active Area. */
  areaName: string;
  /** The Area change in progress, if any. */
  areaChange: AreaChange | null;
  hero: Hero;
  /** Set while the Hero lies dead. */
  death: Death | null;
  /** The living Monsters in the active Area. */
  monsters: Monster[];
  /** The Projectiles in flight in the active Area. */
  projectiles: Projectile[];
  /** The Corpses in the active Area. */
  corpses: Corpse[];
  /** The Ground Items in the active Area, never kept by the Save. */
  groundItems: GroundItem[];
  /**
   * The Hero's living Minions, oldest first; never kept by the Save.
   */
  minions: Minion[];
  /** The Hero's Town Portal, if open; never kept by the Save. */
  townPortal: TownPortal | null;
  /** The id the next Monster gets. */
  nextMonsterId: MonsterId;
  /** The id the next Minion gets. */
  nextMinionId: MinionId;
  /** The id the next Item gets. */
  nextItemId: ItemId;
};

/** Input reaching the simulation. */
export type Order =
  | { type: "MoveTo"; target: Vec }
  /**
   * Walk one step at walking speed in `direction` (its length doesn't
   * matter), sliding along a wall in the way. Given each step the Hero is
   * to keep walking: on a step without it the Hero stands, as with a zero
   * `direction`.
   */
  | { type: "Walk"; direction: Vec }
  /** Walk into reach of a Monster and swing at it. */
  | { type: "Attack"; monster: MonsterId }
  /** Swing in place towards a point, hitting every Monster in the arc. */
  | { type: "SwingAt"; target: Vec }
  /**
   * Lift the Inventory Item covering cell `from`, the Item Equipped in slot
   * `from` or the Potion in Belt Column cell `from` (the ones above dropping
   * down a row), onto the cursor, if it's empty. This and the other orders
   * moving Items happen at once, whatever the Hero is doing.
   */
  | { type: "LiftItem"; from: ItemSpot }
  /**
   * Put the cursor Item down with its top-left at cell `to`, into slot
   * `to`, or into the Belt Column of Belt Column cell `to` at its lowest
   * free row: into free cells or an empty slot, or over exactly one Item,
   * which is swapped onto the cursor. Refused off the grid, over two or
   * more Items, into a slot of another kind, into the Belt for anything but
   * a Potion or into a full Belt Column, or when a swapped-out Item
   * couldn't go back anywhere (see `placement`).
   */
  | { type: "PlaceItem"; to: ItemSpot }
  /** Lay the cursor Item on the ground at the Hero's feet. */
  | { type: "DropItem" }
  /**
   * Put the cursor Item back where it was lifted from, as when the Inventory
   * panel closes. Death and leaving the Area do the same by themselves.
   */
  | { type: "ReturnCursorItem" }
  /**
   * Equip the Inventory Item `item` into the slot of its kind (a Ring into
   * the first empty Ring slot, else the left one), whatever was there going
   * into the space it leaves (see `equipItem`). Ignored while an Item is
   * held.
   */
  | { type: "EquipItem"; item: ItemId }
  /**
   * Move the Item Equipped in `slot` to the first free spot in the
   * Inventory, or refuse with `NoRoom` when it fits nowhere.
   */
  | { type: "UnequipItem"; slot: EquipmentSlot }
  /** Walk to a Ground Item and pick it up, if there's room for it. */
  | { type: "PickUp"; groundItem: ItemId }
  /** Go back to Town after dying. */
  | { type: "Continue" }
  /**
   * Open a Town Portal, rooting the Hero for the opening time as a cast
   * does. Ignored in Town, during Death and during an Area change, or when
   * Town has no Town Portal spot.
   */
  | { type: "OpenTownPortal" }
  /**
   * Spend unspent Attribute Points raising each Attribute by its count in
   * `points`, at once and whatever the Hero is doing; refused whole when it
   * asks for more points than are unspent.
   */
  | { type: "SpendAttributePoints"; points: AttributeCounts }
  /**
   * Spend an unspent Skill Point raising `skill`'s Skill Level by one, at
   * once and whatever the Hero is doing, if the Hero's Level is up to the
   * Skill's required Level.
   */
  | { type: "SpendSkillPoint"; skill: Skill }
  /**
   * Put the learned Skill `skill` into Skill Bar slot `slot`, at once and
   * whatever the Hero is doing, moving it out of any other slot it was in.
   * Ignored for a Skill not yet learned.
   */
  | { type: "PutSkillOnBar"; skill: Skill; slot: SkillBarSlot }
  /**
   * Cast the Skill in Skill Bar slot `slot` at `target`. Fails in Town or
   * without the Mana for it, and does nothing from an empty slot.
   */
  | { type: "Cast"; slot: SkillBarSlot; target: Vec }
  /**
   * Drink the bottom Potion of Belt Column `column` (0 the leftmost), the
   * ones above dropping down a row: at once, whatever the Hero is doing,
   * Town included. Refused during Death; an empty column does nothing.
   */
  | { type: "DrinkFromBelt"; column: number }
  /**
   * Drink the Potion `item` in the Inventory: at once, whatever the Hero is
   * doing, Town included. Refused during Death; an Item that isn't a Potion
   * does nothing.
   */
  | { type: "DrinkItem"; item: ItemId };

/**
 * Why a cast failed: the Hero is in Town, lacks the Mana for it, or there's
 * no Corpse near the cast point for a Skill that uses one up.
 */
export type CastFailure = "town" | "mana" | "corpse";

/** What happened during a step. */
export type SimEvent =
  /** The Hero's swing or their Minion's attack hit a Monster. */
  | {
      type: "HitLanded";
      attacker: "hero" | "minion";
      target: MonsterId;
      damage: number;
    }
  /**
   * A swing of the Hero's or an attack of their Minion's failed its chance
   * to hit a Monster, or a Monster's attack failed to hit the Hero.
   */
  | { type: "Missed"; target: MonsterId | "hero" }
  | { type: "HeroHit"; damage: number }
  | { type: "MonsterDied"; id: MonsterId }
  /** A dying Monster or the Hero dropped `item`, which now lies at `pos`. */
  | { type: "ItemDropped"; item: Item; pos: Vec }
  /** The Hero picked up `item`, which now has its top-left at `cell`. */
  | { type: "ItemPickedUp"; item: Item; cell: Cell }
  /** The Hero picked up the Potion `item` into the top of Belt Column `column`. */
  | { type: "PotionPickedUp"; item: Item; column: number }
  /** The Hero got to a Ground Item with no room for it in the Inventory. */
  | { type: "NoRoom" }
  /** An Item moved in the Inventory or Equipment, onto the cursor or off it. */
  | { type: "InventoryChanged" }
  /** `item` went into Equipment slot `slot`. */
  | { type: "ItemEquipped"; item: Item; slot: EquipmentSlot }
  /** `item` came out of Equipment slot `slot`. */
  | { type: "ItemUnequipped"; item: Item; slot: EquipmentSlot }
  /** The Hero drank the Potion `item`, used up, its effect starting. */
  | { type: "PotionDrunk"; item: Item }
  /** A Potion went into or came out of the Belt Columns. */
  | { type: "BeltChanged" }
  | { type: "ExperienceGained"; amount: number }
  /** The Hero reached Level `level`, with their Life and Mana already filled. */
  | { type: "LevelReached"; level: number }
  | { type: "AttributeRaised"; attribute: Attribute }
  /** A Skill Point raised `skill` to Skill Level `skillLevel`. */
  | { type: "SkillLevelRaised"; skill: Skill; skillLevel: number }
  /** A `PutSkillOnBar` order rearranged the Skill Bar. */
  | { type: "SkillBarChanged" }
  /** The Hero started casting `skill` at `target`, its Mana spent. */
  | { type: "SkillCast"; skill: Skill; target: Vec }
  /** A cast did nothing, spending no Mana. */
  | { type: "CastFailed"; reason: CastFailure }
  /** Minion `minion` appeared at `pos`. */
  | { type: "MinionSummoned"; minion: MinionId; pos: Vec }
  /**
   * Minion `minion` crumbled away at `pos`: replaced by a fresh one, or its
   * Hero died.
   */
  | { type: "MinionCrumbled"; minion: MinionId; pos: Vec }
  /** A Monster's attack hit Minion `minion` for `damage`. */
  | { type: "MinionHit"; minion: MinionId; damage: number }
  /** A Monster's attack failed to hit Minion `minion`. */
  | { type: "MinionMissed"; minion: MinionId }
  /** Minion `minion` was killed at `pos`, leaving no Corpse. */
  | { type: "MinionDied"; minion: MinionId; pos: Vec }
  | { type: "HeroDied" }
  /**
   * The Hero arrived at Entry `entry` in Area `area`, or beside the Town
   * Portal's end there when `entry` is null.
   */
  | { type: "AreaChanged"; area: string; entry: string | null }
  /** A Town Portal opened, its Combat Area end at `pos` in Area `area`. */
  | { type: "TownPortalOpened"; area: string; pos: Vec }
  /**
   * The Town Portal with its Combat Area end at `pos` in Area `area` closed:
   * replaced by a new one, or gone back through from Town.
   */
  | { type: "TownPortalClosed"; area: string; pos: Vec };

/** The Hero's Attributes, in the order they're shown. */
export const ATTRIBUTES = [
  "strength",
  "dexterity",
  "vitality",
  "energy",
] as const;

/** One of the Hero's Attributes. */
export type Attribute = (typeof ATTRIBUTES)[number];

/** A count of Attribute Points per Attribute, none where left out. */
export type AttributeCounts = Partial<Record<Attribute, number>>;

export type { Skill };

/** The Skills, in the order the Skill Tree shows them. */
export const SKILLS = Object.keys(skillTuning) as Skill[];

/**
 * Level, Experience, Attributes and Skills: what the Save keeps besides
 * Belongings.
 */
export type Progress = {
  /** From 1 up to the last Level in the Experience table. */
  level: number;
  /** All the Experience earned, never past the table's last value. */
  experience: number;
  /** Raises damage. */
  strength: number;
  /** Raises Attack Rating. */
  dexterity: number;
  /** Raises max Life. */
  vitality: number;
  /** Raises max Mana. */
  energy: number;
  /** Attribute Points not spent yet. */
  attributePoints: number;
  /** Skill Points not spent yet. */
  skillPoints: number;
  /** Each Skill's Skill Level; 0 is not learned. */
  skillLevels: Record<Skill, number>;
  /** The learned Skills on the Skill Bar, each in at most one slot. */
  skillBar: SkillBar;
};

/** A fresh Level 1 Hero's progress: no Skill learned, an empty Skill Bar. */
export const FRESH_PROGRESS: Progress = {
  level: 1,
  experience: 0,
  strength: heroTuning.strength,
  dexterity: heroTuning.dexterity,
  vitality: heroTuning.vitality,
  energy: heroTuning.energy,
  attributePoints: 0,
  skillPoints: 0,
  skillLevels: Object.fromEntries(SKILLS.map((skill) => [skill, 0])) as Record<
    Skill,
    number
  >,
  skillBar: emptySkillBar(),
};

/** A copy of `progress` sharing nothing with it. */
function copyProgress(progress: Progress): Progress {
  return {
    ...progress,
    skillLevels: { ...progress.skillLevels },
    skillBar: { ...progress.skillBar },
  };
}

/**
 * Builds a World from raw `.tmj` content keyed by Area name, with the Hero in
 * Town at its `start` Entry with full Life: with `progress` and `belongings`
 * if given, or a fresh Level 1 Hero with a Short Sword if not. `tilesets`
 * holds the raw `.tsj` content of the tilesets the Areas keep in their own
 * files, keyed by file name. With `start`, the Hero starts at that Entry
 * instead, as if just arrived there, or in Town if there's no such Entry.
 * Throws, naming the Area, on content that doesn't fit together (see
 * `validateAreas`).
 */
export function createWorld(options: {
  areas: Record<string, unknown>;
  tilesets?: Record<string, unknown>;
  seed: number;
  progress?: Progress | null;
  belongings?: Belongings | null;
  start?: { area: string; entry: string } | null;
}): World {
  const areas: Record<string, Area> = {};
  for (const [name, content] of Object.entries(options.areas)) {
    areas[name] = loadArea(name, content, options.tilesets);
  }

  validateAreas(areas);
  const town = areas[TOWN];
  if (!town) throw new Error(`No Area named "${TOWN}"`);
  const start = town.entries.start;
  const progress = options.progress ?? FRESH_PROGRESS;
  const belongings = options.belongings ?? FRESH_BELONGINGS;

  const world: World = {
    seed: options.seed,
    rng: createRng(options.seed),
    tick: 0,
    hitstop: 0,
    heldOrders: [],
    areas,
    areaName: TOWN,
    areaChange: null,
    death: null,
    hero: {
      // Filled to max Life and Mana below, once there's a World to ask.
      life: 0,
      mana: 0,
      progress: copyProgress(progress),
      // Filled from `belongings` below, handing out Item ids.
      inventory: [],
      equipment: emptyEquipment(),
      belt: emptyBelt(),
      potionEffects: [],
      cursor: null,
      pos: { ...start },
      prevPos: { ...start },
      path: [],
      // Down the screen, along +x and +y.
      facing: Math.PI / 4,
      attacking: null,
      pickingUp: null,
      swing: null,
      cast: null,
      opening: null,
      flinch: 0,
      combat: 0,
      buffered: null,
    },
    monsters: [],
    projectiles: [],
    corpses: [],
    groundItems: [],
    minions: [],
    townPortal: null,
    nextMonsterId: 1,
    nextMinionId: 1,
    nextItemId: 1,
  };
  giveBelongings(world, belongings);
  world.hero.life = maxLife(world);
  world.hero.mana = maxMana(world);
  for (const spawn of town.spawns) placePack(world, town, spawn);
  const at = options.start;
  if (
    at &&
    Object.hasOwn(areas, at.area) &&
    Object.hasOwn(areas[at.area].entries, at.entry)
  ) {
    const change = { ...at, elapsed: 0 };
    arrive(world, { ...change, elapsed: arriveStep(change) }, []);
  }
  return world;
}

/** The Hero's progress, as the Save keeps it. */
export function progressOf(world: World): Progress {
  return copyProgress(world.hero.progress);
}

/**
 * Whether a Skill Point can be spent on `skill` now: one is unspent, the
 * Hero lives and their Level is up to the Skill's required Level.
 */
export function canRaiseSkill(world: World, skill: Skill): boolean {
  const { progress } = world.hero;
  return (
    progress.skillPoints > 0 &&
    !world.death &&
    progress.level >= skillTuning[skill].requiredLevel
  );
}

/** Whether `skill` uses a Corpse up, so a cast needs one near its point. */
export function usesCorpse(skill: Skill): boolean {
  return skillTuning[skill].effect.type === "raise";
}

/** The Mana a cast of `skill` costs at Skill Level `skillLevel` (1 and up). */
export function skillManaCost(skill: Skill, skillLevel: number): number {
  const { manaCost, manaCostPerSkillLevel } = skillTuning[skill];
  return manaCost + manaCostPerSkillLevel * (skillLevel - 1);
}

/**
 * How many Minions `effect` lets the Hero have at Skill Level `skillLevel`:
 * its count, and one more every `countEvery` Skill Levels past the first.
 */
export function raiseCount(effect: RaiseEffect, skillLevel: number): number {
  return effect.count + Math.floor((skillLevel - 1) / effect.countEvery);
}

/** The Ground Items lying in the active Area. */
export function groundItemsOf(world: World): GroundItem[] {
  return world.groundItems.map(({ item, pos }) => ({
    item: { ...item },
    pos: { ...pos },
  }));
}

/** The Monster states in which a Monster is going after the Hero. */
const AFTER_HERO: readonly MonsterState[] = ["chase", "windup", "recover"];

/**
 * Whether the Hero is In Combat: they dealt or took damage in the last
 * `combatMs`, or a Monster is going after them.
 */
export function isInCombat(world: World): boolean {
  return (
    world.hero.combat > 0 ||
    world.monsters.some((monster) => AFTER_HERO.includes(monster.state))
  );
}

/** The Experience Level `level` needs: 0 for Level 1. */
export function levelExperience(level: number): number {
  return EXPERIENCE_TABLE[level - 1];
}

/**
 * The Experience the Level after `level` needs, or null at the last Level,
 * which has no next.
 */
export function nextLevelExperience(level: number): number | null {
  return level < EXPERIENCE_TABLE.length ? EXPERIENCE_TABLE[level] : null;
}

/** What the Equipped Items add up to, bonus by bonus (0 for none). */
function bonusOf(world: World, bonus: Bonus): number {
  let total = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = world.hero.equipment[slot];
    if (item) total += itemOf(item.type).bonuses[bonus] ?? 0;
  }
  return total;
}

/**
 * The Hero's Attributes as they count: the base ones points are spent on
 * (see `progressOf`), plus the Equipped Items' bonuses.
 */
export function attributesOf(world: World): Record<Attribute, number> {
  const { progress } = world.hero;
  return Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      progress[attribute] + bonusOf(world, attribute),
    ]),
  ) as Record<Attribute, number>;
}

/**
 * The Hero's full Life, growing with their Level and Vitality, plus the
 * Equipped Items' +Life.
 */
export function maxLife(world: World): number {
  const { level } = world.hero.progress;
  return (
    heroTuning.life +
    heroTuning.lifePerLevel * (level - 1) +
    heroTuning.lifePerVitality * attributesOf(world).vitality +
    bonusOf(world, "life")
  );
}

/** The Hero's full Mana, growing with their Level and Energy. */
export function maxMana(world: World): number {
  const { level } = world.hero.progress;
  return (
    heroTuning.mana +
    heroTuning.manaPerLevel * (level - 1) +
    heroTuning.manaPerEnergy * attributesOf(world).energy
  );
}

/** The Hero's maximum Life and Mana, as Potions are capped at. */
function maxima(world: World): PotionMaxima {
  return { life: maxLife(world), mana: maxMana(world) };
}

/**
 * The Hero's Defense, which Monsters' Attack Rating has to beat: the
 * Equipped Armour's base Defense plus the Equipped Items' +Defense, 0 with
 * neither.
 */
export function heroDefense(world: World): number {
  const armour = world.hero.equipment.armour;
  const base = (armour && itemOf(armour.type).defense) ?? 0;
  return base + bonusOf(world, "defense");
}

/** Whether the Hero is regaining Life: alive, out of combat and below full. */
export function isRegenerating(world: World): boolean {
  return !world.death && !isInCombat(world) && world.hero.life < maxLife(world);
}

/**
 * The least and most damage one of the Hero's hits deals: the Equipped
 * Weapon's, or a punch's with none, 1% more for each point of Strength.
 * Left unrounded, so every point counts: each hit rounds its own damage.
 */
export function damageRange(world: World): [number, number] {
  const weapon = world.hero.equipment.weapon;
  const scale = 1 + attributesOf(world).strength / 100;
  const [min, max] =
    (weapon && itemOf(weapon.type).damage) ?? heroTuning.unarmedDamage;
  return [min * scale, max * scale];
}

/**
 * The damage one of the Hero's hits deals for a `roll` in [0, 1): that far
 * through the damage range, rounded to a whole number.
 */
export function heroDamage(world: World, roll: number): number {
  const [min, max] = damageRange(world);
  return Math.round(min + roll * (max - min));
}

/**
 * How accurate the Hero's swings are, from their Dexterity, plus the
 * Equipped Items' +Attack Rating.
 */
export function attackRating(world: World): number {
  return (
    attributesOf(world).dexterity * heroTuning.attackRatingPerDexterity +
    bonusOf(world, "attackRating")
  );
}

/** The chance each of the Hero's swings hits a Monster, by its Defense. */
export function heroChanceToHit(world: World, monster: MonsterOfLevel): number {
  return chanceToHit(attackRating(world), monsterDefense(monster));
}

/**
 * The chance a Monster's attack hits the Hero, by its Attack Rating: certain
 * while the Hero has 0 Defense.
 */
export function monsterChanceToHit(
  world: World,
  monster: MonsterOfLevel,
): number {
  return heroChanceToBeHit(world, monsterAttackRating(monster));
}

/**
 * The chance an attack with `attackRating` hits the Hero: certain while the
 * Hero has 0 Defense.
 */
function heroChanceToBeHit(world: World, attackRating: number): number {
  const defense = heroDefense(world);
  if (defense === 0) return 1;
  return chanceToHit(attackRating, defense);
}

/**
 * Diablo 2's chance to hit, `2 × AR / (AR + Defense)` without its level
 * factor, kept between 5% and 95%.
 */
export function chanceToHit(attackRating: number, defense: number): number {
  const chance = (2 * attackRating) / (attackRating + defense);
  return Math.min(0.95, Math.max(0.05, chance));
}

/**
 * How dark the screen is for an Area change, 0..1: fading to black until the
 * Areas swap, then back.
 */
export function areaFade(world: World): number {
  const change = world.areaChange;
  if (!change || throughTownPortal(change)) return 0;
  return changeCover(change);
}

/**
 * How bright the green flash of going through a Town Portal is, 0..1:
 * flashing up until the Areas swap, then dying away.
 */
export function townPortalFlash(world: World): number {
  const change = world.areaChange;
  if (!change || !throughTownPortal(change)) return 0;
  return changeCover(change);
}

/** Whether an Area change is through a Town Portal, not an Exit. */
function throughTownPortal(change: AreaChange): boolean {
  return change.entry === null;
}

/** How many steps an Area change takes. */
function changeSteps(change: AreaChange): number {
  return throughTownPortal(change)
    ? TOWN_PORTAL_CHANGE_STEPS
    : AREA_CHANGE_STEPS;
}

/** The step of an Area change on which the Areas swap: halfway. */
function arriveStep(change: AreaChange): number {
  return Math.floor(changeSteps(change) / 2);
}

/**
 * How fully an Area change covers the screen, 0..1: rising until the Areas
 * swap, then falling.
 */
function changeCover(change: AreaChange): number {
  const arrive = arriveStep(change);
  return 1 - Math.abs(change.elapsed - arrive) / arrive;
}

/**
 * Starts the Area change to an Exit's target, or through a Town Portal with
 * a null `entry`, stopping the Hero, putting back a held Item and ending any
 * hitstop.
 */
function startAreaChange(
  world: World,
  area: string,
  entry: string | null,
  events: SimEvent[],
) {
  world.areaChange = { area, entry, elapsed: 0 };
  // A hit landed on this step stops for the fade instead.
  world.hitstop = 0;
  stopHero(world.hero);
  returnCursorItem(world, events);
}

/** Stops whatever the Hero is doing: walking, attacking, casting or flinching. */
function stopHero(hero: Hero) {
  hero.path = [];
  hero.attacking = null;
  hero.pickingUp = null;
  hero.swing = null;
  hero.cast = null;
  hero.opening = null;
  hero.flinch = 0;
  hero.buffered = null;
}

/** Advances an Area change, swapping the Areas halfway through. */
function stepAreaChange(world: World, change: AreaChange, events: SimEvent[]) {
  change.elapsed += 1;
  if (change.elapsed === arriveStep(change)) arrive(world, change, events);
  if (change.elapsed >= changeSteps(change)) world.areaChange = null;
}

/**
 * Makes the target Area the active one, fresh from its definition: its
 * Monsters back at their spawns, and no Projectiles or Corpses. The Kept
 * Area instead comes back just as the Hero left it, and leaving it, by any
 * route, sets aside what it holds.
 *
 * The Hero carries over to the target Entry, facing away from the Area's
 * nearest edge, or through a Town Portal to beside its end there, facing
 * away from it, with their Life restored to full on arriving in Town, and
 * back on their feet if they died. Their Minions come along, next to them.
 * Going through a Town Portal from Town closes it.
 */
function arrive(world: World, change: AreaChange, events: SimEvent[]) {
  const area = world.areas[change.area];
  const { hero } = world;
  if (change.entry === null) {
    const beside = besideTownPortal(world, area);
    hero.pos = { ...beside.pos };
    hero.facing = beside.facing;
  } else {
    hero.pos = { ...area.entries[change.entry] };
    hero.facing = awayFromEdge(area, hero.pos);
  }
  hero.prevPos = { ...hero.pos };
  if (area.name === TOWN) {
    hero.life = maxLife(world);
    hero.combat = 0;
  }
  world.death = null;
  const { townPortal } = world;
  if (townPortal?.area === world.areaName) {
    const { monsters, projectiles, corpses, groundItems } = world;
    townPortal.kept = { monsters, projectiles, corpses, groundItems };
  }
  world.areaName = area.name;
  let kept: KeptArea | null = null;
  if (townPortal?.area === area.name) {
    kept = townPortal.kept;
    // Back in the Kept Area, it holds its own state again.
    townPortal.kept = null;
  }
  world.monsters = kept?.monsters ?? [];
  world.projectiles = kept?.projectiles ?? [];
  world.corpses = kept?.corpses ?? [];
  world.groundItems = kept?.groundItems ?? [];
  for (const minion of world.minions) placeBesideHero(world, minion);
  world.heldOrders = [];
  if (!kept) {
    for (const spawn of area.spawns) placePack(world, area, spawn);
  }
  events.push({ type: "AreaChanged", area: area.name, entry: change.entry });
  if (change.entry === null && area.name !== TOWN) {
    closeTownPortal(world, events);
  }
}

/**
 * Where the Hero arrives through a Town Portal in `area`: `arriveDistance`
 * from its end there, down the screen from it or the nearest way round that
 * is walkable, facing away from it; on the end itself when none is.
 */
function besideTownPortal(
  world: World,
  area: Area,
): { pos: Vec; facing: number } {
  const end =
    (area.name === TOWN ? area.townPortal : world.townPortal?.pos) ??
    area.entries.start;
  const { arriveDistance } = townPortalTuning;
  const around = [0, 1, -1, 2, -2, 3, -3, 4]
    .map((turn) => Math.PI / 4 + (turn * Math.PI) / 4)
    .map((facing) => ({
      pos: {
        x: end.x + arriveDistance * Math.cos(facing),
        y: end.y + arriveDistance * Math.sin(facing),
      },
      facing,
    }));
  return (
    around.find(({ pos }) => isWalkable(area, pos)) ?? {
      pos: { ...end },
      facing: Math.PI / 4,
    }
  );
}

/** Whether the Hero is in Town, where no Town Portal opens. */
export function inTown(world: World): boolean {
  return world.areaName === TOWN;
}

/** The spot in Town where a Town Portal's Town end stands, if it has one. */
function townPortalSpot(world: World): Vec | null {
  return world.areas[TOWN].townPortal;
}

/** The end of the Hero's Town Portal standing in the active Area, if any. */
export function townPortalIn(world: World): Vec | null {
  const { townPortal } = world;
  if (!townPortal) return null;
  if (world.areaName === townPortal.area) return { ...townPortal.pos };
  const spot = townPortalSpot(world);
  if (world.areaName === TOWN && spot) return { ...spot };
  return null;
}

/**
 * Whether the Hero walked into a Town Portal end at `end` on this step:
 * within its radius now, and not a step ago.
 */
function walkedInto(hero: Hero, end: Vec): boolean {
  const { radius } = townPortalTuning;
  return (
    distance(hero.pos, end) <= radius && distance(hero.prevPos, end) > radius
  );
}

/** Closes the Hero's Town Portal, if any. */
function closeTownPortal(world: World, events: SimEvent[]) {
  const { townPortal } = world;
  if (!townPortal) return;
  world.townPortal = null;
  events.push({
    type: "TownPortalClosed",
    area: townPortal.area,
    pos: { ...townPortal.pos },
  });
}

/**
 * Opens a Town Portal `openDistance` ahead of the Hero along their facing,
 * or on the nearest spot the Hero can stand on when that is a wall, closing
 * the old one: the Hero has at most one.
 */
function openTownPortal(world: World, events: SimEvent[]) {
  const area = world.areas[world.areaName];
  const { pos, facing } = world.hero;
  const { openDistance } = townPortalTuning;
  const ahead = {
    x: pos.x + openDistance * Math.cos(facing),
    y: pos.y + openDistance * Math.sin(facing),
  };
  const at = summonPoint(area, ahead, heroTuning.radius);
  if (!at) return;
  closeTownPortal(world, events);
  world.townPortal = { area: area.name, pos: at, kept: null };
  events.push({ type: "TownPortalOpened", area: area.name, pos: { ...at } });
}

/** Counts an opening through, opening the Town Portal once it ends. */
function advanceOpening(world: World, opening: Opening, events: SimEvent[]) {
  opening.elapsed += 1;
  if (opening.elapsed < OPENING_STEPS) return;
  world.hero.opening = null;
  openTownPortal(world, events);
  giveBuffered(world, events);
}

/** The facing straight away from the Area edge nearest a point. */
function awayFromEdge(area: Area, point: Vec): number {
  const edges = [
    { gap: point.x, facing: 0 },
    { gap: area.width - point.x, facing: Math.PI },
    { gap: point.y, facing: Math.PI / 2 },
    { gap: area.height - point.y, facing: -Math.PI / 2 },
  ];
  return edges.reduce((a, b) => (b.gap < a.gap ? b : a)).facing;
}

/**
 * The Monster Level Monsters spawn at in an Area: its Area Level, or 1 in
 * Town, which has none.
 */
export function monsterLevelIn(area: Area): number {
  return area.areaLevel ?? 1;
}

/** How far apart a pack's Monsters stand, centre to centre (tiles). */
const PACK_GAP = 0.8;

/**
 * Places a spawn's Monsters: the first on the spawn point and the rest in a
 * ring around it, or on the spawn point where the ring isn't walkable.
 */
function placePack(world: World, area: Area, spawn: Spawn) {
  const ring = spawn.count - 1;
  const radius = Math.max(PACK_GAP, (PACK_GAP * ring) / (2 * Math.PI));
  for (let i = 0; i < spawn.count; i++) {
    const angle = (2 * Math.PI * (i - 1)) / ring;
    const around = {
      x: spawn.pos.x + radius * Math.cos(angle),
      y: spawn.pos.y + radius * Math.sin(angle),
    };
    const pos = i > 0 && isWalkable(area, around) ? around : { ...spawn.pos };
    const typeAtLevel: MonsterOfLevel = {
      type: spawn.monster,
      monsterLevel: monsterLevelIn(area),
    };
    world.monsters.push({
      id: world.nextMonsterId++,
      ...typeAtLevel,
      pos,
      prevPos: { ...pos },
      life: monsterMaxLife(typeAtLevel),
      flinch: 0,
      state: "idle",
      // Down the screen, as the Hero starts.
      facing: Math.PI / 4,
      target: "hero",
      attack: 0,
      cooldown: 0,
      home: { ...pos },
      path: [],
      replan: 0,
      grace: 0,
      // So a pack doesn't set off strolling in step.
      pause: wanderPause(world, spawn.monster),
    });
  }
}

/**
 * Advances the World by one fixed 1/60 s step. During hitstop nothing
 * happens at all: orders wait until it ends, but for a `Walk`, which is
 * dropped. During an Area change nothing
 * happens but the change, and orders are ignored.
 */
export function step(world: World, orders: readonly Order[]): SimEvent[] {
  const { hero } = world;
  const events: SimEvent[] = [];
  hero.prevPos = { ...hero.pos };
  for (const monster of world.monsters) monster.prevPos = { ...monster.pos };
  for (const projectile of world.projectiles) {
    projectile.prevPos = { ...projectile.pos };
  }
  for (const minion of world.minions) minion.prevPos = { ...minion.pos };
  if (hero.combat > 0) hero.combat -= 1;

  if (world.areaChange) {
    stepAreaChange(world, world.areaChange, events);
    world.tick += 1;
    return events;
  }

  if (world.hitstop > 0) {
    world.hitstop -= 1;
    // A walk in a direction is for its own step only, or the Hero would
    // leap every held one at once.
    world.heldOrders.push(...orders.filter((order) => order.type !== "Walk"));
    world.tick += 1;
    return events;
  }

  for (const monster of world.monsters) {
    if (monster.flinch > 0) monster.flinch -= 1;
  }
  if (hero.swing) advanceSwing(world, hero.swing, events);
  if (hero.cast) advanceCast(world, hero.cast, events);
  if (hero.opening) advanceOpening(world, hero.opening, events);
  if (world.death) {
    stepDeath(world, world.death, orders, events);
    world.tick += 1;
    return events;
  }

  if (hero.flinch > 0) stepFlinch(world, events);
  // Before the orders, so a Minion summoned this step stands where it appears.
  stepMinions(world, (minion, monster) =>
    minionStrike(world, minion, monster, events),
  );
  for (const order of [...world.heldOrders, ...orders]) {
    give(world, order, events);
  }
  world.heldOrders = [];
  // Swing from where the Hero stands if already in reach, or once walked
  // into it.
  approach(world);
  walk(hero);
  const area = world.areas[world.areaName];
  const exit = exitAt(area, hero.pos);
  if (exit && exit !== exitAt(area, hero.prevPos)) {
    startAreaChange(world, exit.area, exit.entry, events);
    world.tick += 1;
    return events;
  }
  const townPortalEnd = townPortalIn(world);
  if (world.townPortal && townPortalEnd && walkedInto(hero, townPortalEnd)) {
    const to = world.areaName === TOWN ? world.townPortal.area : TOWN;
    startAreaChange(world, to, null, events);
    world.tick += 1;
    return events;
  }
  approach(world);
  reachGroundItem(world, events);
  // Before the Monsters, so an Arrow first shows where it is loosed.
  landProjectiles(world, events);
  for (const { monster, target } of stepMonsters(world)) {
    strike(world, target, monsterAttack(monster), events);
  }
  if (isRegenerating(world)) {
    hero.life = Math.min(maxLife(world), hero.life + REGEN_PER_STEP);
  }
  if (!world.death) {
    hero.mana = Math.min(maxMana(world), hero.mana + MANA_REGEN_PER_STEP);
  }
  stepPotionEffects(hero, maxima(world));

  world.tick += 1;
  return events;
}

/**
 * While the Hero lies dead, Monsters carry on and every order is ignored but
 * a `Continue` once `DEATH_STEPS` have passed, which starts the way back to
 * Town.
 */
function stepDeath(
  world: World,
  death: Death,
  orders: readonly Order[],
  events: SimEvent[],
) {
  death.elapsed += 1;
  const given = [...world.heldOrders, ...orders];
  world.heldOrders = [];
  if (
    death.elapsed >= DEATH_STEPS &&
    given.some((order) => order.type === "Continue")
  ) {
    startAreaChange(world, TOWN, "start", events);
    return;
  }
  // Projectiles fly on, over the dead Hero.
  landProjectiles(world, events);
  stepMonsters(world);
}

/**
 * Moves every Projectile and lands those that touch the Hero or their Minions.
 * One reaching the Hero on the step another kills them flies on over them.
 */
function landProjectiles(world: World, events: SimEvent[]) {
  stepProjectiles(world, (projectile, target) =>
    strike(world, target, projectile, events),
  );
}

/**
 * Lands a Monster's attack, a melee one or a Projectile, on `target`: the
 * Hero, unless they are in Death, or one of their Minions.
 */
function strike(
  world: World,
  target: MonsterTarget,
  attack: AttackNumbers,
  events: SimEvent[],
) {
  if (target !== "hero") hitMinion(world, target, attack, events);
  else if (!world.death) hitHero(world, attack, events);
}

/**
 * Whether the Hero can spend `points` now: each count a whole number of at
 * least 0, no more in all than are unspent, and the Hero alive.
 */
export function canSpendAttributePoints(
  world: World,
  points: AttributeCounts,
): boolean {
  const counts = Object.values(points);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    !world.death &&
    counts.every((count) => Number.isInteger(count) && count >= 0) &&
    total <= world.hero.progress.attributePoints
  );
}

/**
 * The World as it would be with `points` spent: a copy sharing all but the
 * Hero, whose Attributes, unspent points, Life and Mana it changes as
 * `SpendAttributePoints` would, so every World query can preview them.
 */
export function withAttributePointsSpent(
  world: World,
  points: AttributeCounts,
): World {
  const hero = {
    ...world.hero,
    progress: { ...world.hero.progress },
  };
  raiseAttributes(hero, points, []);
  return { ...world, hero };
}

/**
 * Raises each Attribute by its count in `points`, one unspent point each, if
 * the Hero can spend them all (see `canSpendAttributePoints`).
 */
function spendAttributePoints(
  world: World,
  points: AttributeCounts,
  events: SimEvent[],
) {
  if (!canSpendAttributePoints(world, points)) return;
  raiseAttributes(world.hero, points, events);
}

/**
 * Raises the Hero's Attributes by `points`, reporting each point. Vitality
 * adds its Life to current Life as well as to max Life, and Energy its Mana
 * to current Mana as well as to max Mana.
 */
function raiseAttributes(
  hero: Hero,
  points: AttributeCounts,
  events: SimEvent[],
) {
  for (const attribute of ATTRIBUTES) {
    const count = points[attribute] ?? 0;
    for (let i = 0; i < count; i++) {
      hero.progress.attributePoints -= 1;
      hero.progress[attribute] += 1;
      if (attribute === "vitality") hero.life += heroTuning.lifePerVitality;
      if (attribute === "energy") hero.mana += heroTuning.manaPerEnergy;
      events.push({ type: "AttributeRaised", attribute });
    }
  }
}

/**
 * Raises a Skill's Skill Level by one for an unspent Skill Point, if it can
 * be, putting a newly learned Skill on the Skill Bar (see
 * `placeLearnedSkill`).
 */
function spendSkillPoint(world: World, skill: Skill, events: SimEvent[]) {
  if (!canRaiseSkill(world, skill)) return;
  const { progress } = world.hero;
  progress.skillPoints -= 1;
  if (progress.skillLevels[skill] === 0) {
    progress.skillBar = placeLearnedSkill(progress.skillBar, skill);
  }
  progress.skillLevels[skill] += 1;
  const skillLevel = progress.skillLevels[skill];
  events.push({ type: "SkillLevelRaised", skill, skillLevel });
}

/**
 * Puts a learned Skill into a Skill Bar slot (see `putSkillOnBar`),
 * reporting it unless it was there already.
 */
function putOnBar(
  world: World,
  skill: Skill,
  slot: SkillBarSlot,
  events: SimEvent[],
) {
  const { progress } = world.hero;
  if (progress.skillLevels[skill] === 0) return;
  if (progress.skillBar[slot] === skill) return;
  progress.skillBar = putSkillOnBar(progress.skillBar, skill, slot);
  events.push({ type: "SkillBarChanged" });
}

/**
 * Applies an order, or buffers it during a flinch or a committed swing. A
 * point is spent and Items move at once, whatever the Hero is doing. Taking
 * an Item off keeps current Life and Mana where they are, up to the new max,
 * and putting one on adds none.
 */
function give(world: World, order: Order, events: SimEvent[]) {
  const { hero } = world;
  // Only heeded while dead.
  if (order.type === "Continue") return;
  // Ignored, not buffered, where it can't open.
  if (
    order.type === "OpenTownPortal" &&
    (world.areaName === TOWN || !townPortalSpot(world))
  ) {
    return;
  }
  if (order.type === "SpendAttributePoints") {
    spendAttributePoints(world, order.points, events);
    return;
  }
  if (order.type === "SpendSkillPoint") {
    spendSkillPoint(world, order.skill, events);
    return;
  }
  if (order.type === "PutSkillOnBar") {
    putOnBar(world, order.skill, order.slot, events);
    return;
  }
  if (order.type === "DrinkFromBelt") {
    drinkFromBelt(world, order.column, maxima(world), events);
    return;
  }
  if (order.type === "DrinkItem") {
    drinkItem(world, order.item, maxima(world), events);
    return;
  }
  if (moveItem(world, order, events)) {
    // Taking off an Item's bonuses can leave Life or Mana over the new max.
    hero.life = Math.min(hero.life, maxLife(world));
    hero.mana = Math.min(hero.mana, maxMana(world));
    return;
  }
  // An empty slot does nothing, not even replace a buffered order.
  if (order.type === "Cast" && !hero.progress.skillBar[order.slot]) return;
  if (hero.flinch > 0 || hero.cast || hero.opening) {
    hero.buffered = order;
    return;
  }
  if (hero.swing) {
    // A move may walk out of a swing's follow-through, not its wind-up.
    const moves = order.type === "MoveTo" || order.type === "Walk";
    if (!moves || !hero.swing.landed) {
      hero.buffered = order;
      return;
    }
    hero.swing = null;
    hero.buffered = null;
  }

  const area = world.areas[world.areaName];
  switch (order.type) {
    case "MoveTo":
      hero.attacking = null;
      hero.pickingUp = null;
      hero.path = findPath(area, hero.pos, order.target, heroTuning.radius);
      break;
    case "Walk":
      walkInDirection(world, order.direction);
      break;
    case "Attack": {
      const monster = monsterById(world, order.monster);
      if (!monster) return;
      hero.attacking = monster.id;
      hero.pickingUp = null;
      hero.path = findPath(area, hero.pos, monster.pos, heroTuning.radius);
      break;
    }
    case "PickUp": {
      const lying = groundItemById(world, order.groundItem);
      if (!lying) return;
      hero.attacking = null;
      hero.pickingUp = lying.item.id;
      hero.path = findPath(area, hero.pos, lying.pos, heroTuning.radius);
      break;
    }
    case "SwingAt":
      hero.pickingUp = null;
      startSwing(hero, null, order.target);
      break;
    case "Cast":
      castFrom(world, order.slot, order.target, events);
      break;
    case "OpenTownPortal":
      hero.path = [];
      hero.attacking = null;
      hero.pickingUp = null;
      hero.opening = { elapsed: 0 };
      break;
  }
}

/**
 * Casts the Skill in a Skill Bar slot at `target`: in a Combat Area with the
 * Mana for it, this spends the Mana, roots the Hero facing `target` for the
 * cast time and has the Skill's effect at once. In Town, without a Corpse
 * near `target` for a Skill that uses one up, or without the Mana it fails,
 * and from an empty slot it does nothing; neither spends Mana nor stops the
 * Hero.
 */
function castFrom(
  world: World,
  slot: SkillBarSlot,
  target: Vec,
  events: SimEvent[],
) {
  const { hero } = world;
  const skill = hero.progress.skillBar[slot];
  if (!skill) return;
  if (world.areaName === TOWN) {
    events.push({ type: "CastFailed", reason: "town" });
    return;
  }
  const { effect } = skillTuning[skill];
  const corpse = usesCorpse(skill) ? nearestCorpse(world, target) : null;
  if (usesCorpse(skill) && !corpse) {
    events.push({ type: "CastFailed", reason: "corpse" });
    return;
  }
  const skillLevel = hero.progress.skillLevels[skill];
  const cost = skillManaCost(skill, skillLevel);
  if (hero.mana < cost) {
    events.push({ type: "CastFailed", reason: "mana" });
    return;
  }
  hero.mana -= cost;
  faceToward(hero, target);
  hero.path = [];
  hero.attacking = null;
  hero.pickingUp = null;
  hero.cast = { skill, elapsed: 0 };
  events.push({ type: "SkillCast", skill, target: { ...target } });
  switch (effect.type) {
    case "summon":
      summon(world, skill, effect.minion, skillLevel, target, events);
      break;
    case "raise":
      if (corpse) raise(world, skill, effect, skillLevel, corpse, events);
      break;
  }
}

/**
 * The Corpse nearest `point` within a Corpse-using Skill's reach of it, if
 * any.
 */
function nearestCorpse(world: World, point: Vec): Corpse | null {
  let nearest: Corpse | null = null;
  for (const corpse of world.corpses) {
    const away = distance(corpse.pos, point);
    if (away > corpseTuning.reach) continue;
    if (!nearest || away < distance(nearest.pos, point)) nearest = corpse;
  }
  return nearest;
}

/**
 * Brings a fresh Minion at full Life at `target`, or the nearest point to it
 * a Minion can stand on, crumbling away the one `skill` brought before: the
 * Hero has at most one of each summoned Minion.
 */
function summon(
  world: World,
  skill: Skill,
  type: MinionType,
  skillLevel: number,
  target: Vec,
  events: SimEvent[],
) {
  const area = world.areas[world.areaName];
  const pos = summonPoint(area, target, minionTuning[type].radius);
  if (!pos) return;
  for (const minion of world.minions) {
    if (minion.skill === skill) crumbleMinion(world, minion, events);
  }
  bringMinion(world, skill, type, skillLevel, pos, events);
}

/**
 * Raises a fresh Minion at full Life from `corpse`, using it up, and
 * crumbles away the oldest ones `skill` brought as needed to keep within
 * the count `effect` allows at `skillLevel`.
 */
function raise(
  world: World,
  skill: Skill,
  effect: RaiseEffect,
  skillLevel: number,
  corpse: Corpse,
  events: SimEvent[],
) {
  world.corpses = world.corpses.filter((one) => one !== corpse);
  // Oldest first, as the Hero's Minions are.
  const raised = world.minions.filter((minion) => minion.skill === skill);
  const over = raised.length + 1 - raiseCount(effect, skillLevel);
  for (const minion of raised.slice(0, Math.max(0, over))) {
    crumbleMinion(world, minion, events);
  }
  bringMinion(world, skill, effect.minion, skillLevel, corpse.pos, events);
}

/** Adds a fresh Minion at full Life at `pos` to the Hero's Minions. */
function bringMinion(
  world: World,
  skill: Skill,
  type: MinionType,
  skillLevel: number,
  pos: Vec,
  events: SimEvent[],
) {
  const minion = newMinion(
    world.nextMinionId++,
    type,
    skill,
    skillLevel,
    pos,
    world.hero.facing,
  );
  world.minions.push(minion);
  events.push({ type: "MinionSummoned", minion: minion.id, pos: { ...pos } });
}

/** Counts a cast through, running the buffered order once it ends. */
function advanceCast(world: World, cast: Cast, events: SimEvent[]) {
  cast.elapsed += 1;
  if (cast.elapsed < CAST_STEPS[cast.skill]) return;
  world.hero.cast = null;
  giveBuffered(world, events);
}

/**
 * Walks the Hero one step in `direction`, sliding along walls, dropping
 * whatever it was walking to; a zero `direction` stops it where it stands.
 */
function walkInDirection(world: World, direction: Vec) {
  const { hero } = world;
  hero.path = [];
  hero.attacking = null;
  hero.pickingUp = null;
  if (direction.x === 0 && direction.y === 0) return;
  hero.facing = Math.atan2(direction.y, direction.x);
  const area = world.areas[world.areaName];
  const to = stepInDirection(
    area,
    hero.pos,
    direction,
    WALK_PER_STEP,
    heroTuning.radius,
  );
  if (to) hero.pos = to;
}

/** Swings at the Monster the Hero walks to once it is in reach. */
function approach(world: World) {
  const { hero } = world;
  if (hero.attacking === null || hero.swing) return;
  const monster = monsterById(world, hero.attacking);
  if (!monster) {
    hero.attacking = null;
    hero.path = [];
  } else if (distance(hero.pos, monster.pos) <= heroTuning.reach) {
    startSwing(hero, monster.id, monster.pos);
  } else if (hero.path.length === 0) {
    // Walked as near as it can get, still out of reach.
    hero.attacking = null;
  }
}

/**
 * Picks up the Ground Item the Hero walks to once it is in reach: a Potion
 * into a Belt Column with room, else into the first free spot of the
 * Inventory, or left lying with `NoRoom`.
 */
function reachGroundItem(world: World, events: SimEvent[]) {
  const { hero } = world;
  if (hero.pickingUp === null) return;
  const lying = groundItemById(world, hero.pickingUp);
  if (!lying) {
    hero.pickingUp = null;
    hero.path = [];
    return;
  }
  if (distance(hero.pos, lying.pos) > heroTuning.pickupReach) {
    // Walked as near as it can get, still out of reach.
    if (hero.path.length === 0) hero.pickingUp = null;
    return;
  }
  hero.pickingUp = null;
  hero.path = [];
  const column = putInBelt(world, lying.item);
  if (column !== null) {
    world.groundItems = world.groundItems.filter((other) => other !== lying);
    events.push({ type: "PotionPickedUp", item: { ...lying.item }, column });
    events.push({ type: "BeltChanged" });
    return;
  }
  const cell = firstFreeCell(taken(hero), lying.item.type);
  if (!cell) {
    events.push({ type: "NoRoom" });
    return;
  }
  world.groundItems = world.groundItems.filter((other) => other !== lying);
  hero.inventory.push({ item: lying.item, cell });
  events.push({
    type: "ItemPickedUp",
    item: { ...lying.item },
    cell: { ...cell },
  });
}

function startSwing(hero: Hero, monster: MonsterId | null, toward: Vec) {
  faceToward(hero, toward);
  hero.swing = { elapsed: 0, landed: false, monster };
  hero.attacking = null;
  hero.path = [];
}

function advanceSwing(world: World, swing: Swing, events: SimEvent[]) {
  const { hero } = world;
  swing.elapsed += 1;
  if (swing.elapsed === HIT_STEP) land(world, swing, events);
  if (swing.elapsed < SWING_STEPS) return;

  hero.swing = null;
  giveBuffered(world, events);
}

/** Counts down the Hero's flinch, running the buffered order once it ends. */
function stepFlinch(world: World, events: SimEvent[]) {
  const { hero } = world;
  hero.flinch -= 1;
  if (hero.flinch === 0) giveBuffered(world, events);
}

/** Gives the order buffered during a swing or a flinch, if any. */
function giveBuffered(world: World, events: SimEvent[]) {
  const { hero } = world;
  const buffered = hero.buffered;
  hero.buffered = null;
  if (buffered) give(world, buffered, events);
}

/**
 * Lands a swing's hit on its target, or on every Monster in its arc, each
 * rolling its own chance to hit.
 */
function land(world: World, swing: Swing, events: SimEvent[]) {
  const { hero } = world;
  swing.landed = true;
  const victims = world.monsters.filter((monster) => {
    const gap = distance(hero.pos, monster.pos);
    if (swing.monster !== null) {
      return (
        monster.id === swing.monster &&
        gap <= heroTuning.reach + heroTuning.reachGrace
      );
    }
    return lands(hero, monster.pos, heroTuning.reach, ARC);
  });

  for (const monster of victims) {
    if (random(world.rng) < heroChanceToHit(world, monster)) {
      world.hitstop = HITSTOP_STEPS;
      hit(world, monster, events);
    } else {
      miss(world, monster, events);
    }
  }
}

/**
 * A Miss deals no damage, so it neither flinches the Monster nor keeps the
 * Hero In Combat, but the Monster still notices the Hero.
 */
function miss(world: World, monster: Monster, events: SimEvent[]) {
  events.push({ type: "Missed", target: monster.id });
  noticeHit(world, monster);
}

function hit(world: World, monster: Monster, events: SimEvent[]) {
  const damage = heroDamage(world, random(world.rng));
  monster.life = Math.max(0, monster.life - damage);
  world.hero.combat = COMBAT_STEPS;
  events.push({
    type: "HitLanded",
    attacker: "hero",
    target: monster.id,
    damage,
  });

  hurt(world, monster, events);
}

/**
 * After a hit on a Monster: at 0 Life it dies, leaving a Corpse, giving the
 * Hero its Experience and rolling its drop; else it notices and may flinch.
 */
function hurt(world: World, monster: Monster, events: SimEvent[]) {
  if (monster.life === 0) {
    world.monsters = world.monsters.filter((m) => m !== monster);
    world.corpses.push({
      id: monster.id,
      type: monster.type,
      pos: monster.pos,
    });
    events.push({ type: "MonsterDied", id: monster.id });
    gainExperience(
      world,
      killExperience(monster, world.hero.progress.level),
      events,
    );
    rollDrop(world, monster.pos, events);
    return;
  }
  noticeHit(world, monster);
  if (random(world.rng) < monsterTuning[monster.type].flinchChance) {
    flinchMonster(monster);
  }
}

/**
 * Roots a Monster in a flinch. A type whose flinch interrupts drops its
 * wind-up, so its attack never comes, and goes back to the chase to start
 * another once the flinch is over.
 */
function flinchMonster(monster: Monster) {
  monster.flinch = FLINCH_STEPS[monster.type];
  if (
    monsterTuning[monster.type].flinchInterrupts &&
    monster.state === "windup"
  ) {
    monster.state = "chase";
    monster.attack = 0;
  }
}

/**
 * Rolls an attack with `chance` to hit: the damage it deals, from `range`
 * inclusive, or null for a Miss. A certain hit rolls only its damage, so the
 * rolls after it stay as they were.
 */
function rollAttack(
  world: World,
  chance: number,
  range: [number, number],
): number | null {
  if (chance < 1 && random(world.rng) >= chance) return null;
  return randomInt(world.rng, range);
}

/**
 * Lands a Minion's attack on a Monster: it rolls the Minion's
 * Attack Rating against the Monster's Defense, and a hit hurts it as the
 * Hero's do. Neither keeps the Hero In Combat, and there is no hitstop.
 */
function minionStrike(
  world: World,
  minion: Minion,
  monster: Monster,
  events: SimEvent[],
) {
  const damage = rollAttack(
    world,
    chanceToHit(minionAttackRating(minion), monsterDefense(monster)),
    minionDamageRange(minion),
  );
  if (damage === null) {
    events.push({ type: "Missed", target: monster.id });
    noticeHit(world, monster);
    return;
  }
  monster.life = Math.max(0, monster.life - damage);
  events.push({
    type: "HitLanded",
    attacker: "minion",
    target: monster.id,
    damage,
  });
  hurt(world, monster, events);
}

/**
 * Rolls a dying Monster's drops, each lying where it died: by
 * `dropTuning.chance` one Item, then by `potionDropTuning.chance` one Potion,
 * each of a type picked with equal odds.
 */
function rollDrop(world: World, pos: Vec, events: SimEvent[]) {
  for (const { chance, items } of [dropTuning, potionDropTuning]) {
    if (random(world.rng) >= chance) continue;
    const type = items[randomInt(world.rng, [0, items.length - 1])];
    const item = { id: world.nextItemId++, type };
    world.groundItems.push({ item, pos: { ...pos } });
    events.push({ type: "ItemDropped", item: { ...item }, pos: { ...pos } });
  }
}

/**
 * Lands a Monster's attack, a melee one or a Projectile, on the Hero. A Hero
 * with 0 Defense is always hit; above it the attack can Miss, which deals no
 * damage, so it neither flinches the Hero nor keeps them In Combat.
 */
function hitHero(world: World, attack: AttackNumbers, events: SimEvent[]) {
  const { hero } = world;
  const damage = rollAttack(
    world,
    heroChanceToBeHit(world, attack.attackRating),
    attack.damage,
  );
  if (damage === null) {
    events.push({ type: "Missed", target: "hero" });
    return;
  }
  hero.life = Math.max(0, hero.life - damage);
  hero.combat = COMBAT_STEPS;
  events.push({ type: "HeroHit", damage });
  if (hero.life === 0) {
    die(world, events);
    return;
  }

  // A swing's follow-through carries on.
  if (hero.swing?.landed) return;
  if (random(world.rng) >= heroTuning.flinchChance) return;
  hero.flinch = HERO_FLINCH_STEPS;
  hero.swing = null;
  // Its effect has happened; the flinch roots the Hero in its place.
  hero.cast = null;
  // A Town Portal opens only at the end, so it never does.
  hero.opening = null;
  hero.attacking = null;
  hero.pickingUp = null;
  hero.path = [];
}

/**
 * Lands a Monster's attack, a melee one or a Projectile, on the Hero's
 * Minion `id`, if it still lives: it rolls the attack's Attack Rating against
 * the Minion's Defense, and at 0 Life the Minion dies, leaving no Corpse.
 * Neither keeps the Hero In Combat.
 */
function hitMinion(
  world: World,
  id: MinionId,
  attack: AttackNumbers,
  events: SimEvent[],
) {
  const minion = world.minions.find((one) => one.id === id);
  if (!minion) return;
  const damage = rollAttack(
    world,
    chanceToHit(attack.attackRating, minionDefense(minion)),
    attack.damage,
  );
  if (damage === null) {
    events.push({ type: "MinionMissed", minion: minion.id });
    return;
  }
  minion.life = Math.max(0, minion.life - damage);
  events.push({ type: "MinionHit", minion: minion.id, damage });
  if (minion.life > 0) return;
  removeMinion(world, minion);
  events.push({
    type: "MinionDied",
    minion: minion.id,
    pos: { ...minion.pos },
  });
}

/** Crumbles one of the Hero's Minions away, leaving nothing behind. */
function crumbleMinion(world: World, minion: Minion, events: SimEvent[]) {
  events.push({
    type: "MinionCrumbled",
    minion: minion.id,
    pos: { ...minion.pos },
  });
  removeMinion(world, minion);
}

/** Takes a Minion out of the Hero's Minions. */
function removeMinion(world: World, minion: Minion) {
  world.minions = world.minions.filter((one) => one !== minion);
}

/**
 * Lays the Hero down, stopping whatever they were doing, ending every
 * running Potion effect, crumbles their Minions away and sends every Monster
 * home.
 */
function die(world: World, events: SimEvent[]) {
  world.death = { elapsed: 0 };
  world.hero.potionEffects = [];
  for (const minion of world.minions) crumbleMinion(world, minion, events);
  for (const monster of world.monsters) sendHome(monster);
  stopHero(world.hero);
  returnCursorItem(world, events);
  events.push({ type: "HeroDied" });
}

/**
 * Gives the Hero Experience, raising their Level as many times as it reaches
 * and filling their Life and Mana on each. Experience stops at the table's last value,
 * and only what was gained is reported.
 */
function gainExperience(world: World, amount: number, events: SimEvent[]) {
  const { hero } = world;
  const { progress } = hero;
  const gained = Math.min(amount, EXPERIENCE_CAP - progress.experience);
  if (gained <= 0) return;
  progress.experience += gained;
  events.push({ type: "ExperienceGained", amount: gained });
  for (
    let next = nextLevelExperience(progress.level);
    next !== null && progress.experience >= next;
    next = nextLevelExperience(progress.level)
  ) {
    progress.level += 1;
    progress.attributePoints += heroTuning.attributePointsPerLevel;
    progress.skillPoints += heroTuning.skillPointsPerLevel;
    hero.life = maxLife(world);
    hero.mana = maxMana(world);
    events.push({ type: "LevelReached", level: progress.level });
  }
}

function groundItemById(world: World, id: ItemId): GroundItem | undefined {
  return world.groundItems.find((lying) => lying.item.id === id);
}

function monsterById(world: World, id: MonsterId): Monster | undefined {
  return world.monsters.find((monster) => monster.id === id);
}

/** Moves the Hero one step along its path, carrying over past waypoints. */
function walk(hero: Hero) {
  let budget = WALK_PER_STEP;
  while (budget > 0 && hero.path.length > 0) {
    const next = hero.path[0];
    const dx = next.x - hero.pos.x;
    const dy = next.y - hero.pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) hero.facing = Math.atan2(dy, dx);
    if (distance <= budget) {
      hero.pos = { ...next };
      hero.path.shift();
      budget -= distance;
    } else {
      hero.pos = {
        x: hero.pos.x + (dx / distance) * budget,
        y: hero.pos.y + (dy / distance) * budget,
      };
      budget = 0;
    }
  }
}
