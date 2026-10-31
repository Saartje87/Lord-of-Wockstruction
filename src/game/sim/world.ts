import { areaTuning } from "../tuning/areas";
import { boneAltarTuning } from "../tuning/boneAltars";
import {
  type DamageShares,
  type DamageType,
  ELEMENT_INFO,
  ELEMENTS,
  type Element,
  MAXIMUM_RESISTANCE,
  MINIMUM_RESISTANCE,
  type Resistances,
  resistancePenaltyOf,
} from "../tuning/damage";
import { goldTuning } from "../tuning/gold";
import { graveWockingtonTuning } from "../tuning/graveWockington";
import { heroTuning } from "../tuning/hero";
import {
  affixOf,
  type Bonus,
  blockTuning,
  dropTuning,
  itemOf,
  potionDropTuning,
} from "../tuning/items";
import { mapTuning } from "../tuning/map";
import { minionTuning } from "../tuning/minions";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { questTuning } from "../tuning/quests";
import {
  type CastSkill,
  type CurseEffect,
  castTuning,
  corpseTuning,
  type ExplodeEffect,
  isPassive,
  type ProjectileEffect,
  type RaiseEffect,
  type Skill,
  skillTuning,
  type VolleyEffect,
  type WallEffect,
  type WardEffect,
} from "../tuning/skills";
import { townPortalTuning } from "../tuning/townPortal";
import { townPortalLook } from "../tuning/townPortalLook";
import { uniqueTuning } from "../tuning/uniqueMonsters";
import { waypointTuning } from "../tuning/waypoints";
import { affixTotal, rollItem } from "./affixes";
import {
  type Area,
  cellAt,
  exitAt,
  isWalkable,
  loadArea,
  type Npc,
  type Spawn,
  TOWN,
} from "./area";
import { type BeltColumns, emptyBelt, putInBelt } from "./belt";
import {
  freeSpot,
  heroSideBodies,
  monsterBodies,
  separateBodies,
  summonPoint,
  wallRadius,
} from "./bodies";
import {
  altarRadiusOf,
  type BoneAltar,
  isBoneAltar,
  targetsOf,
} from "./boneAltars";
import { type BoneWallPiece, wallSpots } from "./boneWalls";
import {
  type Damage,
  landDamage,
  minionResistances,
  monsterResistances,
  splitDamage,
  unresistedTotal,
} from "./damage";
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
  type SmithBonus,
  taken,
} from "./inventory";
import { faceToward, lands } from "./melee";
import {
  type Minion,
  type MinionId,
  type MinionOfLevel,
  type MinionType,
  minionAttackRating,
  minionDamageRange,
  minionDefense,
  minionMaxLife,
  newMinion,
  placeBesideHero,
  stepMinions,
} from "./minions";
import {
  killExperience,
  type MonsterOfLevel,
  monsterAttack,
  monsterAttackRating,
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
  type Burn,
  isLobbed,
  type LobbedProjectile,
  type Projectile,
  stepBurns,
  stepProjectiles,
} from "./projectiles";
import {
  actBossQuestOpen,
  advanceQuest,
  boneAltarsPutAway,
  copyQuests,
  freshQuests,
  hasQuestBusiness,
  type QuestDeed,
  type QuestId,
  type QuestProgress,
  type QuestStates,
  questsOf,
} from "./quests";
import { createRng, type Rng, random, randomInt } from "./random";
import {
  emptySkillBar,
  placeLearnedSkill,
  putSkillOnBar,
  SKILL_BAR_SLOTS,
  type SkillBar,
  type SkillBarSlot,
} from "./skillBar";
import { giveSmithBonus, SMITH } from "./smith";
import { passiveMultiplier, skillPower } from "./synergies";
import { msToSteps, perStep, STEP_MS } from "./units";
import { validateAreas, validateResistances } from "./validate";
import { distance, type Vec } from "./vec";
import { moveGood, newVendor, restockVendor, type Vendor } from "./vendor";
import { holdBack, slideAround, stepInDirection } from "./walking";

const EXPERIENCE_TABLE = heroTuning.experienceTable;
/** The most Experience the Hero can have: what the last Level needs. */
const EXPERIENCE_CAP = EXPERIENCE_TABLE[EXPERIENCE_TABLE.length - 1];
/**
 * How many steps a swing takes with no attack speed; the Hero's own is
 * `heroSwingSteps`.
 */
export const SWING_STEPS = msToSteps(heroTuning.swingMs);
/** The step of a base swing on which its hit lands. */
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
  (Object.keys(skillTuning) as Skill[])
    .filter((skill): skill is CastSkill => !isPassive(skill))
    .map((skill) => [skill, msToSteps(castTuning(skill).castMs)]),
) as Record<CastSkill, number>;

/** How many steps opening a Town Portal roots the Hero for. */
export const OPENING_STEPS = msToSteps(townPortalTuning.openingMs);

export type { Minion, MinionId, MinionType, SkillBar, SkillBarSlot };
export type { LobbedProjectile, Projectile };
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
   * The Bone Ward on the Hero, if any. It stays on through Area changes,
   * ends on Death and is never kept by the Save.
   */
  boneWard: BoneWard | null;
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
  /** The NPC (index in the Area's `npcs`) the Hero is walking to, to talk to. */
  talkingTo: number | null;
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

/**
 * A Bone Ward: the damage it still soaks up, and what it soaked when last
 * filled.
 */
export type BoneWard = { left: number; full: number };

/** A Skill being cast: its effect happened as it started. */
export type Cast = {
  skill: CastSkill;
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
  /**
   * How many steps it takes and the step its hit lands on, fixed as it
   * starts, so Equipping Gloves mid-swing can't skip the hit.
   */
  steps: number;
  hitStep: number;
  /** Whether its hit has landed yet. */
  landed: boolean;
  /** The Monster an `Attack` swings at, or null for a `SwingAt` arc. */
  monster: MonsterId | null;
};

export type MonsterId = number;

export type Monster = {
  kind: "monster";
  /** Unique within the World and never reused. */
  id: MonsterId;
  type: MonsterType;
  /**
   * Its Monster Level, which scales its Life, damage, Attack Rating, Defense
   * and Experience: its Area's Area Level when it spawned.
   */
  monsterLevel: number;
  /**
   * Its name when it is a Unique Monster, which is tougher than its type
   * (see `uniqueTuning`); null for an ordinary one.
   */
  unique: string | null;
  /**
   * Grave Wockington's Skeleton waves: steps left until the next, counted
   * while he is after the Hero, and the Monsters he raised. Null for the
   * others.
   */
  waves: { cooldown: number; raised: MonsterId[] } | null;
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
  /** Its Curse, if it has one. */
  curse: MonsterCurse | null;
  /**
   * The Bone Wall piece (its `id`) it is attacking in place of its target,
   * because the Wall cuts it off from them; null when it isn't.
   */
  wall: number | null;
  /**
   * Whether the attack it is winding up or recovering from is its swing, not
   * its ranged attack, for a Monster with both (Grave Wockington).
   */
  swinging: boolean;
};

/** A Curse on a Monster: the Skill that put it there, and steps left. */
export type MonsterCurse = { skill: CastSkill; left: number };

/** Who a Monster goes after: the Hero, or one of their Minions. */
export type MonsterTarget = "hero" | MinionId;

/**
 * `idle` and `wander` stroll around the spawn, `chase` goes after the nearest
 * of the Hero and their Minions, `windup` telegraphs an attack on it,
 * `recover` stands rooted after it, `return` walks home after giving up,
 * ignoring both, and `flee` runs from them under Dread, never attacking and
 * unmoved by a hit.
 */
export type MonsterState =
  | "idle"
  | "wander"
  | "chase"
  | "windup"
  | "recover"
  | "return"
  | "flee";

/**
 * Walking through an Exit to Entry `entry` in Area `area`, or through a Town
 * Portal to Area `area`, beside its end there. The World stands still and
 * orders are ignored until it ends.
 */
