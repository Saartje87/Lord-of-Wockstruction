import { areaTuning } from "../tuning/areas";
import { heroTuning } from "../tuning/hero";
import { type Bonus, dropTuning, itemOf } from "../tuning/items";
import { minionTuning } from "../tuning/minions";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { type Skill, skillTuning } from "../tuning/skills";
import {
  type Area,
  exitAt,
  isWalkable,
  loadArea,
  type Spawn,
  TOWN,
} from "./area";
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
  stepMinion,
  summonPoint,
} from "./minions";
import {
  killExperience,
  type MonsterOfLevel,
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
import { angleBetween, distance, type Vec } from "./vec";

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
/** The step of an Area change on which the Areas swap. */
const ARRIVE_STEP = Math.floor(AREA_CHANGE_STEPS / 2);
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

export type { Minion, MinionId, MinionType, SkillBar, SkillBarSlot };
export { minionMaxLife };

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
   * Who it last went after: the nearer of the Hero and their Minion. A
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

/** Who a Monster goes after: the Hero, or their Minion. */
export type MonsterTarget = "hero" | "minion";

/**
 * `idle` and `wander` stroll around the spawn, `chase` goes after the nearer
 * of the Hero and their Minion, `windup` telegraphs an attack on it,
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
 * Walking through an Exit to Entry `entry` in Area `area`. The World stands
 * still and orders are ignored until it ends.
 */
export type AreaChange = {
  area: string;
  entry: string;
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

/** What remains of a dead Monster: inert, not clickable, not blocking. */
export type Corpse = { id: MonsterId; type: MonsterType; pos: Vec };

/** An Item lying in the active Area, until picked up or the Hero leaves. */
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
  /** The Corpses in the active Area. */
  corpses: Corpse[];
  /** The Ground Items in the active Area, never kept by the Save. */
  groundItems: GroundItem[];
  /** The Hero's Golem, if one lives; never kept by the Save. */
  minion: Minion | null;
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
  /** Walk into reach of a Monster and swing at it. */
  | { type: "Attack"; monster: MonsterId }
  /** Swing in place towards a point, hitting every Monster in the arc. */
  | { type: "SwingAt"; target: Vec }
  /**
   * Lift the Inventory Item covering cell `from`, or the Item Equipped in
   * slot `from`, onto the cursor, if it's empty. This and the other orders
   * moving Items happen at once, whatever the Hero is doing.
   */
  | { type: "LiftItem"; from: ItemSpot }
  /**
   * Put the cursor Item down with its top-left at cell `to`, or into slot
   * `to`: into free cells or an empty slot, or over exactly one Item, which
   * is swapped onto the cursor. Refused off the grid, over two or more
   * Items, into a slot of another kind, or when a swapped-out Item couldn't
   * go back anywhere (see `placement`).
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
   * Spend an unspent Attribute Point raising `attribute` by one, at once and
   * whatever the Hero is doing.
   */
  | { type: "SpendAttributePoint"; attribute: Attribute }
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
  | { type: "Cast"; slot: SkillBarSlot; target: Vec };

/** Why a cast failed: the Hero is in Town, or lacks the Mana for it. */
export type CastFailure = "town" | "mana";

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
  /** The Hero got to a Ground Item with no room for it in the Inventory. */
  | { type: "NoRoom" }
  /** An Item moved in the Inventory or Equipment, onto the cursor or off it. */
  | { type: "InventoryChanged" }
  /** `item` went into Equipment slot `slot`. */
  | { type: "ItemEquipped"; item: Item; slot: EquipmentSlot }
  /** `item` came out of Equipment slot `slot`. */
  | { type: "ItemUnequipped"; item: Item; slot: EquipmentSlot }
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
  /** The Hero arrived at Entry `entry` in Area `area`. */
  | { type: "AreaChanged"; area: string; entry: string };

/** The Hero's Attributes, in the order they're shown. */
export const ATTRIBUTES = [
  "strength",
  "dexterity",
  "vitality",
  "energy",
] as const;

/** One of the Hero's Attributes. */
export type Attribute = (typeof ATTRIBUTES)[number];

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
 * files, keyed by file name. Throws,
 * naming the Area, on content that doesn't fit together (see
 * `validateAreas`).
 */
export function createWorld(options: {
  areas: Record<string, unknown>;
  tilesets?: Record<string, unknown>;
  seed: number;
  progress?: Progress | null;
  belongings?: Belongings | null;
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
      flinch: 0,
      combat: 0,
      buffered: null,
    },
    monsters: [],
    corpses: [],
    groundItems: [],
    minion: null,
    nextMonsterId: 1,
    nextMinionId: 1,
    nextItemId: 1,
  };
  giveBelongings(world, belongings);
  world.hero.life = maxLife(world);
  world.hero.mana = maxMana(world);
  for (const spawn of town.spawns) placePack(world, town, spawn);
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

/** The Mana a cast of `skill` costs at Skill Level `skillLevel` (1 and up). */
export function skillManaCost(skill: Skill, skillLevel: number): number {
  const { manaCost, manaCostPerSkillLevel } = skillTuning[skill];
  return manaCost + manaCostPerSkillLevel * (skillLevel - 1);
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

/**
 * The Hero's full Mana, growing with their Level and Energy, plus the
 * Equipped Items' +Energy.
 */
export function maxMana(world: World): number {
  const { level } = world.hero.progress;
  return (
    heroTuning.mana +
    heroTuning.manaPerLevel * (level - 1) +
    heroTuning.manaPerEnergy * attributesOf(world).energy
  );
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
  const defense = heroDefense(world);
  if (defense === 0) return 1;
  return chanceToHit(monsterAttackRating(monster), defense);
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
  if (!change) return 0;
  return 1 - Math.abs(change.elapsed - ARRIVE_STEP) / ARRIVE_STEP;
}

/**
 * Starts the Area change to an Exit's target, stopping the Hero, putting
 * back a held Item and ending any hitstop.
 */
function startAreaChange(
  world: World,
  area: string,
  entry: string,
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
  hero.flinch = 0;
  hero.buffered = null;
}

/** Advances an Area change, swapping the Areas halfway through. */
function stepAreaChange(world: World, change: AreaChange, events: SimEvent[]) {
  change.elapsed += 1;
  if (change.elapsed === ARRIVE_STEP) arrive(world, change, events);
  if (change.elapsed >= AREA_CHANGE_STEPS) world.areaChange = null;
}

/**
 * Makes the target Area the active one, fresh from its definition: its
 * Monsters back at their spawns and no Corpses. The Hero carries over to the
 * target Entry, facing away from the Area's nearest edge, with their Life
 * restored to full on arriving in Town, and back on their feet if they died.
 * Their Minion, if any, comes along, next to them.
 */
function arrive(world: World, change: AreaChange, events: SimEvent[]) {
  const area = world.areas[change.area];
  const at = area.entries[change.entry];
  const { hero } = world;
  hero.pos = { ...at };
  hero.prevPos = { ...at };
  hero.facing = awayFromEdge(area, at);
  if (area.name === TOWN) {
    hero.life = maxLife(world);
    hero.combat = 0;
  }
  world.death = null;
  world.areaName = area.name;
  world.monsters = [];
  world.corpses = [];
  world.groundItems = [];
  if (world.minion) placeBesideHero(world, world.minion);
  world.heldOrders = [];
  for (const spawn of area.spawns) placePack(world, area, spawn);
  events.push({ type: "AreaChanged", area: area.name, entry: change.entry });
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
 * happens at all: orders wait until it ends. During an Area change nothing
 * happens but the change, and orders are ignored.
 */
export function step(world: World, orders: readonly Order[]): SimEvent[] {
  const { hero } = world;
  const events: SimEvent[] = [];
  hero.prevPos = { ...hero.pos };
  for (const monster of world.monsters) monster.prevPos = { ...monster.pos };
  if (world.minion) world.minion.prevPos = { ...world.minion.pos };
  if (hero.combat > 0) hero.combat -= 1;

  if (world.areaChange) {
    stepAreaChange(world, world.areaChange, events);
    world.tick += 1;
    return events;
  }

  if (world.hitstop > 0) {
    world.hitstop -= 1;
    world.heldOrders.push(...orders);
    world.tick += 1;
    return events;
  }

  for (const monster of world.monsters) {
    if (monster.flinch > 0) monster.flinch -= 1;
  }
  if (hero.swing) advanceSwing(world, hero.swing, events);
  if (hero.cast) advanceCast(world, hero.cast, events);
  if (world.death) {
    stepDeath(world, world.death, orders, events);
    world.tick += 1;
    return events;
  }

  if (hero.flinch > 0) stepFlinch(world, events);
  // Before the orders, so a Minion summoned this step stands where it appears.
  const struck = stepMinion(world);
  if (struck && world.minion) minionStrike(world, world.minion, struck, events);
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
  approach(world);
  reachGroundItem(world, events);
  for (const { monster, target } of stepMonsters(world)) {
    if (target === "minion") hitMinion(world, monster, events);
    else if (!world.death) hitHero(world, monster, events);
  }
  if (isRegenerating(world)) {
    hero.life = Math.min(maxLife(world), hero.life + REGEN_PER_STEP);
  }
  if (!world.death) {
    hero.mana = Math.min(maxMana(world), hero.mana + MANA_REGEN_PER_STEP);
  }

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
  stepMonsters(world);
}

/**
 * Raises an Attribute by one for an unspent point, if there is one. Vitality
 * adds its Life to current Life as well as to max Life, and Energy its Mana
 * to current Mana as well as to max Mana.
 */
function spendAttributePoint(
  world: World,
  attribute: Attribute,
  events: SimEvent[],
) {
  const { hero } = world;
  if (hero.progress.attributePoints === 0) return;
  hero.progress.attributePoints -= 1;
  hero.progress[attribute] += 1;
  if (attribute === "vitality") hero.life += heroTuning.lifePerVitality;
  if (attribute === "energy") hero.mana += heroTuning.manaPerEnergy;
  events.push({ type: "AttributeRaised", attribute });
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
  if (order.type === "SpendAttributePoint") {
    spendAttributePoint(world, order.attribute, events);
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
  if (moveItem(world, order, events)) {
    // Taking off +Life, +Vitality or +Energy can leave Life or Mana over the
    // new max.
    hero.life = Math.min(hero.life, maxLife(world));
    hero.mana = Math.min(hero.mana, maxMana(world));
    return;
  }
  if (hero.flinch > 0 || hero.cast) {
    hero.buffered = order;
    return;
  }
  if (hero.swing) {
    // A move may walk out of a swing's follow-through, not its wind-up.
    if (order.type !== "MoveTo" || !hero.swing.landed) {
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
  }
}

/**
 * Casts the Skill in a Skill Bar slot at `target`: in a Combat Area with the
 * Mana for it, this spends the Mana, roots the Hero facing `target` for the
 * cast time and has the Skill's effect at once. In Town or without the Mana
 * it fails, and from an empty slot it does nothing; neither spends Mana nor
 * stops the Hero.
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
  const skillLevel = hero.progress.skillLevels[skill];
  const cost = skillManaCost(skill, skillLevel);
  if (hero.mana < cost) {
    events.push({ type: "CastFailed", reason: "mana" });
    return;
  }
  hero.mana -= cost;
  face(hero, target);
  hero.path = [];
  hero.attacking = null;
  hero.pickingUp = null;
  hero.cast = { skill, elapsed: 0 };
  events.push({ type: "SkillCast", skill, target: { ...target } });
  const { effect } = skillTuning[skill];
  summon(world, effect.minion, skillLevel, target, events);
}

/**
 * Brings a fresh Minion at full Life at `target`, or the nearest point to it
 * a Minion can stand on, crumbling away the one already there: the Hero has
 * at most one.
 */
function summon(
  world: World,
  type: MinionType,
  skillLevel: number,
  target: Vec,
  events: SimEvent[],
) {
  const area = world.areas[world.areaName];
  const pos = summonPoint(area, target, minionTuning[type].radius);
  if (!pos) return;
  const old = world.minion;
  if (old) {
    events.push({
      type: "MinionCrumbled",
      minion: old.id,
      pos: { ...old.pos },
    });
  }
  const minion = newMinion(
    world.nextMinionId++,
    type,
    skillLevel,
    pos,
    world.hero.facing,
  );
  world.minion = minion;
  events.push({ type: "MinionSummoned", minion: minion.id, pos: { ...pos } });
}

/** Counts a cast through, running the buffered order once it ends. */
function advanceCast(world: World, cast: Cast, events: SimEvent[]) {
  cast.elapsed += 1;
  if (cast.elapsed < CAST_STEPS[cast.skill]) return;
  world.hero.cast = null;
  giveBuffered(world, events);
}

/** Turns the Hero towards a point, unless standing on it. */
function face(hero: Hero, toward: Vec) {
  const dx = toward.x - hero.pos.x;
  const dy = toward.y - hero.pos.y;
  if (dx !== 0 || dy !== 0) hero.facing = Math.atan2(dy, dx);
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
 * Picks up the Ground Item the Hero walks to once it is in reach: into the
 * first free spot of the Inventory, or left lying with `NoRoom`.
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
  face(hero, toward);
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
    if (gap > heroTuning.reach) return false;
    if (gap === 0) return true;
    const angle = Math.atan2(
      monster.pos.y - hero.pos.y,
      monster.pos.x - hero.pos.x,
    );
    return angleBetween(angle, hero.facing) <= ARC;
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
    monster.flinch = FLINCH_STEPS[monster.type];
  }
}

/**
 * Lands the Hero's Minion's attack on a Monster: it rolls the Minion's
 * Attack Rating against the Monster's Defense, and a hit hurts it as the
 * Hero's do. Neither keeps the Hero In Combat, and there is no hitstop.
 */
function minionStrike(
  world: World,
  minion: Minion,
  monster: Monster,
  events: SimEvent[],
) {
  const chance = chanceToHit(
    minionAttackRating(minion),
    monsterDefense(monster),
  );
  if (random(world.rng) >= chance) {
    events.push({ type: "Missed", target: monster.id });
    noticeHit(world, monster);
    return;
  }
  const damage = randomInt(world.rng, minionDamageRange(minion));
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
 * Rolls a dying Monster's drop: by `dropTuning.chance`, one Item of a type
 * picked with equal odds, lying where it died.
 */
function rollDrop(world: World, pos: Vec, events: SimEvent[]) {
  if (random(world.rng) >= dropTuning.chance) return;
  const { items } = dropTuning;
  const type = items[randomInt(world.rng, [0, items.length - 1])];
  const item = { id: world.nextItemId++, type };
  world.groundItems.push({ item, pos: { ...pos } });
  events.push({ type: "ItemDropped", item: { ...item }, pos: { ...pos } });
}

/**
 * Lands a Monster's attack on the Hero. A Hero with 0 Defense is always hit;
 * above it the attack can Miss, which deals no damage, so it neither flinches
 * the Hero nor keeps them In Combat.
 */
function hitHero(world: World, monster: Monster, events: SimEvent[]) {
  const { hero } = world;
  // No roll at 0 Defense, so the rolls after it stay as they were.
  if (heroDefense(world) > 0) {
    if (random(world.rng) >= monsterChanceToHit(world, monster)) {
      events.push({ type: "Missed", target: "hero" });
      return;
    }
  }
  const damage = randomInt(world.rng, monsterDamageRange(monster));
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
  hero.attacking = null;
  hero.pickingUp = null;
  hero.path = [];
}

/**
 * Lands a Monster's attack on the Hero's Minion, if it still lives: it rolls
 * the Monster's Attack Rating against the Minion's Defense, and at 0 Life
 * the Minion dies, leaving no Corpse. Neither keeps the Hero In Combat.
 */
function hitMinion(world: World, monster: Monster, events: SimEvent[]) {
  const { minion } = world;
  if (!minion) return;
  const chance = chanceToHit(
    monsterAttackRating(monster),
    minionDefense(minion),
  );
  if (random(world.rng) >= chance) {
    events.push({ type: "MinionMissed", minion: minion.id });
    return;
  }
  const damage = randomInt(world.rng, monsterDamageRange(monster));
  minion.life = Math.max(0, minion.life - damage);
  events.push({ type: "MinionHit", minion: minion.id, damage });
  if (minion.life > 0) return;
  world.minion = null;
  events.push({
    type: "MinionDied",
    minion: minion.id,
    pos: { ...minion.pos },
  });
}

/**
 * Lays the Hero down, stopping whatever they were doing, crumbles their
 * Minion away and sends every Monster home.
 */
function die(world: World, events: SimEvent[]) {
  world.death = { elapsed: 0 };
  const { minion } = world;
  if (minion) {
    events.push({
      type: "MinionCrumbled",
      minion: minion.id,
      pos: { ...minion.pos },
    });
    world.minion = null;
  }
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