export type AreaChange = {
  area: string;
  /**
   * The Entry the Hero arrives at, or null through a Town Portal or by
   * Waypoint.
   */
  entry: string | null;
  /** Whether the Hero travels to the Area's Waypoint, arriving beside it. */
  waypoint: boolean;
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
 * its Town end at Town's Town Portal spot.
 */
export type TownPortal = { area: string; pos: Vec };

/**
 * What an Area held as the Hero left it, set aside unchanged: nothing in it
 * is stepped until they arrive there again (ADR 0005).
 */
export type KeptArea = Pick<
  World,
  | "monsters"
  | "projectiles"
  | "corpses"
  | "groundItems"
  | "goldPiles"
  | "explored"
  | "boneAltars"
  | "burns"
>;

/** A burning circle: where it is, how big, and how long it has left. */
export type BurningCircle = {
  pos: Vec;
  radius: number;
  leftMs: number;
  /** How long it burns in all (ms). */
  lengthMs: number;
};

/** The burning circles in the active Area, for the view and tests. */
export function burningCircles(world: World): BurningCircle[] {
  return world.burns.map((burn) => ({
    pos: { ...burn.pos },
    radius: burn.radius,
    leftMs: Math.round(burn.left * STEP_MS),
    lengthMs: Math.round(burn.steps * STEP_MS),
  }));
}

/**
 * What remains of a dead Monster: inert, not clickable, not blocking. It
 * keeps the Monster's type and Monster Level, for a Skill that bursts it.
 */
export type Corpse = {
  id: MonsterId;
  type: MonsterType;
  monsterLevel: number;
  pos: Vec;
};

/**
 * An Item lying in the active Area, until picked up or the Session ends.
 */
export type GroundItem = { item: Item; pos: Vec };

/** Identifies a Gold Pile among the others in the World. */
export type GoldPileId = number;

/**
 * Gold lying in the active Area, until the Hero walks near it or the Session
 * ends: never an Item, never kept by the Save.
 */
export type GoldPile = { id: GoldPileId; amount: number; pos: Vec };

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
  /** The Bone Altars still standing in the active Area. */
  boneAltars: BoneAltar[];
  /** The burning circles Gravefire left, which burn out in time. */
  burns: Burn[];
  /** The Bone Wall pieces standing in the active Area. */
  boneWalls: BoneWallPiece[];
  /** The Projectiles in flight in the active Area. */
  projectiles: Projectile[];
  /** The Corpses in the active Area. */
  corpses: Corpse[];
  /** The Ground Items in the active Area, never kept by the Save. */
  groundItems: GroundItem[];
  /** The Gold Piles in the active Area, never kept by the Save. */
  goldPiles: GoldPile[];
  /** The id the next Gold Pile gets. */
  nextGoldPileId: GoldPileId;
  /**
   * Which tiles of the active Area are Explored, row by row like
   * `Area.floor`; never kept by the Save.
   */
  explored: boolean[];
  /**
   * The Hero's living Minions, oldest first; never kept by the Save.
   */
  minions: Minion[];
  /**
   * Every Area the Hero has left this Session, by name, as they left it;
   * never kept by the Save. The active Area is not in it.
   */
  keptAreas: Record<string, KeptArea>;
  /**
   * The NPCs standing in the active Area, by their index in the Area's
   * `npcs`: judged against the Quests on each arrival, and a talk can send
   * one home at once. Never kept by the Save.
   */
  standing: number[];
  /** The Hero's Town Portal, if open; never kept by the Save. */
  townPortal: TownPortal | null;
  /** The id the next Monster gets. */
  nextMonsterId: MonsterId;
  /** The id the next Minion gets. */
  nextMinionId: MinionId;
  /** The id the next Item gets. */
  nextItemId: ItemId;
  /**
   * The Vendor's goods in Wockville, restocked on each arrival in Town and
   * never kept by the Save.
   */
  vendor: Vendor;
  /** Whether Trade is open: the Vendor panel is, in Town. Never saved. */
  trading: boolean;
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
  /**
   * Walk into reach of a Monster, or of a Bone Altar (which has an id of the
   * same kind), and swing at it.
   */
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
   * Lift the Vendor's good covering cell `from` of their grid onto the
   * cursor, if it's empty and the Hero's Gold covers its Value. Putting it
   * down with `PlaceItem` into an Inventory cell or, for a Potion, a Belt
   * Column buys it; `DropItem` and `ReturnCursorItem` give it back.
   */
  | { type: "LiftGood"; from: Cell }
  /**
   * Open Trade, as the Vendor panel opens: only in Town and not in Death.
   * Buying and selling need it. It ends by itself with `CloseTrade`, the
   * Hero leaving Town or dying.
   */
  | { type: "OpenTrade" }
  /** End Trade, as the Vendor panel shuts any way; a held good goes back. */
  | { type: "CloseTrade" }
  /**
   * Sell the cursor Item to the Vendor, put down on their grid: it is gone
   * and a share of its Value, set by tuning, is added to Gold. Only with
   * Trade open, never in Death, and never a held good or an Item lifted
   * from an Equipment slot.
   */
  | { type: "SellItem" }
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
  /**
   * Walk to the NPC `npc` (its index in the Area's `npcs`) and talk to it,
   * once within reach. Ignored for an NPC the Area doesn't have.
   */
  | { type: "Talk"; npc: number }
  /**
   * Take on the Quest `quest` from its giver, at once and whatever the Hero
   * is doing. Ignored unless it is Not given and its giver stands within
   * reach in the active Area.
   */
  | { type: "AcceptQuest"; quest: QuestId }
  /**
   * Hand in the Quest `quest` to its giver, making it Done and paying its
   * reward, at once and whatever the Hero is doing. Ignored unless it is
   * Ready to hand in and its giver stands within reach in the active Area.
   */
  | { type: "HandInQuest"; quest: QuestId }
  /**
   * Have the Smith work the Weapon or Armour `item`, Equipped or in the
   * Inventory, giving it a random bonus, at once and whatever the Hero is
   * doing. Ignored unless his service is unlocked and unspent, `item` has no
   * Smith bonus yet and the Smith stands within reach in the active Area.
   */
  | { type: "SmithBonus"; item: ItemId }
  /** Go back to Town after dying. */
  | { type: "Continue" }
  /**
   * Open a Town Portal, rooting the Hero for the opening time as a cast
   * does. Ignored in Town, during Death and during an Area change, or when
   * Town has no Town Portal spot.
   */
  | { type: "OpenTownPortal" }
  /**
   * Travel to the Waypoint in Area `area`, leaving the Area as an Exit
   * does, arriving beside it. Ignored unless the Hero stands on a Waypoint
   * and the other is touched, in the same Act.
   */
  | { type: "TravelToWaypoint"; area: string }
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
export type CastFailure = "town" | "mana" | "corpse" | "skillLevel";

/** What happened during a step. */
export type SimEvent =
  /**
   * The Hero's swing, their Minion's attack or their Skill hit a Monster.
   */
  | {
      type: "HitLanded";
      attacker: "hero" | "minion" | "skill";
      target: MonsterId;
      /** The one total, after the target's Resistances and Curse. */
      damage: number;
      /** What most of it was made of. */
      damageType: DamageType;
    }
  /**
   * A swing of the Hero's or an attack of their Minion's failed its chance
   * to hit a Monster, or a Monster's attack failed to hit the Hero.
   */
  | { type: "Missed"; target: MonsterId | "hero" }
  /**
   * A Monster's attack would have hit the Hero but their Shield Blocked it:
   * no damage, no flinch, nothing off their Bone Ward.
   */
  | { type: "Blocked" }
  /**
   * A Monster's attack hit the Hero, `warded` of it soaked by their Bone
   * Ward and `damage` reaching their Life. `damageType` is what most of the
   * hit was made of.
   */
  | {
      type: "HeroHit";
      damage: number;
      warded: number;
      damageType: DamageType;
    }
  /** The Hero got within reach of NPC `npc`, called `name`, and talks to them. */
  | { type: "Talked"; npc: number; name: string }
  /** The Hero took on Quest `quest`. */
  | { type: "QuestGiven"; quest: QuestId }
  /** Quest `quest` now has `count` of its parts done, not all yet. */
  | { type: "QuestCounted"; quest: QuestId; count: number }
  /** Quest `quest` has all it asks, so it can be handed in. */
  | { type: "QuestReady"; quest: QuestId }
  /** The Hero handed in Quest `quest`, which paid its reward. */
  | { type: "QuestDone"; quest: QuestId }
  /** The Smith gave the Item `item` the bonus `bonus`, using up his service. */
  | { type: "SmithBonusGiven"; item: ItemId; bonus: SmithBonus }
  | { type: "MonsterDied"; id: MonsterId }
  /** The Hero's side hit Bone Altar `altar` for `damage`. */
  /** Monster `boss` raised a wave of `monsters` around itself. */
  | { type: "WaveRaised"; boss: MonsterId; monsters: MonsterId[] }
  /** A Monster cast Gravefire, which will land on `landing`. */
  | { type: "GravefireCast"; monster: MonsterId; landing: Vec }
  /** A Gravefire landed on `at` and began to burn there. */
  | { type: "GravefireLanded"; at: Vec; radius: number }
  /** The burning circle on `at` burnt out. */
  | { type: "GravefireBurnEnded"; at: Vec }
  /** The Hero killed the Act Boss of Act `act` with its Quest not yet Done. */
  | { type: "ActCompleted"; act: number }
  /** The Hero raised a Bone Wall of pieces standing at `pieces`. */
  | { type: "BoneWallRaised"; pieces: Vec[] }
  /** A Monster hit the Bone Wall piece at `pos` for `damage`. */
  | { type: "BoneWallHit"; pos: Vec; damage: number }
  /** The Bone Wall piece at `pos` is gone: `broken` by Monsters, else crumbled. */
  | { type: "BoneWallCrumbled"; pos: Vec; broken: boolean }
  | { type: "BoneAltarHit"; altar: MonsterId; damage: number }
  /** Bone Altar `altar` raised Monster `monster` at `pos`. */
  | { type: "BoneAltarRaised"; altar: MonsterId; monster: MonsterId; pos: Vec }
  /** Bone Altar `altar` in Area `area` was destroyed at `pos`. */
  | { type: "BoneAltarDestroyed"; altar: MonsterId; area: string; pos: Vec }
  /** A dying Monster or the Hero dropped `item`, which now lies at `pos`. */
  | { type: "ItemDropped"; item: Item; pos: Vec }
  /** A dying Monster dropped Gold Pile `pile` of `amount` at `pos`. */
  | { type: "GoldDropped"; pile: GoldPileId; amount: number; pos: Vec }
  /** The Hero picked up a Gold Pile of `amount`, which went into their Gold. */
  | { type: "GoldPickedUp"; amount: number }
  /** The Hero picked up `item`, which now has its top-left at `cell`. */
  | { type: "ItemPickedUp"; item: Item; cell: Cell }
  /** The Hero picked up the Potion `item` into the top of Belt Column `column`. */
  | { type: "PotionPickedUp"; item: Item; column: number }
  /** The Hero got to a Ground Item with no room for it in the Inventory. */
  | { type: "NoRoom" }
  /** The Vendor's goods were stocked afresh, as the Hero arrived in Town. */
  | { type: "VendorRestocked" }
  /** The Hero couldn't lift `item` from the Vendor, whose Value is `value`. */
  | { type: "CantAfford"; item: Item; value: number }
  /** The Hero bought `item` from the Vendor, paying `value` Gold. */
  | { type: "ItemBought"; item: Item; value: number }
  /** The Hero sold `item` to the Vendor for `value` Gold. */
  | { type: "ItemSold"; item: Item; value: number }
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
  | { type: "SkillCast"; skill: CastSkill; target: Vec }
  /**
   * The Corpse `corpse` at `pos` burst, hurting every Monster within
   * `radius` (tiles).
   */
  | { type: "CorpseExploded"; corpse: MonsterId; pos: Vec; radius: number }
  /** `skill` Cursed every Monster within `radius` (tiles) of `pos`. */
  | { type: "CurseCast"; skill: CastSkill; pos: Vec; radius: number }
  /** A cast did nothing, spending no Mana. */
  | { type: "CastFailed"; reason: CastFailure }
  /** Minion `minion` appeared at `pos`. */
  | { type: "MinionSummoned"; minion: MinionId; pos: Vec }
  /**
   * Minion `minion` crumbled away at `pos`: replaced by a fresh one, or its
   * Hero died.
   */
  | { type: "MinionCrumbled"; minion: MinionId; pos: Vec }
  /**
   * A Monster's attack hit Minion `minion` for `damage`, most of it
   * `damageType`.
   */
  | {
      type: "MinionHit";
      minion: MinionId;
      damage: number;
      damageType: DamageType;
    }
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
  /** The Hero walked onto the Waypoint in Area `area`, touched or not yet. */
  | { type: "WaypointReached"; area: string }
  /** The Hero touched the Waypoint in Area `area` for the first time. */
  | { type: "WaypointTouched"; area: string }
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
  /** The Areas whose Waypoints the Hero has touched, in the order they did. */
  touchedWaypoints: string[];
  /** How far each Quest has got. */
  quests: QuestStates;
  /**
   * The Smith's one-time service: locked until "Spa Day" is Done, then
   * unlocked until the Hero uses it on an Item, and used after.
   */
  smithService: SmithService;
  /** The Hero's money: a whole number, never below 0, kept through Death. */
  gold: number;
};

/** Where the Smith's one-time service stands. */
export type SmithService = "locked" | "unlocked" | "used";

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
  touchedWaypoints: [TOWN],
  quests: freshQuests(),
  smithService: "locked",
  gold: 0,
};

/** A copy of `progress` sharing nothing with it. */
function copyProgress(progress: Progress): Progress {
  return {
    ...progress,
    skillLevels: { ...progress.skillLevels },
    skillBar: { ...progress.skillBar },
    touchedWaypoints: [...progress.touchedWaypoints],
    quests: copyQuests(progress.quests),
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
  validateResistances(monsterTuning);
  validateResistances(minionTuning);
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
      boneWard: null,
      cursor: null,
      pos: { ...start },
      prevPos: { ...start },
      path: [],
      // Down the screen, along +x and +y.
      facing: Math.PI / 4,
      attacking: null,
      pickingUp: null,
      talkingTo: null,
      swing: null,
      cast: null,
      opening: null,
      flinch: 0,
      combat: 0,
      buffered: null,
    },
    monsters: [],
    boneAltars: [],
    burns: [],
    boneWalls: [],
    projectiles: [],
    corpses: [],
    groundItems: [],
    goldPiles: [],
    nextGoldPileId: 1,
    // All of Town is Explored from the start.
    explored: new Array(town.width * town.height).fill(true),
    minions: [],
    keptAreas: {},
    standing: [],
    townPortal: null,
    nextMonsterId: 1,
    nextMinionId: 1,
    nextItemId: 1,
    vendor: newVendor(options.seed),
    trading: false,
  };
  giveBelongings(world, belongings);
  restockVendor(world, []);
  world.standing = standingIn(world, town);
  world.hero.life = maxLife(world);
  world.hero.mana = maxMana(world);
  for (const spawn of town.spawns) placePack(world, town, spawn);
  const at = options.start;
  if (
    at &&
    Object.hasOwn(areas, at.area) &&
    Object.hasOwn(areas[at.area].entries, at.entry)
  ) {
    const change = { ...at, waypoint: false, elapsed: 0 };
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
 * Hero lives, their Level is up to the Skill's required Level and its
 * Prerequisite, if any, has a Skill Level.
 */
export function canRaiseSkill(world: World, skill: Skill): boolean {
  const { progress } = world.hero;
  const { requiredLevel, prerequisite } = skillTuning[skill];
  return (
    progress.skillPoints > 0 &&
    !world.death &&
    progress.level >= requiredLevel &&
    (!prerequisite || progress.skillLevels[prerequisite] > 0)
  );
}

/** Whether `skill` uses a Corpse up, so a cast needs one near its point. */
export function usesCorpse(skill: CastSkill): boolean {
  const { type } = castTuning(skill).effect;
  return type === "raise" || type === "explode";
}

/** The Mana a cast of `skill` costs at Skill Level `skillLevel` (1 and up). */
export function skillManaCost(skill: CastSkill, skillLevel: number): number {
  const { manaCost, manaCostPerSkillLevel } = castTuning(skill);
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

/** What the Boss bar shows: the Act Boss's name, Life and maximum Life. */
export type BossBar = { name: string; life: number; maxLife: number };

/**
 * The Boss bar: the Act Boss's name and Life while he is In Combat with the
 * Hero, or null when he isn't, has died, is Returning, or the Area has none.
 * No other Monster ever has one.
 */
export function bossBarOf(world: World): BossBar | null {
  const { actBoss } = world.areas[world.areaName];
  if (!actBoss) return null;
  const boss = world.monsters.find(
    (monster) =>
      monster.unique === actBoss.name &&
      monster.type === actBoss.monster &&
      AFTER_HERO.includes(monster.state),
  );
  if (!boss) return null;
  return {
    name: actBoss.name,
    life: boss.life,
    maxLife: monsterMaxLife(boss),
  };
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

/** What one Item adds of `bonus`: its type's, its Affixes' and its Smith bonus. */
function itemBonus(item: Item, bonus: Bonus): number {
  return (
    (itemOf(item.type).bonuses[bonus] ?? 0) +
    affixTotal(item.affixes, bonus) +
    (item.smithBonus?.bonus === bonus ? item.smithBonus.amount : 0)
  );
}

/** How many Skill Levels the Equipped Items' Affixes and Smith bonuses raise `skill` by. */
export function skillRaiseOf(world: World, skill: Skill): number {
  let total = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = world.hero.equipment[slot];
    for (const affix of item?.affixes ?? []) {
      if (affixOf(affix.kind).skill === skill) total += affix.value;
    }
    if (item?.smithBonus?.skill === skill) total += item.smithBonus.amount;
  }
  return total;
}

/**
 * A Skill's Skill Level: the learned level (Skill Points spent) plus the
 * Equipped Items' raise, which goes with them. Everything reads this but
 * spending Skill Points and Prerequisites, which read the learned level.
 */
export function skillLevelOf(world: World, skill: Skill): number {
  return world.hero.progress.skillLevels[skill] + skillRaiseOf(world, skill);
}

/** Every Skill's Skill Level (see `skillLevelOf`). */
export function skillLevelsOf(world: World): Record<Skill, number> {
  return Object.fromEntries(
    SKILLS.map((skill) => [skill, skillLevelOf(world, skill)]),
  ) as Record<Skill, number>;
}

/** What the Equipped Items add up to, bonus by bonus (0 for none). */
function bonusOf(world: World, bonus: Bonus): number {
  let total = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const item = world.hero.equipment[slot];
    if (item) total += itemBonus(item, bonus);
  }
  return total;
}

/**
 * The Hero's Resistance to `element`: the `total` the Equipped Items' Affixes
 * add up to (All Resistances counting for each Element), and the `effective`
 * Resistance a hit is reduced by, capped at the Maximum Resistance and
 * floored at -100. Both come after the Resistance Penalty of the Act the Hero
 * is in is taken off, so `total` can be negative, and above the cap only by
 * what the Penalty left.
 */
export function heroResistance(
  world: World,
  element: Element,
): { total: number; effective: number } {
  const total =
    bonusOf(world, `${element}Resistance`) +
    bonusOf(world, "allResistances") -
    resistancePenaltyOf(world.areas[world.areaName].act);
  const effective = Math.max(
    MINIMUM_RESISTANCE,
    Math.min(total, MAXIMUM_RESISTANCE),
  );
  return { total, effective };
}

/** What the Hero shrugs off of each Element, as a hit on them lands. */
function heroResistances(world: World): Resistances {
  return Object.fromEntries(
    ELEMENTS.map((element) => [
      element,
      heroResistance(world, element).effective,
    ]),
  );
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
    heroTuning.manaPerEnergy * attributesOf(world).energy +
    bonusOf(world, "mana")
  );
}

/** The Hero's maximum Life and Mana, as Potions are capped at. */
function maxima(world: World): PotionMaxima {
  return { life: maxLife(world), mana: maxMana(world) };
}

/** The slots whose Items' own Defense counts towards the Hero's Defense. */
const DEFENSE_SLOTS: readonly EquipmentSlot[] = [
  "helm",
  "armour",
  "gloves",
  "boots",
  "offHand",
];

/**
 * The Hero's Defense, which Monsters' Attack Rating has to beat: the own
 * Defense of each Equipped Helm, Armour, Gloves, Boots and Shield, each
 * scaled by its own enhanced Defense %, plus the Equipped Items' flat
 * +Defense; 0 with none.
 */
export function heroDefense(world: World): number {
  let total = bonusOf(world, "defense");
  for (const slot of DEFENSE_SLOTS) {
    const item = world.hero.equipment[slot];
    if (!item) continue;
    const own = itemOf(item.type).defense ?? 0;
    // The Item's own Defense is scaled before flat Defense is added.
    total += Math.round(own * (1 + itemBonus(item, "enhancedDefense") / 100));
  }
  return total;
}

/**
 * The Hero's chance, in percent, to Block a Monster's attack that would hit:
 * the Equipped Shield's own plus its Block Affixes, never above
 * `blockTuning.cap`; 0 with no Shield.
 */
export function heroBlockChance(world: World): number {
  const shield = world.hero.equipment.offHand;
  const tuning = shield && itemOf(shield.type);
  if (!shield || tuning?.kind !== "shield") return 0;
  return Math.min(
    blockTuning.cap,
    (tuning.block ?? 0) + itemBonus(shield, "block"),
  );
}

/** The Hero's attack speed, in percent: what the Equipped Items add; 0 for none. */
export function heroAttackSpeed(world: World): number {
  return bonusOf(world, "attackSpeed");
}

/** The Hero's walk speed bonus, in percent: what the Equipped Items add; 0 for none. */
export function heroWalkSpeed(world: World): number {
  return bonusOf(world, "walkSpeed");
}

/** How many times faster than the base the Hero swings: 1 + attack speed %. */
function swingSpeedFactor(world: World): number {
  return 1 + heroAttackSpeed(world) / 100;
}

/** How many whole steps the Hero's swing takes: the base swing over (1 + attack speed %). */
function heroSwingSteps(world: World): number {
  return Math.max(2, msToSteps(heroTuning.swingMs / swingSpeedFactor(world)));
}

/** The step of the Hero's swing on which its hit lands, at the base swing's fraction through it. */
function heroHitStep(world: World): number {
  const faster = swingSpeedFactor(world);
  const steps = msToSteps((heroTuning.swingMs * heroTuning.hitAt) / faster);
  return Math.min(Math.max(1, steps), heroSwingSteps(world) - 1);
}

/** How far the Hero walks in one step (tiles): the base walk speed times (1 + walk speed %). */
function heroWalkPerStep(world: World): number {
  return perStep(heroTuning.walkSpeed * (1 + heroWalkSpeed(world) / 100));
}

/** Whether the Hero is regaining Life: alive, out of combat and below full. */
export function isRegenerating(world: World): boolean {
  return !world.death && !isInCombat(world) && world.hero.life < maxLife(world);
}

/**
 * The least and most Physical damage one of the Hero's hits deals: the
 * Equipped Weapon's, or a punch's with none, 1% more for each point of
 * Strength. Left unrounded, so every point counts.
 */
function physicalDamageRange(world: World): [number, number] {
  const weapon = world.hero.equipment.weapon;
  const scale = 1 + attributesOf(world).strength / 100;
  const [ownMin, ownMax] =
    (weapon && itemOf(weapon.type).damage) ?? heroTuning.unarmedDamage;
  // The Weapon's own damage is scaled before flat damage is added.
  const enhance = 1 + bonusOf(world, "enhancedDamage") / 100;
  const [min, max] = [ownMin * enhance, ownMax * enhance];
  const flat = bonusOf(world, "weaponDamage");
  return [(min + flat) * scale, (max + flat) * scale];
}

/** The flat damage of `element` the Equipped Items add to the Hero's hits. */
function elementalDamage(world: World, element: Element): number {
  return bonusOf(world, ELEMENT_INFO[element].damageBonus);
}

/**
 * The least and most damage one of the Hero's hits deals before any
 * Resistance: the Physical range plus each Element's flat damage, which
 * neither Strength nor enhanced damage scales. Left unrounded.
 */
export function damageRange(world: World): [number, number] {
  const [min, max] = physicalDamageRange(world);
  const elemental = ELEMENTS.reduce(
    (sum, element) => sum + elementalDamage(world, element),
    0,
  );
  return [min + elemental, max + elemental];
}

/**
 * The damage one of the Hero's attacks deals for a `roll` in [0, 1): that
 * far through the Physical range, rounded, plus each Element's flat damage.
 * Skills never add the Elements.
 */
export function heroAttackDamage(world: World, roll: number): Damage {
  const [min, max] = physicalDamageRange(world);
  const damage: Damage = { physical: Math.round(min + roll * (max - min)) };
  for (const element of ELEMENTS) {
    const amount = elementalDamage(world, element);
    if (amount > 0) damage[element] = amount;
  }
  return damage;
}

/**
 * The whole damage one of the Hero's hits deals for a `roll` in [0, 1),
 * before any Resistance.
 */
export function heroDamage(world: World, roll: number): number {
  return unresistedTotal(heroAttackDamage(world, roll));
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
  return change.entry === null && !change.waypoint;
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
  waypoint = false,
) {
  world.areaChange = { area, entry, waypoint, elapsed: 0 };
  // Monsters in pursuit give up, as on Death, and head home once stepped.
  for (const monster of world.monsters) {
    if (["chase", "windup", "recover", "flee"].includes(monster.state)) {
      sendHome(monster);
    }
  }
  fallWithReturning(world, events);
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
  hero.talkingTo = null;
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
 * Makes the target Area the active one: fresh from its definition on the
 * first arrival this Session (its Monsters at their spawns, no Projectiles
 * or Corpses), else just as the Hero left it. Leaving an Area, by any
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
  if (change.waypoint && area.waypoint) {
    const beside = besideSpot(
      area,
      area.waypoint,
      waypointTuning.arriveDistance,
    );
    hero.pos = { ...beside.pos };
    hero.facing = beside.facing;
  } else if (change.entry === null) {
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
    restockVendor(world, events);
  }
  world.death = null;
  world.trading = false;
  // A Bone Wall stands only in the Area it was raised in.
  for (const piece of [...world.boneWalls]) {
    removeWallPiece(world, piece, false, events);
  }
  const { monsters, projectiles, corpses, groundItems, explored } = world;
  const { boneAltars, goldPiles, burns } = world;
  world.keptAreas[world.areaName] = {
    monsters,
    projectiles,
    corpses,
    groundItems,
    goldPiles,
    explored,
    boneAltars,
    burns,
  };
  world.areaName = area.name;
  const kept = world.keptAreas[area.name];
  delete world.keptAreas[area.name];
  world.monsters = kept?.monsters ?? [];
  world.projectiles = kept?.projectiles ?? [];
  world.corpses = kept?.corpses ?? [];
  world.groundItems = kept?.groundItems ?? [];
  world.goldPiles = kept?.goldPiles ?? [];
  world.boneAltars = kept?.boneAltars ?? [];
  world.burns = kept?.burns ?? [];
  world.explored =
    kept?.explored ??
    new Array(area.width * area.height).fill(area.name === TOWN);
  world.standing = standingIn(world, area);
  revealAround(world);
  world.minions.forEach((minion, index) => {
    placeBesideHero(world, minion, world.minions.slice(index + 1));
  });
  world.heldOrders = [];
  if (!kept) {
    for (const spawn of area.spawns) placePack(world, area, spawn);
    placeBoneAltars(world, area);
    for (const unique of [
      ...area.uniques,
      ...(area.actBoss ? [area.actBoss] : []),
    ]) {
      placeMonster(world, area, unique.monster, unique.pos, unique.name);
    }
  }
  events.push({ type: "AreaChanged", area: area.name, entry: change.entry });
  if (change.entry === null && !change.waypoint && area.name !== TOWN) {
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
  return besideSpot(area, end, townPortalTuning.arriveDistance);
}

/**
 * Where the Hero arrives `arriveDistance` from `end` in `area`: down the
 * screen from it or the nearest way round that is walkable, facing away from
 * it; on `end` itself when none is.
 */
function besideSpot(
  area: Area,
  end: Vec,
  arriveDistance: number,
): { pos: Vec; facing: number } {
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
function walkedInto(hero: Hero, end: Vec, radius: number): boolean {
  return (
    distance(hero.pos, end) <= radius && distance(hero.prevPos, end) > radius
  );
}

/**
 * The name of the active Area when the Hero stands on its Waypoint, which
 * opens the list of Waypoints; null anywhere else.
 */
export function waypointUnderHero(world: World): string | null {
  const { waypoint } = world.areas[world.areaName];
  if (!waypoint) return null;
  return distance(world.hero.pos, waypoint) <= waypointTuning.radius
    ? world.areaName
    : null;
}

/**
 * The Waypoints of the active Area's Act in Main Path order (by the maps'
 * `mainPath` positions, Town first; any without one last, by Area Level),
 * each with whether the Hero has touched it.
 */
export function waypointList(
  world: World,
): { area: string; touched: boolean }[] {
  const { act } = world.areas[world.areaName];
  return Object.values(world.areas)
    .filter((area) => area.waypoint && area.act === act)
    .sort(
      (a, b) =>
        (a.mainPath ?? Number.POSITIVE_INFINITY) -
          (b.mainPath ?? Number.POSITIVE_INFINITY) ||
        (a.areaLevel ?? 0) - (b.areaLevel ?? 0),
    )
    .map((area) => ({
      area: area.name,
      touched: world.hero.progress.touchedWaypoints.includes(area.name),
    }));
}

/**
 * Whether the Hero can travel to the Waypoint in Area `to` now: they stand on
 * another Area's Waypoint and `to` is touched and in the same Act.
 */
function canTravelTo(world: World, to: string): boolean {
  return (
    to !== world.areaName &&
    waypointUnderHero(world) !== null &&
    waypointList(world).some((w) => w.area === to && w.touched)
  );
}

/**
 * Raises `WaypointReached` when the Hero walks onto the active Area's
 * Waypoint, and `WaypointTouched` too the first time.
 */
function touchWaypoint(world: World, events: SimEvent[]) {
  const { hero } = world;
  const { waypoint, name } = world.areas[world.areaName];
  if (!waypoint) return;
  if (!walkedInto(hero, waypoint, waypointTuning.radius)) return;
  events.push({ type: "WaypointReached", area: name });
  if (hero.progress.touchedWaypoints.includes(name)) return;
  hero.progress.touchedWaypoints.push(name);
  events.push({ type: "WaypointTouched", area: name });
}

/** Whether `tile` of the active Area is Explored. */
export function isExplored(world: World, tile: Vec): boolean {
  return cellAt(world.areas[world.areaName], world.explored, tile);
}

/**
 * Explores every tile of the active Area whose centre lies within the tuned
 * radius of the Hero, walls or not.
 */
function revealAround(world: World) {
  const { width, height } = world.areas[world.areaName];
  const { pos } = world.hero;
  const { exploredRadius } = mapTuning;
  const left = Math.max(0, Math.floor(pos.x - exploredRadius));
  const right = Math.min(width - 1, Math.floor(pos.x + exploredRadius));
  const top = Math.max(0, Math.floor(pos.y - exploredRadius));
  const bottom = Math.min(height - 1, Math.floor(pos.y + exploredRadius));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (distance(pos, { x: x + 0.5, y: y + 0.5 }) <= exploredRadius) {
        world.explored[y * width + x] = true;
      }
    }
  }
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
  world.townPortal = { area: area.name, pos: at };
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
    placeMonster(world, area, spawn.monster, pos);
  }
}

/**
 * Puts a new idle Monster of `type` at `pos`, at the Area's Monster Level;
 * a Unique Monster called `unique` when that is given.
 */
function placeMonster(
  world: World,
  area: Area,
  type: MonsterType,
  pos: Vec,
  unique: string | null = null,
): Monster {
  const typeAtLevel: MonsterOfLevel = {
    type,
    monsterLevel: monsterLevelIn(area),
    unique,
  };
  const monster: Monster = {
    kind: "monster",
    id: world.nextMonsterId++,
    type,
    monsterLevel: typeAtLevel.monsterLevel,
    unique,
    pos: { ...pos },
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
    pause: wanderPause(world, type),
    curse: null,
    wall: null,
    swinging: false,
    waves:
      type === "grave_wockington"
        ? { cooldown: msToSteps(graveWockingtonTuning.firstWaveMs), raised: [] }
        : null,
  };
  world.monsters.push(monster);
  return monster;
}

/** How many steps a Bone Altar waits between raising Monsters. */
function raiseSteps(): number {
  return msToSteps(boneAltarTuning.raiseEveryMs);
}

/**
 * Stands the Area's Bone Altars where the map puts them, each blocking its
 * tile, unless a Done Quest has put them away.
 */
function placeBoneAltars(world: World, area: Area) {
  if (boneAltarsPutAway(world.hero.progress.quests, area.name)) return;
  for (const spot of area.boneAltars) {
    const pos = { x: Math.floor(spot.x) + 0.5, y: Math.floor(spot.y) + 0.5 };
    area.walkable[tileIndex(area, pos)] = false;
    world.boneAltars.push({
      kind: "boneAltar",
      id: world.nextMonsterId++,
      pos,
      life: boneAltarTuning.life,
      raised: [],
      cooldown: raiseSteps(),
    });
  }
}

/** The index in a row-major grid of `area` of the tile holding `point`. */
function tileIndex(area: Area, point: Vec): number {
  return Math.floor(point.y) * area.width + Math.floor(point.x);
}

/**
 * Lets each Bone Altar count down and, when it is time and it has fewer
 * living than its limit, raise a zombie or skeleton beside itself.
 */
function stepBoneAltars(world: World, events: SimEvent[]) {
  const { raises } = boneAltarTuning;
  for (const altar of world.boneAltars) {
    const made = raiseWhenDue(world, altar, true, {
      from: altar.pos,
      distance: boneAltarTuning.raiseDistance,
      limit: boneAltarTuning.raisedLimit,
      size: 1,
      type: () => raises[randomInt(world.rng, [0, raises.length - 1])],
      cooldown: raiseSteps(),
    });
    for (const { monster, spot } of made) {
      events.push({
        type: "BoneAltarRaised",
        altar: altar.id,
        monster: monster.id,
        pos: { ...spot },
      });
    }
  }
}

/** How one Bone Altar or Act Boss raises Monsters. */
type Raising = {
  /** What it raises round (the middle of its body). */
  from: Vec;
  /** How far from `from` a raised Monster stands (tiles). */
  distance: number;
  /** How many raised Monsters can be alive at once. */
  limit: number;
  /** How many Monsters one raising makes, room permitting. */
  size: number;
  /** The type of the next Monster raised. */
  type: () => MonsterType;
  /** Steps until the next raising once this one is made. */
  cooldown: number;
};

/**
 * Prunes `raiser`'s dead, and when `active` counts its cooldown down and,
 * once due and with room under the limit, raises up to `raising.size`
 * Monsters round it, each at the nearest free spot to its place, restarting
 * the cooldown. With no room to stand them it
 * tries again next step.
 */
function raiseWhenDue(
  world: World,
  raiser: { raised: MonsterId[]; cooldown: number },
  active: boolean,
  raising: Raising,
): { monster: Monster; spot: Vec }[] {
  raiser.raised = raiser.raised.filter((id) => monsterById(world, id));
  if (!active) return [];
  if (raiser.cooldown > 0) raiser.cooldown -= 1;
  if (raiser.cooldown > 0) return [];
  const count = Math.min(raising.size, raising.limit - raiser.raised.length);
  if (count <= 0) return [];
  const area = world.areas[world.areaName];
  const spots = spotsAround(world, area, raising.from, raising.distance, count);
  // One at a time, so each sees the ones raised before it.
  const made: { monster: Monster; spot: Vec }[] = [];
  for (const asked of spots) {
    const type = raising.type();
    const spot = freeSpot(world, asked, monsterTuning[type].radius);
    if (spot)
      made.push({ monster: placeMonster(world, area, type, spot), spot });
  }
  if (made.length === 0) return [];
  raiser.raised.push(...made.map((m) => m.monster.id));
  raiser.cooldown = raising.cooldown;
  return made;
}

/**
 * Lets each Monster that raises waves (Grave Wockington) count down while it
 * is after the Hero and, when it is time, raise Skeletons around itself, up
 * to its limit of living ones.
 */
function stepWaves(world: World, events: SimEvent[]) {
  for (const boss of [...world.monsters]) {
    const { waves } = boss;
    if (!waves) continue;
    const afterHero = !["idle", "wander", "return", "flee"].includes(
      boss.state,
    );
    const made = raiseWhenDue(world, waves, afterHero, {
      from: boss.pos,
      distance: graveWockingtonTuning.raiseDistance,
      limit: graveWockingtonTuning.raisedLimit,
      size: graveWockingtonTuning.waveSize,
      type: () => graveWockingtonTuning.raises,
      cooldown: msToSteps(graveWockingtonTuning.waveEveryMs),
    });
    if (made.length === 0) continue;
    // Raised already after the Hero.
    for (const { monster } of made) monster.state = "chase";
    events.push({
      type: "WaveRaised",
      boss: boss.id,
      monsters: made.map((m) => m.monster.id),
    });
  }
}

/** How many ways round a body a raised Monster may be stood. */
const RAISE_TURNS = 8;

/**
 * Up to `count` walkable spots round `from` at `distance`, evenly spaced from
 * a different starting way each time.
 */
function spotsAround(
  world: World,
  area: Area,
  from: Vec,
  distance: number,
  count: number,
): Vec[] {
  const first = randomInt(world.rng, [0, RAISE_TURNS - 1]);
  const spots: Vec[] = [];
  for (let i = 0; i < RAISE_TURNS && spots.length < count; i++) {
    const angle = (2 * Math.PI * (first + i)) / RAISE_TURNS;
    const at = {
      x: from.x + distance * Math.cos(angle),
      y: from.y + distance * Math.sin(angle),
    };
    if (isWalkable(area, at)) spots.push(at);
  }
  return spots;
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
  walkHero(world);
  revealAround(world);
  const area = world.areas[world.areaName];
  const exit = exitAt(area, hero.pos);
  if (exit && exit !== exitAt(area, hero.prevPos)) {
    startAreaChange(world, exit.area, exit.entry, events);
    world.tick += 1;
    return events;
  }
  const townPortalEnd = townPortalIn(world);
  if (
    world.townPortal &&
    townPortalEnd &&
    walkedInto(hero, townPortalEnd, townPortalTuning.radius)
  ) {
    const to = world.areaName === TOWN ? world.townPortal.area : TOWN;
    startAreaChange(world, to, null, events);
    world.tick += 1;
    return events;
  }
  touchWaypoint(world, events);
  approach(world);
  reachGroundItem(world, events);
  reachGoldPiles(world, events);
  reachNpc(world, events);
  // Before the Monsters, so an Arrow first shows where it is loosed.
  landProjectiles(world, events);
  const strikes = stepMonsters(world, events);
  fallWithReturning(world, events);
  separateBodies(world);
  for (const { monster, target, wall } of strikes) {
    const attack = monsterAttack(monster);
    if (wall) hurtWall(world, wall, rollWallHit(world, attack), events);
    else strike(world, target, attack, events);
  }
  stepBoneWalls(world, events);
  stepBoneAltars(world, events);
  stepWaves(world, events);
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
  stepMonsters(world, events);
  separateBodies(world);
  stepBoneWalls(world, events);
}

/**
 * Moves every Projectile and lands those that touch the Hero or their Minions,
 * or, for the Hero's, the Monsters. One reaching the Hero on the step another
 * kills them flies on over them.
 */
function landProjectiles(world: World, events: SimEvent[]) {
  const burning = world.burns.length;
  landFlyers(world, events);
  // A Gravefire lands as a burning circle, newest last.
  for (const burn of world.burns.slice(burning)) {
    events.push({
      type: "GravefireLanded",
      at: { ...burn.pos },
      radius: burn.radius,
    });
  }
  stepBurns(
    world,
    (burn, target) => strike(world, target, burn, events),
    (burn) => events.push({ type: "GravefireBurnEnded", at: { ...burn.pos } }),
  );
}

/** Moves every Projectile one step and lands those that touch something. */
function landFlyers(world: World, events: SimEvent[]) {
  stepProjectiles(
    world,
    (projectile, target) => strike(world, target, projectile, events),
    (projectile, target) =>
      // A Skill's damage always hits: no roll against Defense, and no hitstop.
      heroHurts(
        world,
        target,
        splitDamage(randomInt(world.rng, projectile.damage)),
        "skill",
        events,
      ),
    (projectile, piece) =>
      hurtWall(
        world,
        piece,
        unresistedTotal(splitDamage(randomInt(world.rng, projectile.damage))),
        events,
      ),
    (projectile, target) =>
      minionStrike(world, projectile.minion, target, events),
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
  // A Passive Skill is never cast, so it never goes on the Skill Bar.
  // One a Wand already raised may be on it.
  const onBar = SKILL_BAR_SLOTS.some(
    (slot) => progress.skillBar[slot] === skill,
  );
  if (progress.skillLevels[skill] === 0 && !isPassive(skill) && !onBar) {
    progress.skillBar = placeLearnedSkill(progress.skillBar, skill);
  }
  progress.skillLevels[skill] += 1;
  const skillLevel = skillLevelOf(world, skill);
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
  if (skillLevelOf(world, skill) === 0 || isPassive(skill)) return;
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
  if (order.type === "TravelToWaypoint") {
    if (canTravelTo(world, order.area)) {
      startAreaChange(world, order.area, null, events, true);
    }
    return;
  }
  if (order.type === "AcceptQuest" || order.type === "HandInQuest") {
    answerQuest(world, order.quest, order.type === "HandInQuest", events);
    return;
  }
  if (order.type === "SmithBonus") {
    const smith = npcsIn(world).find(
      (npc) => npc.name === SMITH && withinNpcReach(world, npc.id),
    );
    if (smith) giveSmithBonus(world, order.item, events);
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
  if (moveGood(world, order, events) || moveItem(world, order, events)) {
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
      hero.talkingTo = null;
      hero.path = routeHero(world, order.target);
      break;
    case "Walk":
      walkInDirection(world, order.direction);
      break;
    case "Attack": {
      const target = targetById(world, order.monster);
      if (!target) return;
      hero.attacking = target.id;
      hero.pickingUp = null;
      hero.talkingTo = null;
      hero.path = routeHero(world, target.pos, target);
      break;
    }
    case "PickUp": {
      const lying = groundItemById(world, order.groundItem);
      if (!lying) return;
      hero.attacking = null;
      hero.talkingTo = null;
      hero.pickingUp = lying.item.id;
      hero.path = routeHero(world, lying.pos);
      break;
    }
    case "Talk": {
      const npc = area.npcs[order.npc];
      if (!npc || !world.standing.includes(order.npc)) return;
      hero.attacking = null;
      hero.pickingUp = null;
      hero.talkingTo = order.npc;
      hero.path = routeHero(world, npc.pos);
      break;
    }
    case "SwingAt":
      hero.pickingUp = null;
      hero.talkingTo = null;
      startSwing(world, null, order.target);
      break;
    case "Cast":
      castFrom(world, order.slot, order.target, events);
      break;
    case "OpenTownPortal":
      hero.path = [];
      hero.attacking = null;
      hero.pickingUp = null;
      hero.talkingTo = null;
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
  const { effect } = castTuning(skill);
  const corpse = usesCorpse(skill) ? nearestCorpse(world, target) : null;
  if (usesCorpse(skill) && !corpse) {
    events.push({ type: "CastFailed", reason: "corpse" });
    return;
  }
  const skillLevel = skillLevelOf(world, skill);
  if (skillLevel === 0) {
    events.push({ type: "CastFailed", reason: "skillLevel" });
    return;
  }
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
  hero.talkingTo = null;
  hero.cast = { skill, elapsed: 0 };
  events.push({ type: "SkillCast", skill, target: { ...target } });
  switch (effect.type) {
    case "summon":
      summon(world, skill, effect.minion, skillLevel, target, events);
      break;
    case "raise":
      if (corpse) raise(world, skill, effect, skillLevel, corpse, events);
      break;
    case "explode":
      if (corpse) explode(world, skill, effect, skillLevel, corpse, events);
      break;
    case "curse":
      curse(world, skill, effect, skillLevel, target, events);
      break;
    case "projectile":
      looseFromHero(
        world,
        effect,
        skillLevel,
        skillPower(skillLevelsOf(world), skill),
      );
      break;
    case "ward":
      putOnBoneWard(
        hero,
        effect,
        skillLevel,
        skillPower(skillLevelsOf(world), skill),
      );
      break;
    case "wall":
      raiseBoneWall(world, effect, target, events);
      break;
    case "volley":
      loosePlume(
        world,
        effect,
        skillLevel,
        skillPower(skillLevelsOf(world), skill),
      );
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
 * Brings a fresh Minion at full Life at `target`, or the nearest free spot to
 * it a Minion can stand on, crumbling away the one `skill` brought before: the
 * Hero has at most one of each summoned Minion.
 */
function summon(
  world: World,
  skill: CastSkill,
  type: MinionType,
  skillLevel: number,
  target: Vec,
  events: SimEvent[],
) {
  // The one it replaces is about to crumble, so is no Body in the way.
  const replaced = world.minions.filter((minion) => minion.skill === skill);
  const pos = freeSpot(world, target, minionTuning[type].radius, replaced);
  if (!pos) return;
  for (const minion of replaced) crumbleMinion(world, minion, events);
  bringMinion(world, skill, type, skillLevel, pos, events);
}

/**
 * Raises a fresh Minion at full Life from `corpse`, using it up, and
 * crumbles away the oldest ones `skill` brought as needed to keep within
 * the count `effect` allows at `skillLevel`.
 */
function raise(
  world: World,
  skill: CastSkill,
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
  const pos = freeSpot(world, corpse.pos, minionTuning[effect.minion].radius);
  if (!pos) return;
  bringMinion(world, skill, effect.minion, skillLevel, pos, events);
}

/** How far `effect` reaches from its Corpse at `skillLevel` (tiles). */
export function explodeRadius(
  effect: ExplodeEffect,
  skillLevel: number,
): number {
  return effect.radius + effect.radiusPerSkillLevel * (skillLevel - 1);
}

/**
 * Bursts `corpse`, using it up: each Monster within the radius `effect` has
 * at `skillLevel` takes a roll of its share of the dead Monster's max Life.
 * The Hero and their Minions are never hurt, and no other Corpse bursts.
 */
function explode(
  world: World,
  skill: CastSkill,
  effect: ExplodeEffect,
  skillLevel: number,
  corpse: Corpse,
  events: SimEvent[],
) {
  world.corpses = world.corpses.filter((one) => one !== corpse);
  const radius = explodeRadius(effect, skillLevel);
  events.push({
    type: "CorpseExploded",
    corpse: corpse.id,
    pos: { ...corpse.pos },
    radius,
  });
  const life = monsterMaxLife(corpse);
  const [least, most] = effect.share;
  const synergy = skillPower(skillLevelsOf(world), skill);
  const range: [number, number] = [
    Math.ceil(life * least * synergy),
    Math.floor(life * most * synergy),
  ];
  const victims = targetsOf(world).filter(
    (target) => distance(target.pos, corpse.pos) <= radius,
  );
  // A Skill's damage always hits: no roll against Defense, and no hitstop.
  for (const target of victims) {
    const rolled = randomInt(world.rng, range);
    heroHurts(
      world,
      target,
      splitDamage(rolled, effect.damageTypes),
      "skill",
      events,
    );
  }
}

/**
 * How far `effect` reaches from the cast point at `skillLevel` (tiles),
 * times `reach`, what the Skill's Passive Skills make it.
 */
export function curseRadius(
  effect: CurseEffect,
  skillLevel: number,
  reach = 1,
): number {
  return (
    (effect.radius + effect.radiusPerSkillLevel * (skillLevel - 1)) * reach
  );
}

/** How long `effect` lasts at `skillLevel` (steps). */
export function curseSteps(
  effect: CurseEffect,
  skillLevel: number,
  synergy = 1,
): number {
  return msToSteps(
    (effect.durationMs + effect.durationMsPerSkillLevel * (skillLevel - 1)) *
      synergy,
  );
}

/**
 * Curses every Monster within the radius `effect` has at `skillLevel` of
 * `target`, replacing any Curse it had.
 */
function curse(
  world: World,
  skill: CastSkill,
  effect: CurseEffect,
  skillLevel: number,
  target: Vec,
  events: SimEvent[],
) {
  const skillLevels = skillLevelsOf(world);
  const radius = curseRadius(
    effect,
    skillLevel,
    passiveMultiplier(skillLevels, skill),
  );
  events.push({ type: "CurseCast", skill, pos: { ...target }, radius });
  const left = curseSteps(
    effect,
    skillLevel,
    skillPower(skillLevelsOf(world), skill),
  );
  for (const monster of world.monsters) {
    if (distance(monster.pos, target) <= radius) {
      const was = monster.curse && skillTuning[monster.curse.skill].effect;
      monster.curse = { skill, left };
      // A new Curse replaces the old: Dread's Fleeing ends with it, and a
      // Monster walking home keeps walking.
      const fleeing = effect.kind === "dread";
      if (fleeing && monster.state !== "return") {
        monster.state = "flee";
        monster.path = [];
        monster.attack = 0;
      } else if (
        !fleeing &&
        monster.state === "flee" &&
        was?.type === "curse" &&
        was.kind === "dread"
      ) {
        monster.state = "chase";
        monster.path = [];
        monster.replan = 0;
      }
    }
  }
}

/**
 * The damage `effect`'s Projectile deals per hit at `skillLevel`, times the
 * Skill's Synergies (`synergy`).
 */
export function projectileDamage(
  effect: ProjectileEffect | VolleyEffect,
  skillLevel: number,
  synergy = 1,
): [number, number] {
  const more = effect.damagePerSkillLevel * (skillLevel - 1);
  return [
    Math.round((effect.damage[0] + more) * synergy),
    Math.round((effect.damage[1] + more) * synergy),
  ];
}

/**
 * Looses `effect`'s Projectile from the Hero the way they face, its damage
 * grown by the Skill's Synergies (`synergy`).
 */
function looseFromHero(
  world: World,
  effect: ProjectileEffect,
  skillLevel: number,
  synergy: number,
) {
  looseShard(world, effect, skillLevel, synergy, world.hero.facing);
}

/**
 * Looses `effect`'s fan of shards from the Hero, centred on the way they
 * face, each its own Projectile growing with the Skill's Synergies.
 */
function loosePlume(
  world: World,
  effect: VolleyEffect,
  skillLevel: number,
  synergy: number,
) {
  const spread = (effect.spreadDegrees * Math.PI) / 180;
  for (let i = 0; i < effect.shards; i++) {
    const along = effect.shards === 1 ? 0.5 : i / (effect.shards - 1);
    const angle = world.hero.facing + (along - 0.5) * spread;
    looseShard(world, effect, skillLevel, synergy, angle);
  }
}

/** Looses one Hero Projectile of `effect` from the Hero along `angle`. */
function looseShard(
  world: World,
  effect: ProjectileEffect | VolleyEffect,
  skillLevel: number,
  synergy: number,
  angle: number,
) {
  const { hero } = world;
  world.projectiles.push({
    kind: effect.projectile,
    pos: { ...hero.pos },
    prevPos: { ...hero.pos },
    direction: { x: Math.cos(angle), y: Math.sin(angle) },
    speed: perStep(effect.speed),
    rangeLeft: effect.range,
    from: "hero",
    damage: projectileDamage(effect, skillLevel, synergy),
    hit: [],
  });
}

/**
 * How much `effect`'s Bone Ward soaks up at `skillLevel`, times the Skill's
 * Synergies (`synergy`).
 */
export function wardAmount(
  effect: WardEffect,
  skillLevel: number,
  synergy = 1,
): number {
  return Math.round(
    (effect.amount + effect.amountPerSkillLevel * (skillLevel - 1)) * synergy,
  );
}

/**
 * Puts a full Bone Ward on the Hero for `skillLevel`, replacing whatever is
 * left of theirs.
 */
function putOnBoneWard(
  hero: Hero,
  effect: WardEffect,
  skillLevel: number,
  synergy: number,
) {
  const full = wardAmount(effect, skillLevel, synergy);
  hero.boneWard = { left: full, full };
}

/**
 * Raises `effect`'s Bone Wall across the Hero's line to `target`, a piece on
 * each of its tiles that is walkable and has no Body in it.
 */
function raiseBoneWall(
  world: World,
  effect: WallEffect,
  target: Vec,
  events: SimEvent[],
) {
  const area = world.areas[world.areaName];
  const { hero } = world;
  const raised: Vec[] = [];
  for (const spot of wallSpots(hero.pos, target, hero.facing, effect.length)) {
    const id = tileIndex(area, spot);
    if (!isWalkable(area, spot) || bodyInTile(world, spot)) continue;
    area.walkable[id] = false;
    area.lowWalled[id] = true;
    world.boneWalls.push({
      id,
      pos: spot,
      life: effect.pieceLife,
      left: msToSteps(effect.durationMs),
    });
    raised.push({ ...spot });
  }
  if (raised.length > 0)
    events.push({ type: "BoneWallRaised", pieces: raised });
}

/** Whether the Body of the Hero, a Minion or a Monster touches the tile at `spot`. */
function bodyInTile(world: World, spot: Vec): boolean {
  const bodies = monsterBodies(world).concat(heroSideBodies(world));
  return bodies.some(
    (body) =>
      Math.abs(body.pos.x - spot.x) < 0.5 + wallRadius(body.radius) &&
      Math.abs(body.pos.y - spot.y) < 0.5 + wallRadius(body.radius),
  );
}

/** Takes `piece` down, freeing its tile; `broken` when Monsters did it. */
function removeWallPiece(
  world: World,
  piece: BoneWallPiece,
  broken: boolean,
  events: SimEvent[],
) {
  const area = world.areas[world.areaName];
  area.walkable[piece.id] = true;
  area.lowWalled[piece.id] = false;
  world.boneWalls = world.boneWalls.filter((one) => one !== piece);
  events.push({ type: "BoneWallCrumbled", pos: { ...piece.pos }, broken });
}

/** Rolls a Monster's attack on a Bone Wall piece, which has no Resistance. */
function rollWallHit(world: World, attack: AttackNumbers): number {
  return unresistedTotal(
    splitDamage(randomInt(world.rng, attack.damage), attack.damageTypes),
  );
}

/** Lands `damage` from a Monster's side on a Bone Wall piece. */
function hurtWall(
  world: World,
  piece: BoneWallPiece,
  damage: number,
  events: SimEvent[],
) {
  // Whatever hit it after it fell finds nothing.
  if (!world.boneWalls.includes(piece)) return;
  piece.life = Math.max(0, piece.life - damage);
  events.push({ type: "BoneWallHit", pos: { ...piece.pos }, damage });
  if (piece.life <= 0) removeWallPiece(world, piece, true, events);
}

/** Counts every Bone Wall piece down, crumbling those whose time is up. */
function stepBoneWalls(world: World, events: SimEvent[]) {
  for (const piece of [...world.boneWalls]) {
    piece.left -= 1;
    if (piece.left <= 0) removeWallPiece(world, piece, false, events);
  }
}

/** Adds a fresh Minion at full Life at `pos` to the Hero's Minions. */
function bringMinion(
  world: World,
  skill: CastSkill,
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
    skillPower(skillLevelsOf(world), skill),
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
  hero.talkingTo = null;
  if (direction.x === 0 && direction.y === 0) return;
  hero.facing = Math.atan2(direction.y, direction.x);
  const area = world.areas[world.areaName];
  const to = stepInDirection(
    area,
    hero.pos,
    direction,
    heroWalkPerStep(world),
    heroTuning.radius,
  );
  if (to) {
    hero.pos = slideAround(
      area,
      hero.pos,
      to,
      heroTuning.radius,
      monsterBodies(world),
    );
  }
}

/** Swings at the Monster the Hero walks to once it is in reach. */
function approach(world: World) {
  const { hero } = world;
  if (hero.attacking === null || hero.swing) return;
  const monster = targetById(world, hero.attacking);
  if (!monster) {
    hero.attacking = null;
    hero.path = [];
  } else if (gapTo(hero.pos, monster) <= heroTuning.reach) {
    startSwing(world, monster.id, monster.pos);
  } else if (hero.path.length === 0) {
    // Walked as near as it can get, still out of reach.
    hero.attacking = null;
  }
}

/**
 * Whether the Hero is close enough to the active Area's NPC `npc` to keep
 * talking to them; false for an NPC the Area doesn't have.
 */
export function withinNpcReach(world: World, npc: number): boolean {
  const there = world.areas[world.areaName].npcs[npc];
  return !!there && distance(world.hero.pos, there.pos) <= heroTuning.talkLeave;
}

/**
 * The indices in `area`'s `npcs` of the NPCs that stand there now, as the
 * Quests stand: those placed under no condition, or whose condition holds.
 */
function standingIn(world: World, area: Area): number[] {
  return area.npcs.flatMap((npc, id) => (stillStands(world, npc) ? [id] : []));
}

/** Whether `npc`'s condition holds as the Quests stand now. */
function stillStands(world: World, npc: Npc): boolean {
  if (!npc.stands) return true;
  const { state } = questOf(world, npc.stands.quest);
  return (state === "ready" || state === "done") === npc.stands.ready;
}

/**
 * The NPCs standing in the active Area, each with its index in the Area's
 * `npcs`, which stays the same whoever else stands there.
 */
export function npcsIn(world: World): { id: number; name: string; pos: Vec }[] {
  const { npcs } = world.areas[world.areaName];
  return world.standing.flatMap((id) =>
    npcs[id] ? [{ id, name: npcs[id].name, pos: npcs[id].pos }] : [],
  );
}

/** How far the Quest `quest` has got. */
export function questOf(world: World, quest: QuestId): QuestProgress {
  return { ...world.hero.progress.quests[quest] };
}

/** Whether NPC `npc` of the active Area has a Quest to give or take back. */
export function hasQuestToDeal(world: World, npc: number): boolean {
  const there = world.areas[world.areaName].npcs[npc];
  return (
    !!there &&
    world.standing.includes(npc) &&
    hasQuestBusiness(world.hero.progress.quests, there.name)
  );
}

/**
 * Notes that the Hero did `deed`, moving on every Quest that asks for it
 * and reporting it. Deeds count whenever they happen, given or not.
 */
function noteDeed(world: World, deed: QuestDeed, events: SimEvent[]) {
  const { quests } = world.hero.progress;
  for (const quest of Object.keys(quests) as QuestId[]) {
    const result = advanceQuest(quests, quest, deed);
    if (result === "counted") {
      events.push({ type: "QuestCounted", quest, count: quests[quest].count });
    }
    if (result === "ready") events.push({ type: "QuestReady", quest });
  }
}

/**
 * Gives or hands in `quest` to its giver, when the Hero is within reach of
 * them: giving a Quest Not given, or, with `handIn`, making a Ready one Done
 * and paying its reward once, as a Level-up pays its points.
 */
function answerQuest(
  world: World,
  quest: QuestId,
  handIn: boolean,
  events: SimEvent[],
) {
  const { progress } = world.hero;
  const { giver, reward } = questTuning[quest];
  const { state } = questOf(world, quest);
  if (state !== (handIn ? "ready" : "notGiven")) return;
  const there = npcsIn(world).find(
    (npc) => npc.name === giver && withinNpcReach(world, npc.id),
  );
  if (!there || !questsOf(giver).includes(quest)) return;
  if (!handIn) {
    progress.quests[quest].state = "given";
    events.push({ type: "QuestGiven", quest });
    return;
  }
  progress.quests[quest].state = "done";
  if (reward.type === "attributePoints") {
    progress.attributePoints += reward.amount;
  }
  if (reward.type === "skillPoints") progress.skillPoints += reward.amount;
  if (reward.type === "smithService" && progress.smithService === "locked") {
    progress.smithService = "unlocked";
  }
  events.push({ type: "QuestDone", quest });
}

/** Talks to the NPC the Hero walks to once they are in reach. */
function reachNpc(world: World, events: SimEvent[]) {
  const { hero } = world;
  if (hero.talkingTo === null) return;
  const npc = world.areas[world.areaName].npcs[hero.talkingTo];
  if (!npc) {
    hero.talkingTo = null;
    hero.path = [];
    return;
  }
  if (distance(hero.pos, npc.pos) > heroTuning.talkReach) {
    // Walked as near as it can get, still out of reach.
    if (hero.path.length === 0) hero.talkingTo = null;
    return;
  }
  events.push({ type: "Talked", npc: hero.talkingTo, name: npc.name });
  const talkedTo = hero.talkingTo;
  hero.talkingTo = null;
  hero.path = [];
  noteDeed(world, { type: "talked", npc: npc.name }, events);
  // An NPC whose condition no longer holds goes home now, though the
  // Dialogue panel keeps their words; the Area judges them again on the next
  // arrival.
  if (!world.standing.includes(talkedTo)) return;
  world.standing = world.standing.filter(
    (id) => id !== talkedTo || stillStands(world, npc),
  );
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

/**
 * Picks up every Gold Pile the Hero has come within `goldTuning.pickupReach`
 * of, with no Order, whatever the Inventory holds. Never during Death.
 */
function reachGoldPiles(world: World, events: SimEvent[]) {
  if (world.death) return;
  const { hero } = world;
  const reached = world.goldPiles.filter(
    (pile) => distance(hero.pos, pile.pos) <= goldTuning.pickupReach,
  );
  if (reached.length === 0) return;
  world.goldPiles = world.goldPiles.filter((pile) => !reached.includes(pile));
  for (const { amount } of reached) {
    hero.progress.gold += amount;
    events.push({ type: "GoldPickedUp", amount });
  }
}

function startSwing(world: World, monster: MonsterId | null, toward: Vec) {
  const { hero } = world;
  faceToward(hero, toward);
  hero.swing = {
    elapsed: 0,
    steps: heroSwingSteps(world),
    hitStep: heroHitStep(world),
    landed: false,
    monster,
  };
  hero.attacking = null;
  hero.path = [];
}

function advanceSwing(world: World, swing: Swing, events: SimEvent[]) {
  const { hero } = world;
  swing.elapsed += 1;
  if (swing.elapsed === swing.hitStep) land(world, swing, events);
  if (swing.elapsed < swing.steps) return;

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
  const victims = targetsOf(world).filter((target) => {
    const gap = gapTo(hero.pos, target);
    if (swing.monster !== null) {
      return (
        target.id === swing.monster &&
        gap <= heroTuning.reach + heroTuning.reachGrace
      );
    }
    return lands(
      hero,
      target.pos,
      heroTuning.reach + altarRadiusOf(target),
      ARC,
    );
  });

  for (const target of victims) {
    // A Bone Altar has no Defense to roll against.
    if (isBoneAltar(target)) {
      world.hitstop = HITSTOP_STEPS;
      hit(world, target, events);
    } else if (random(world.rng) < heroChanceToHit(world, target)) {
      world.hitstop = HITSTOP_STEPS;
      hit(world, target, events);
    } else {
      miss(world, target, events);
    }
  }
}

/** How far `from` is from the edge of `target` (tiles). */
function gapTo(from: Vec, target: Monster | BoneAltar): number {
  return Math.max(0, distance(from, target.pos) - altarRadiusOf(target));
}

/**
 * A Miss deals no damage, so it neither flinches the Monster nor keeps the
 * Hero In Combat, but the Monster still notices the Hero.
 */
function miss(world: World, monster: Monster, events: SimEvent[]) {
  events.push({ type: "Missed", target: monster.id });
  noticeHit(world, monster);
}

function hit(world: World, target: Monster | BoneAltar, events: SimEvent[]) {
  const damage = heroAttackDamage(world, random(world.rng));
  heroHurts(world, target, damage, "hero", events);
}

/**
 * Lands `rolled` damage from the Hero's swing or Skill on a Monster, keeping
 * the Hero In Combat. A Bone Altar has no Resistances.
 */
function heroHurts(
  world: World,
  target: Monster | BoneAltar,
  rolled: Damage,
  attacker: "hero" | "skill",
  events: SimEvent[],
) {
  world.hero.combat = COMBAT_STEPS;
  if (isBoneAltar(target))
    hurtAltar(world, target, unresistedTotal(rolled), events);
  else takeDamage(world, target, rolled, attacker, events);
}

/**
 * Lands `damage` from the Hero's side on a Bone Altar: at 0 Life it is
 * destroyed, freeing its tile and counting towards the Quests that ask for it.
 */
function hurtAltar(
  world: World,
  altar: BoneAltar,
  damage: number,
  events: SimEvent[],
) {
  // Whatever hit it after it fell finds nothing.
  if (!world.boneAltars.includes(altar)) return;
  altar.life = Math.max(0, altar.life - damage);
  events.push({ type: "BoneAltarHit", altar: altar.id, damage });
  if (altar.life > 0) return;
  const area = world.areas[world.areaName];
  world.boneAltars = world.boneAltars.filter((one) => one !== altar);
  area.walkable[tileIndex(area, altar.pos)] = true;
  events.push({
    type: "BoneAltarDestroyed",
    altar: altar.id,
    area: area.name,
    pos: { ...altar.pos },
  });
  noteDeed(world, { type: "boneAltarDestroyed", area: area.name }, events);
}

/**
 * Lands `rolled` damage from the Hero's side on a Monster: each Element cut by
 * its type's Resistance, then more if a Curse makes it take more.
 */
function takeDamage(
  world: World,
  monster: Monster,
  rolled: Damage,
  attacker: "hero" | "minion" | "skill",
  events: SimEvent[],
) {
  const { total: damage, main } = landDamage(
    rolled,
    monsterResistances(monster.type),
    damageTaken(monster),
  );
  monster.life = Math.max(0, monster.life - damage);
  events.push({
    type: "HitLanded",
    attacker,
    target: monster.id,
    damage,
    damageType: main,
  });
  hurt(world, monster, events);
}

/** How many times the damage it is dealt a Monster takes, for its Curse. */
function damageTaken(monster: Monster): number {
  if (!monster.curse) return 1;
  const { effect } = skillTuning[monster.curse.skill];
  return effect.type === "curse" && effect.kind === "amplifyDamage"
    ? effect.damageTaken
    : 1;
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
      monsterLevel: monster.monsterLevel,
      pos: monster.pos,
    });
    events.push({ type: "MonsterDied", id: monster.id });
    fallRaised(world, monster, events);
    gainExperience(
      world,
      killExperience(monster, world.hero.progress.level),
      events,
    );
    rollDrop(
      world,
      monster.pos,
      events,
      monster.unique !== null,
      monster.monsterLevel,
    );
    if (monster.unique !== null) {
      const { name } = world.areas[world.areaName];
      noteDeed(world, { type: "uniqueKilled", area: name }, events);
    }
    const { actBoss, act } = world.areas[world.areaName];
    if (
      actBoss &&
      act !== null &&
      monster.unique === actBoss.name &&
      monster.type === actBoss.monster
    ) {
      const completes = actBossQuestOpen(world.hero.progress.quests, act);
      noteDeed(world, { type: "actBossKilled", act }, events);
      if (completes) events.push({ type: "ActCompleted", act });
    }
    return;
  }
  noticeHit(world, monster);
  if (random(world.rng) < monsterTuning[monster.type].flinchChance) {
    flinchMonster(monster);
  }
}

/**
 * Every living Monster `raiser` raised dies at once: each leaves its Corpse,
 * but gives no Experience and drops nothing.
 */
function fallRaised(world: World, raiser: Monster, events: SimEvent[]) {
  if (!raiser.waves) return;
  const fallen = world.monsters.filter((m) =>
    raiser.waves?.raised.includes(m.id),
  );
  raiser.waves.raised = [];
  world.monsters = world.monsters.filter((m) => !fallen.includes(m));
  for (const monster of fallen) {
    world.corpses.push({
      id: monster.id,
      type: monster.type,
      monsterLevel: monster.monsterLevel,
      pos: monster.pos,
    });
    events.push({ type: "MonsterDied", id: monster.id });
  }
}

/** Lets the raised Monsters of every raiser that is Returning fall dead. */
function fallWithReturning(world: World, events: SimEvent[]) {
  for (const monster of world.monsters) {
    if (monster.state === "return") fallRaised(world, monster, events);
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
 * inclusive and split over Damage Types by `shares`, or null for a Miss. A
 * certain hit rolls only its damage, so the rolls after it stay as they were.
 */
function rollAttack(
  world: World,
  chance: number,
  range: [number, number],
  shares?: DamageShares,
): Damage | null {
  if (chance < 1 && random(world.rng) >= chance) return null;
  return splitDamage(randomInt(world.rng, range), shares);
}

/**
 * Lands a Minion's attack on a Monster: it rolls the Minion's
 * Attack Rating against the Monster's Defense, and a hit hurts it as the
 * Hero's do. Neither keeps the Hero In Combat, and there is no hitstop.
 */
function minionStrike(
  world: World,
  minion: MinionOfLevel,
  monster: Monster | BoneAltar,
  events: SimEvent[],
) {
  if (isBoneAltar(monster)) {
    hurtAltar(
      world,
      monster,
      unresistedTotal(
        splitDamage(randomInt(world.rng, minionDamageRange(minion))),
      ),
      events,
    );
    return;
  }
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
  takeDamage(world, monster, damage, "minion", events);
}

/**
 * Rolls a dying Monster's drops, each lying where it died: by
 * `dropTuning.chance` one Item, then by `potionDropTuning.chance` one Potion,
 * each of a type picked with equal odds. `monsterLevel` is the dying
 * Monster's, which decides the grades its Items' Affixes can roll. A Unique Monster's Items are
 * rolled once for each of `uniqueTuning.itemDrops` instead.
 */
function rollDrop(
  world: World,
  pos: Vec,
  events: SimEvent[],
  unique: boolean,
  monsterLevel: number,
) {
  const itemDrops = unique
    ? uniqueTuning.itemDrops.map((only) => ({
        chance: 1,
        items: dropTuning.items,
        only,
      }))
    : [{ ...dropTuning, only: undefined }];
  const potionDrop = { ...potionDropTuning, only: undefined };
  for (const { chance, items, only } of [...itemDrops, potionDrop]) {
    if (chance < 1 && random(world.rng) >= chance) continue;
    const type = items[randomInt(world.rng, [0, items.length - 1])];
    const item: Item = {
      id: world.nextItemId++,
      type,
      ...rollItem(world.rng, type, monsterLevel, unique, only),
    };
    world.groundItems.push({ item, pos: { ...pos } });
    events.push({
      type: "ItemDropped",
      item: { ...item, affixes: item.affixes.map((a) => ({ ...a })) },
      pos: { ...pos },
    });
  }
  rollGold(world, pos, events, monsterLevel);
}

/**
 * Rolls a dying Monster's Gold Pile, apart from its Items: by
 * `goldTuning.chance` one pile where it died, holding an amount from
 * `goldTuning.perMonsterLevel` times `monsterLevel`. Rolled last, so the
 * Item rolls stay as they were.
 */
function rollGold(
  world: World,
  pos: Vec,
  events: SimEvent[],
  monsterLevel: number,
) {
  if (goldTuning.chance < 1 && random(world.rng) >= goldTuning.chance) return;
  const [least, most] = goldTuning.perMonsterLevel;
  const amount = randomInt(world.rng, [
    least * monsterLevel,
    most * monsterLevel,
  ]);
  const pile = { id: world.nextGoldPileId++, amount, pos: { ...pos } };
  world.goldPiles.push(pile);
  events.push({
    type: "GoldDropped",
    pile: pile.id,
    amount,
    pos: { ...pos },
  });
}

/**
 * Lands a Monster's attack, a melee one or a Projectile, on the Hero. A Hero
 * with 0 Defense is always hit; above it the attack can Miss, which deals no
 * damage, so it neither flinches the Hero nor keeps them In Combat. A hit's
 * damage comes off their Bone Ward first, gone once used up, and only the
 * rest off their Life. An attack that would hit can still be Blocked by an
 * Equipped Shield (see `heroBlockChance`): that too deals no damage, never
 * flinches the Hero and leaves their Bone Ward be, but keeps them In Combat.
 */
function hitHero(world: World, attack: AttackNumbers, events: SimEvent[]) {
  const { hero } = world;
  const chance = heroChanceToBeHit(world, attack.attackRating);
  if (chance < 1 && random(world.rng) >= chance) {
    events.push({ type: "Missed", target: "hero" });
    return;
  }
  // A Block is rolled once the attack would hit, before any damage. With no
  // Shield nothing is rolled, so the rolls after it stay as they were.
  const blockChance = heroBlockChance(world);
  if (blockChance > 0 && random(world.rng) * 100 < blockChance) {
    hero.combat = COMBAT_STEPS;
    events.push({ type: "Blocked" });
    return;
  }
  const rolled = splitDamage(
    randomInt(world.rng, attack.damage),
    attack.damageTypes,
  );
  const { total: damage, main: damageType } = landDamage(
    rolled,
    heroResistances(world),
  );
  const warded = Math.min(damage, hero.boneWard?.left ?? 0);
  if (hero.boneWard) {
    hero.boneWard.left -= warded;
    if (hero.boneWard.left <= 0) hero.boneWard = null;
  }
  hero.life = Math.max(0, hero.life - (damage - warded));
  hero.combat = COMBAT_STEPS;
  events.push({
    type: "HeroHit",
    damage: damage - warded,
    warded,
    damageType,
  });
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
  hero.talkingTo = null;
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
  const rolled = rollAttack(
    world,
    chanceToHit(attack.attackRating, minionDefense(minion)),
    attack.damage,
    attack.damageTypes,
  );
  if (rolled === null) {
    events.push({ type: "MinionMissed", minion: minion.id });
    return;
  }
  const { total: damage, main: damageType } = landDamage(
    rolled,
    minionResistances(minion.type),
  );
  minion.life = Math.max(0, minion.life - damage);
  events.push({ type: "MinionHit", minion: minion.id, damage, damageType });
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
 * running Potion effect and their Bone Ward, crumbles their Minions away
 * and sends every Monster home.
 */
function die(world: World, events: SimEvent[]) {
  world.death = { elapsed: 0 };
  world.trading = false;
  world.hero.potionEffects = [];
  world.hero.boneWard = null;
  for (const minion of world.minions) crumbleMinion(world, minion, events);
  for (const monster of world.monsters) sendHome(monster);
  fallWithReturning(world, events);
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

/** The Monster or Bone Altar called `id` in the active Area, if any. */
function targetById(
  world: World,
  id: MonsterId,
): Monster | BoneAltar | undefined {
  return (
    monsterById(world, id) ?? world.boneAltars.find((altar) => altar.id === id)
  );
}

function monsterById(world: World, id: MonsterId): Monster | undefined {
  return world.monsters.find((monster) => monster.id === id);
}

/**
 * The path for the Hero to walk to `to`, around the Monsters in the way bar
 * `except`, the one it walks up to.
 */
function routeHero(world: World, to: Vec, except?: object): Vec[] {
  const radius = heroTuning.radius;
  return findPath(
    world.areas[world.areaName],
    world.hero.pos,
    to,
    radius,
    monsterBodies(world, except),
    radius,
  );
}

/**
 * Walks the Hero a step along their path. A step that runs into a Monster
 * is undone (sliding along it where the way is open), and the Hero plans a
 * new route around it to where the path was going.
 */
function walkHero(world: World) {
  const { hero } = world;
  if (hero.path.length === 0) return;
  const before = hero.pos;
  const goal = hero.path[hero.path.length - 1];
  const except =
    hero.attacking === null ? null : monsterById(world, hero.attacking);
  const obstacles = monsterBodies(world, except);
  walk(hero, heroWalkPerStep(world));
  const radius = heroTuning.radius;
  const gait = { radius, replanSteps: 1, body: { radius, obstacles } };
  if (holdBack(world.areas[world.areaName], hero, before, gait)) {
    hero.path = routeHero(world, goal, except ?? undefined);
  }
}

/** Moves the Hero one step along its path, carrying over past waypoints. */
function walk(hero: Hero, perStepBudget: number) {
  let budget = perStepBudget;
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
