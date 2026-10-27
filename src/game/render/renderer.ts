import {
  type Application,
  CanvasTextMetrics,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
} from "pixi.js";
import type { CursorHit } from "../cursor";
import type { Fullscreen } from "../fullscreen";
import type { ActiveInput } from "../input/activeInput";
import { castButton } from "../input/pad";
import { buttonsHeld, stickHeld, type TouchControls } from "../input/touch";
import { toScreen, toTile } from "../iso";
import {
  type FullscreenChoice,
  type HeroState,
  type MenuChoice,
  type Menus,
  noPendingPoints,
  type Panel,
  type PendingPoints,
} from "../menus";
import type { Pause } from "../pause";
import { type Area, isFloor } from "../sim/area";
import { beltOf, beltRows, isBeltCell } from "../sim/belt";
import {
  cursorItemOf,
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
  equipmentOf,
  type ItemId,
  type ItemSpot,
  inventoryOf,
  isCell,
  isSlot,
  placement,
} from "../sim/inventory";
import { minionWindUpProgress } from "../sim/minions";
import { monsterMaxLife, windUpProgress } from "../sim/monsters";
import { inside, middleOf, type Rect } from "../sim/rect";
import type { SkillBarSlot } from "../sim/skillBar";
import { STEP_MS } from "../sim/units";
import { tileOf, type Vec } from "../sim/vec";
import {
  ATTRIBUTES,
  areaFade,
  CAST_STEPS,
  DEATH_STEPS,
  FLINCH_STEPS,
  groundItemsOf,
  HERO_FLINCH_STEPS,
  HIT_STEP,
  inTown,
  isInCombat,
  isRegenerating,
  type MinionId,
  type MinionType,
  type MonsterId,
  OPENING_STEPS,
  type SimEvent,
  SWING_STEPS,
  townPortalFlash,
  townPortalIn,
  type World,
} from "../sim/world";
import { heroTuning } from "../tuning/hero";
import { inputTuning } from "../tuning/input";
import { type ItemType, itemOf } from "../tuning/items";
import { minionTuning } from "../tuning/minions";
import {
  type MeleeTuning,
  type MonsterType,
  monsterTuning,
} from "../tuning/monsters";
import { type Skill, skillTuning } from "../tuning/skills";
import { townPortalLook } from "../tuning/townPortalLook";
import { atUiScale, type Viewport, viewportOf } from "../viewport";
import { type Compass, compassOf, frameAt, swingFrame } from "./animation";
import {
  areaBannerLayout,
  arrivedInDisplayName,
  bannerOpacityAt,
} from "./areaBanner";
import { type Animation, type Art, type CharacterArt, frameOf } from "./art";
import { beltStripLayout, beltStripSheet } from "./beltStrip";
import { type Camera, cameraOn, onScreen, onWorld } from "./camera";
import { CLOSE_BUTTON } from "./closeButton";
import { cursorHitAt, type ShownPanels } from "./cursorHit";
import {
  DAMAGE_NUMBER,
  type DamageNumber,
  damageNumbers,
  floatAt,
  floatText,
} from "./damageNumbers";
import {
  EXPERIENCE_BAR,
  experienceBar,
  experienceBarLayout,
} from "./experienceBar";
import {
  GROUND_LABEL,
  type GroundLabel,
  groundItemUnder,
  groundLabelAt,
  groundLabels,
} from "./groundLabels";
import {
  HERO_PANEL,
  hasUnspentPoints,
  heroPanelLayout,
  heroPanelRow,
  heroSheet,
  PANEL_ROWS,
} from "./heroPanel";
import { deathHint, panelCloseHint, resumeHint, skillTooltip } from "./hints";
import {
  type CharacterId,
  characterUnder,
  hoveredOf,
  nameplateLayout,
  nameplateOf,
  type Pickable,
} from "./hover";
import {
  heldItemRect,
  INVENTORY_PANEL,
  type InventoryPanelLayout,
  inventoryPanelLayout,
  itemRect,
  itemTooltip,
  itemUnder,
  landingCell,
} from "./inventoryPanel";
import { itemColour, itemLabel } from "./itemArt";
import { type Orb, orbFill, orbsLayout } from "./orbs";
import {
  hoveredPanelButton,
  panelButtonsLayout,
  panelButtonsSheet,
  panelButtonTooltipRect,
  townPortalButtonSheet,
} from "./panelButtons";
import {
  type MenuButton,
  menuChoiceAt,
  PAUSE_MENU_LAYOUT,
  pauseMenuLayout,
} from "./pauseMenu";
import {
  ROTATE_NOTICE_LAYOUT,
  rotateNoticeChoiceAt,
  rotateNoticeLayout,
  rotateNoticeText,
} from "./rotateNotice";
import { SKILL_BAR, skillBarLayout, skillBarSheet } from "./skillBar";
import {
  SKILL_TREE_PANEL,
  SKILL_TREE_ROWS,
  skillRow,
  skillTreeColumns,
  skillTreePanelLayout,
  skillTreeRow,
  skillTreeSheet,
} from "./skillTreePanel";
import { tooltipRect } from "./tooltip";
import { touchControlsLayout, touchControlsShown } from "./touchControls";
import {
  townPortalCloseScale,
  townPortalGlow,
  townPortalOpenScale,
  townPortalPixels,
  townPortalSparks,
} from "./townPortalLook";

const HOVER_LINE = 0xd8c48a;
const MARKER_LINE = 0xe8d27a;

/** How long a hit Monster flashes white (ms), fading out. */
const FLASH_MS = 120;
/** How white a hit Monster turns at the start of its flash (0..1). */
const FLASH_STRENGTH = 0.8;

/**
 * The Hero's flash on reaching a new Level: its length (ms), fading out, how
 * strongly it washes them gold at the start (0..1), and a gold ring spreading
 * out at their feet to `ringRadius` (tiles).
 */
const LEVEL_UP = {
  ms: 800,
  strength: 0.7,
  colour: 0xffd75a,
  ringRadius: 1.4,
  ringWidth: 3,
};

/** The screen's red flash when the Hero is hit: its length (ms), fading out. */
const HURT_MS = 150;
/** How opaque the red flash starts (0..1). */
const HURT_STRENGTH = 0.3;
const HURT_COLOUR = 0xff0000;

/**
 * The Hero's Death on screen: it darkens to `darkness` over `DEATH_STEPS`,
 * then shows "You died" over a hint that pulses `pulsesPerSecond` times a
 * second.
 */
const DEATH_SCREEN = {
  darkness: 0.55,
  title: { colour: 0xb01818, size: 64 },
  hint: { colour: 0xd8d0b8, size: 18, gap: 24 },
  pulsesPerSecond: 0.8,
  /** How faint the hint gets at the bottom of a pulse (0..1). */
  faintest: 0.35,
};

/**
 * The ring round the Focus in a panel, and round the pause-menu button a
 * controller has picked (CSS px at native scale).
 */
const FOCUS_RING = { colour: 0xfff4c0, width: 3 };

/**
 * The pause menu's look: a dark panel in the middle of a darkened screen,
 * with the art's credit, the New Hero button and a hint to resume. Asking to
 * confirm a New Hero, the question takes the place of the credit, and Yes
 * and No that of the button. Where things go is `PAUSE_MENU_LAYOUT`.
 */
const PAUSE_MENU = {
  darkness: 0.6,
  panel: { colour: 0x17130e, edge: 0x5a4a2e },
  title: { colour: 0xe8d27a, size: 40, top: 28 },
  credit: { colour: 0xd8d0b8, size: 15, top: 96, lineHeight: 22 },
  button: { size: 17 },
  question: { colour: 0xd8d0b8, size: 17, top: 110, lineHeight: 28 },
  hint: { colour: 0x9a9080, size: 14, bottom: 26 },
};

/**
 * A placeholder telegraph: a red wedge over a Monster's reach and arc, filling
 * outwards as it winds up.
 */
const TELEGRAPH_COLOUR = 0xd02a1e;
/** How opaque the whole wedge and its filled part are (0..1). */
const TELEGRAPH_ALPHA = { reach: 0.12, filled: 0.35 };
const TELEGRAPH_SEGMENTS = 12;

/**
 * Each Monster type's size against Flare's native scale: the one number to
 * change if a type looks off. Each is drawn as Flare made it.
 */
const MONSTER_SCALE: Record<MonsterType, number> = {
  skeleton: 1,
  zombie: 1,
  skeleton_archer: 1,
};
/**
 * How long a screen-east Projectile's art is per tile it spans: a tile of
 * flight straight across the screen, so flight in any other direction is
 * drawn foreshortened as the floor is.
 */
const PROJECTILE_EAST_LENGTH = Math.hypot(
  toScreen({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }).x,
  toScreen({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }).y,
);
/**
 * Placeholder NPCs are drawn with the Hero's art, tinted so they can't be
 * mistaken for the Hero, facing down the screen.
 */
const NPC = { tint: 0x8c9ccc, compass: "s" } satisfies {
  tint: number;
  compass: Compass;
};
/** How far apart NPCs' idle animations run (ms), so they don't breathe in step. */
const NPC_STAGGER_MS = 337;
/**
 * How far behind the living a Corpse sorts (CSS px of screen y): one row of
 * tiles, so anyone standing on or just behind a Corpse is drawn over it.
 */
const CORPSE_DEPTH = toScreen({ x: 1, y: 0 }).y;
/** How wide one tile's diamond is on screen (CSS px). */
const TILE_WIDTH = toScreen({ x: 1, y: -1 }).x;

/** The outline around a hovered Monster, and how thick it is (CSS px). */
const OUTLINE = { colour: 0xd8c890, width: 1 };
/** The HUD's font, for the nameplate and damage numbers. */
const SERIF = "Georgia, serif";
/** How high a character's head is over its feet at native scale (CSS px). */
const HEAD_HEIGHT = 120;
/** The Life bar over a damaged Monster's head (CSS px). */
const MONSTER_BAR = { width: 30, height: 5, above: 8 };
/**
 * The top-centre nameplate's look: a dark panel `alpha` opaque (0..1); where
 * things go is `nameplateLayout`.
 */
const NAMEPLATE_STYLE = { alpha: 0.6, nameColour: 0xe8e0c8 };
/** A Life bar's fill, and its dark back with how opaque that is (0..1). */
const LIFE_COLOUR = 0xc02020;
/** A hovered Minion's nameplate: a green name and Life bar, on the Hero's side. */
const FRIENDLY = { name: 0x9ee08a, life: 0x3fa83a };
const LIFE_BACK = { colour: 0x2a0606, alpha: 0.85 };
/**
 * White for the Hero's hits, gold for a killing blow, red for damage taken
 * grey for a Miss and pale gold for No room.
 */
const NUMBER_COLOUR: Record<DamageNumber["kind"], number> = {
  hit: 0xffffff,
  kill: 0xffd04a,
  taken: 0xff4a4a,
  miss: 0x9a9a9a,
  noRoom: 0xe8e0c8,
  castFailed: 0x8ab4ff,
};

/**
 * How each Minion looks: the Skeleton's art, `scale` times as big and tinted
 * `tint`, the placeholder Golem clay.
 */
const MINION_LOOK: Record<MinionType, { tint: number; scale: number }> = {
  golem: { tint: 0xc0804a, scale: 1.3 },
};
/**
 * How long a Minion takes to crumble away, replaced or killed: its `die`
 * animation, fading out (ms).
 */
const CRUMBLE_MS = 900;

/**
 * The Skill Bar's look, in the HUD's colours; where things go is
 * `skillBarLayout`. A Skill the Hero lacks the Mana for shows `dimmed`
 * opaque (0..1).
 */
const SKILL_BAR_STYLE = {
  fill: 0x17130e,
  edge: 0x5a4a2e,
  skill: 0x6a4428,
  skillEdge: 0xe8d27a,
  name: 0xe8e0c8,
  nameSize: 11,
  key: 0xd8c890,
  keySize: 10,
  dimmed: 0.35,
};

/**
 * The Area Banner's look: pale gold with a black outline; where it goes is
 * `areaBannerLayout`.
 */
const BANNER_COLOUR = 0xe8d27a;

/** The stone strip along the bottom of the screen; where it goes is `orbsLayout`. */
const STRIP = { colour: 0x15120e, alpha: 0.92, edgeColour: 0x4a4236 };
/** The Hero's orbs' look; where they go is `orbsLayout`. */
const ORB = {
  rimColour: 0x2a241c,
  rimLine: 0x4a4236,
  glassLine: 0x6b6258,
};
/**
 * Each orb's colours: `empty` behind it, and its fill at the bottom, lighter
 * towards the surface by up to `lighten` in its own channel (`lightenStep`
 * is one unit of that channel).
 */
const ORB_COLOURS: Record<
  Orb,
  { empty: number; fill: number; lighten: number; lightenStep: number }
> = {
  life: {
    empty: 0x140404,
    fill: 0x8a0e0e,
    lighten: 0x30,
    lightenStep: 0x10000,
  },
  mana: { empty: 0x040414, fill: 0x0e1e8a, lighten: 0x30, lightenStep: 0x1 },
};
/**
 * How far the surface ripples either way and how deep (CSS px at native
 * scale) and how fast (rad/s).
 */
const RIPPLE = { calm: 1, combat: 2.5, speed: 5, depth: 3 };
/**
 * Bubbles rising through the Life orb while the Hero regenerates Life,
 * `radius` CSS px at native scale.
 */
const BUBBLES = {
  count: 6,
  radius: 2,
  colour: 0xff9a9a,
  alpha: 0.6,
  /** Rises per second, bottom to surface. */
  rate: 0.6,
};
/**
 * The Experience bar's look; where it goes is `experienceBarLayout`, and
 * its sizes `EXPERIENCE_BAR`.
 */
const EXPERIENCE_BAR_STYLE = {
  textColour: 0xd8c890,
  fill: 0xc8a040,
  back: 0x2a241c,
  edge: 0x4a4236,
};
/**
 * A button on the HUD, such as Level Up or a +: a dark box with a gold edge.
 * The Level Up button's edge pulses `pulsesPerSecond` times a second, down to
 * `edgeFaint` opaque (0..1).
 */
const HUD_BUTTON = {
  fill: 0x2a2014,
  edge: 0xe8d27a,
  text: 0xe8d27a,
  textSize: 14,
  pulsesPerSecond: 0.8,
  edgeFaint: 0.3,
};
/**
 * The Hero panel's look, in the pause menu's colours; where things go is
 * `HERO_PANEL`. Each rule sits `ruleGap` over the rows it heads, and
 * Attribute values keep `plusGap` from their − buttons (CSS px). Values the
 * Pending Attribute Points change show in `changed`, Diablo 2's blue for a
 * raised Attribute.
 */
const HERO_PANEL_STYLE = {
  fill: 0x17130e,
  alpha: 0.94,
  edge: 0x5a4a2e,
  title: 0xe8d27a,
  titleSize: 22,
  name: 0xb8ae98,
  value: 0xe8e0c8,
  changed: 0x8fa8ff,
  textSize: 15,
  plusSize: 18,
  plusGap: 10,
  hint: 0x9a9080,
  hintSize: 13,
  ruleGap: 4,
};
/**
 * The Inventory panel's look, in the Hero panel's colours; where things go
 * is `inventoryPanelLayout`. Each Item is a box tinted as its type with its
 * name inside, and the tooltip sits `tooltipGap` over the hovered Item,
 * `tooltipPadding` around its lines (CSS px). A held Item follows the
 * cursor, over a highlight of where it would land: `fits` where it can go
 * down, `refused` where it can't.
 */
const INVENTORY_STYLE = {
  fits: 0x3c8c3c,
  refused: 0xa03028,
  landingAlpha: 0.45,
  cell: 0x0e0b08,
  cellEdge: 0x2e2618,
  slotLabel: 0x6a6050,
  slotLabelSize: 12,
  itemEdge: 0x8a7a50,
  itemAlpha: 0.9,
  /** A held Item's, so the highlight under it shows through. */
  heldAlpha: 0.55,
  itemText: 0xe8e0c8,
  tooltip: 0x000000,
  tooltipAlpha: 0.85,
  tooltipName: 0xe8d27a,
  tooltipLine: 0xe8e0c8,
  tooltipSize: 14,
  tooltipLineHeight: 19,
  tooltipPadding: 8,
  tooltipGap: 6,
};
/**
 * The Panel buttons' look, in the Skill Bar's colours (CSS px): a `frame`
 * wide edge and an inner bevel `bevel` in, `litBevel` once pressed in, at
 * `bevelAlpha` of the edge's opacity. A lit button's icon sits `pressOffset`
 * lower, and all are `dimmed` opaque (0..1) during Death. `icon` is each
 * icon's shape about the button's centre, its lines `iconStroke` wide.
 */
const PANEL_BUTTON_STYLE = {
  frame: 1.5,
  bevel: 3,
  litBevel: 4,
  bevelAlpha: 0.6,
  pressOffset: 1,
  dimmed: SKILL_BAR_STYLE.dimmed,
  iconStroke: 2,
  icon: {
    /** A head over shoulders widening to the feet. */
    hero: {
      headY: -8,
      head: 5,
      shoulders: 6,
      shouldersY: -1,
      feet: 9,
      feetY: 12,
    },
    /** A rounded bag under its strap. */
    inventory: { w: 20, h: 17, y: -5, corner: 4, strapW: 10, strapH: 6 },
    /** A root node linked to two leaves. */
    skillTree: { rootY: -9, leafX: 8, leafY: 8, node: 4 },
  },
  /**
   * The Town Portal button's icon: an upright green oval `w` by `h` with a
   * lighter core `core` of its size, grey while the button is greyed out.
   */
  townPortal: {
    w: 14,
    h: 22,
    core: 0.5,
    colour: townPortalLook.colours.glow,
    coreColour: 0xb8ffc8,
    greyed: 0x8a8070,
  },
};
/**
 * A Ground Item: a small diamond on the floor tinted as its type, `size`
 * across (CSS px), under a dark label with its name, gold while hovered
 * (where the label goes and how big is `groundLabels`). A click within
 * `grab` of the diamond's box picks it up too.
 */
const GROUND_ITEM = {
  size: 14,
  grab: 4,
  edge: 0xd8c890,
  label: 0x000000,
  labelAlpha: 0.7,
  name: 0xe8e0c8,
  hoveredName: 0xe8d27a,
};

/** The name shown in each empty Equipment slot. */
const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  armour: "Armour",
  amulet: "Amulet",
  ring1: "Ring",
  ring2: "Ring",
  belt: "Belt",
};

/**
 * The badge over the Life orb: its size and gap over the rim (CSS px at
 * native scale) and colours.
 */
const BADGE = { size: 13, gap: 4, combat: 0xd84a3a, regen: 0x9cd89c };

/** The frame of the Hero's `swing` where the blade connects. */
const HERO_STRIKE_FRAME = 2;
/** The swing as the sim times it, so the strike frame starts on the hit step. */
const HERO_SWING = {
  swingMs: SWING_STEPS * STEP_MS,
  hitMs: HIT_STEP * STEP_MS,
};

/** A character on screen: its sprite and what its animation needs to know. */
type CharacterView = {
  sprite: Sprite;
  art: CharacterArt;
  /**
   * The walking speed (tiles/s) at which `run` plays at Flare's own rate; it
   * plays faster or slower with the speed actually walked.
   */
  runSpeed: number;
  /** How far into `run` the feet are, as ms at `runSpeed`. */
  runMs: number;
  /** Where it was drawn last frame, in tile units. */
  drawnAt: Vec | null;
};

type MonsterView = CharacterView & {
  type: MonsterType;
  /** Which way it faced when last seen alive, for its Corpse. */
  facing: number;
  diedAtMs: number | null;
  flashUntilMs: number;
  flash: ColorMatrixFilter | null;
};

/**
 * Draws the World's active Area and everything in it into a Pixi stage,
 * following the Hero. `areaDisplayNames` are what the Area Banner on arriving in
 * an Area shows, by Area name. Hints name the buttons of `activeInput`, read
 * as it is each frame, and the touch controls show while it is touch, held
 * as `touch` is each frame.
 */
export function createRenderer(
  app: Application,
  art: Art,
  areaDisplayNames: Readonly<Record<string, string>>,
  activeInput: Readonly<ActiveInput>,
  touch: Readonly<TouchControls>,
) {
  // The World, drawn at the World zoom.
  const camera = new Container();
  app.stage.addChild(camera);
  /** Where the camera was last drawn. */
  let shot: Camera = { x: 0, y: 0, zoom: 1 };
  // Over the World, following it but drawn at the UI Scale, not the World
  // zoom: damage numbers and Ground Item labels.
  const overWorld = new Container();
  app.stage.addChild(overWorld);

  // Filled by `showArea`.
  let area: Area | null = null;
  const floor = new Container();
  floor.sortableChildren = true;
  camera.addChild(floor);
  let props: Sprite[] = [];
  let npcs: CharacterView[] = [];
  const hover = new Graphics();
  camera.addChild(hover);
  const marker = drawMarker();
  marker.visible = false;
  camera.addChild(marker);
  const telegraphs = new Graphics();
  camera.addChild(telegraphs);
  // On the floor, under everyone standing.
  const groundItems = new Graphics();
  camera.addChild(groundItems);
  // Walls, props, the Hero, Monsters and Corpses, nearest the viewer last.
  const scene = new Container();
  scene.sortableChildren = true;
  camera.addChild(scene);
  const hero = characterView(art.hero, heroTuning.walkSpeed);
  scene.addChild(hero.sprite);
  /** A view for each Town Portal end drawn, made as more are needed. */
  const townPortals: Graphics[] = [];
  /** A sprite for each Projectile in flight, in the World's order. */
  const projectiles: Sprite[] = [];
  // Under the scene, so the ring spreads at the Hero's feet.
  const levelRing = new Graphics();
  camera.addChildAt(levelRing, camera.getChildIndex(scene));
  // On the floor, under everyone standing.
  const townPortalGlows = new Graphics();
  camera.addChildAt(townPortalGlows, camera.getChildIndex(scene));
  const levelFlash = new ColorMatrixFilter({ resolution: "inherit" });
  levelFlash.matrix = washTo(LEVEL_UP.colour);
  const outline = outlineView();
  scene.addChild(outline.layer);
  // Over the scene: Life bars over heads and damage numbers.
  const overheads = new Graphics();
  camera.addChild(overheads);
  // Ground Items' name labels, always shown.
  const labelBacks = new Graphics();
  overWorld.addChild(labelBacks);
  const labelTexts = new Map<ItemId, Text>();
  /** Where each Ground Item's label was last drawn on the screen. */
  let labels: GroundLabel[] = [];
  /** Where each Ground Item was last drawn on the floor, in camera space. */
  let lyingAt: { id: ItemId; at: Vec }[] = [];
  const numbers = new Container();
  overWorld.addChild(numbers);
  const floating: { text: Text; bornMs: number; at: Vec }[] = [];
  const nameplate = new Graphics();
  app.stage.addChild(nameplate);
  const nameplateText = new Text({
    text: "",
    style: {
      fill: NAMEPLATE_STYLE.nameColour,
      fontFamily: SERIF,
    },
  });
  nameplateText.anchor.set(0.5, 0);
  app.stage.addChild(nameplateText);
  const orb = orbsView();
  app.stage.addChild(orb.layer);
  const skillBar = skillBarView(activeInput);
  app.stage.addChild(skillBar.layer);
  const beltStrip = beltStripView(activeInput);
  app.stage.addChild(beltStrip.layer);
  const panelButtons = panelButtonsView(activeInput);
  app.stage.addChild(panelButtons.layer);
  const experience = experienceBarView();
  app.stage.addChild(experience.layer);
  const levelUp = levelUpButtonView();
  app.stage.addChild(levelUp.layer);
  const touchControls = touchControlsView(activeInput, touch);
  app.stage.addChild(touchControls.layer);
  const heroPanel = heroPanelView(activeInput);
  app.stage.addChild(heroPanel.layer);
  const inventoryPanel = inventoryPanelView(activeInput);
  app.stage.addChild(inventoryPanel.layer);
  const skillTreePanel = skillTreePanelView(activeInput);
  app.stage.addChild(skillTreePanel.layer);
  // The Focus's ring, over the panel it is in.
  const focusRing = new Graphics();
  app.stage.addChild(focusRing);
  // Over the panels, so a hovered Panel button's tooltip is never hidden.
  app.stage.addChild(panelButtons.tooltipLayer);
  app.stage.addChild(inventoryPanel.heldLayer);
  const heldSkillView = createHeldSkillView();
  app.stage.addChild(heldSkillView.layer);
  // Over the whole screen, stretched to it each frame.
  const banner = new Text({
    text: "",
    style: { fill: BANNER_COLOUR, fontFamily: SERIF },
  });
  banner.anchor.set(0.5);
  banner.visible = false;
  app.stage.addChild(banner);
  const hurt = new Graphics().rect(0, 0, 1, 1).fill(HURT_COLOUR);
  hurt.visible = false;
  app.stage.addChild(hurt);
  const death = deathScreenView(activeInput);
  app.stage.addChild(death.layer);
  // The fade to black of an Area change, over everything.
  const fade = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  fade.visible = false;
  app.stage.addChild(fade);
  // Going through a Town Portal's green flash instead.
  const greenFlash = new Graphics()
    .rect(0, 0, 1, 1)
    .fill(townPortalLook.colours.flash);
  greenFlash.visible = false;
  app.stage.addChild(greenFlash);
  const menu = pauseMenuView(activeInput);
  app.stage.addChild(menu.layer);
  // Instead of the game, over everything.
  const notice = rotateNoticeView(activeInput);
  app.stage.addChild(notice.layer);

  /** Living Monsters and Corpses by id. */
  const monsters = new Map<MonsterId, MonsterView>();
  /** The view of a living Monster or Corpse, made on first sight. */
  const viewOf = (id: MonsterId, type: MonsterType): MonsterView => {
    let view = monsters.get(id);
    if (!view) {
      view = monsterView(art, type);
      monsters.set(id, view);
      scene.addChild(view.sprite);
    }
    return view;
  };
  /**
   * Each living Minion's view, made on first sight, with its type and its
   * facing as drawn.
   */
  const minionViews = new Map<
    MinionId,
    { view: CharacterView; type: MinionType; compass: Compass }
  >();
  /** Gone Minions crumbling away, each from when it began. */
  const crumbling: { view: CharacterView; atMs: number; compass: Compass }[] =
    [];
  /** A Minion's view: the Skeleton's art, in its type's look. */
  const minionView = (type: MinionType): CharacterView => {
    const view = characterView(art.monsters.skeleton, minionTuning[type].speed);
    view.sprite.tint = MINION_LOOK[type].tint;
    view.sprite.scale.set(MINION_LOOK[type].scale);
    scene.addChild(view.sprite);
    return view;
  };
  /** Drops the view of Minion `id`, if drawn. */
  const dropMinionView = (id: MinionId) => {
    minionViews.get(id)?.view.sprite.destroy();
    minionViews.delete(id);
  };
  let hoveredTile: Vec | null = null;
  let markedAtMs: number | null = null;
  let hurtAtMs: number | null = null;
  let levelAtMs: number | null = null;
  /** When the Hero's Town Portal last opened, for its burst. */
  let townPortalOpenedAtMs: number | null = null;
  /** Town Portal ends shrinking away, each in its Area from when it closed. */
  const closingTownPortals: { area: string; pos: Vec; atMs: number }[] = [];
  /** When the Hero last arrived in an Area, for the Area Banner. */
  let arrivedAtMs: number | null = null;
  /** Starts the Area Banner showing `displayName`, as of `nowMs`. */
  const showBanner = (displayName: string, nowMs: number) => {
    banner.text = displayName;
    arrivedAtMs = nowMs;
  };
  /** The World last drawn; a New Hero brings another. */
  let drawnWorld: World | null = null;
  /** Which panels were open, and the Pending Attribute Points, when last drawn. */
  let shownPanels: ShownPanels = {
    heroPanelOpen: false,
    inventoryOpen: false,
    skillTreeOpen: false,
    pendingPoints: noPendingPoints(),
  };

  /**
   * What a point on the canvas (CSS px) hits of the panels and the HUD, as
   * last drawn, or null when it's for the World. While touch is the Active
   * Input, the point is a touch.
   */
  const panelAt = (screen: Vec): CursorHit | null =>
    drawnWorld &&
    cursorHitAt(
      viewportOf(app.screen),
      screen,
      drawnWorld,
      shownPanels,
      activeInput.way === "touch",
    );

  /**
   * Starts afresh for another World, whose Monster ids start over: drops
   * every Monster view and the Hero's hurt and level-up effects, and shows
   * its Area.
   */
  const showWorld = (next: World) => {
    drawnWorld = next;
    for (const view of monsters.values()) {
      view.sprite.destroy();
      view.flash?.destroy();
    }
    monsters.clear();
    // Minion ids start over too.
    for (const id of [...minionViews.keys()]) dropMinionView(id);
    // Item ids start over too.
    for (const text of labelTexts.values()) text.destroy();
    labelTexts.clear();
    hurtAtMs = levelAtMs = null;
    townPortalOpenedAtMs = null;
    closingTownPortals.length = 0;
    showArea(next.areas[next.areaName]);
  };

  /**
   * Swaps in another Area's tiles and NPCs. Its Monsters and Corpses get
   * their own views as they're drawn, and the old ones go as they're no
   * longer seen.
   */
  const showArea = (next: Area) => {
    area = next;
    for (const tile of floor.removeChildren()) tile.destroy();
    for (const prop of props) prop.destroy();
    props = drawTiles(next, next.propTiles, art);
    scene.addChild(...props);
    const floorTiles = drawTiles(next, next.floorTiles, art);
    // Floor art wider than a tile, such as Flare's 2×2 waypoint, spreads over
    // its neighbours, so it goes over their floor whatever the order.
    for (const tile of floorTiles) {
      tile.zIndex = tile.width > TILE_WIDTH ? 1 : 0;
    }
    floor.addChild(...floorTiles);
    for (const npc of npcs) npc.sprite.destroy();
    npcs = next.npcs.map(() => npcView(art));
    if (npcs.length > 0) scene.addChild(...npcs.map((npc) => npc.sprite));
    for (const { text } of floating.splice(0)) text.destroy();
    for (const { view } of crumbling.splice(0)) view.sprite.destroy();
    markedAtMs = null;
    hoveredTile = null;
    hover.clear();
  };

  /** Maps a point on the canvas (CSS px) to tile units, as last drawn. */
  const screenToTile = (screen: Vec): Vec => toTile(onWorld(shot, screen));

  /**
   * The living Monster or Minion drawn under a point on the canvas (CSS
   * px), as last drawn: the one in front where they overlap.
   */
  const characterAt = (screen: Vec): CharacterId | null => {
    const characters: Pickable<CharacterId>[] = [];
    for (const [id, view] of monsters) {
      if (view.diedAtMs !== null) continue;
      const { position } = view.sprite;
      characters.push({ id, at: position, scale: MONSTER_SCALE[view.type] });
    }
    for (const [id, { view, type }] of minionViews) {
      const { position } = view.sprite;
      const { scale } = MINION_LOOK[type];
      characters.push({ id: { minion: id }, at: position, scale });
    }
    return characterUnder(characters, onWorld(shot, screen));
  };

  /**
   * The Monster drawn under a point on the canvas (CSS px), as last drawn;
   * none where a Minion stands in front, so a click there is a move.
   */
  const monsterAt = (screen: Vec): MonsterId | null => {
    const id = characterAt(screen);
    return typeof id === "number" ? id : null;
  };

  /** The Ground Item whose label is under a canvas point (CSS px). */
  const groundLabelUnder = (screen: Vec): ItemId | null =>
    groundLabelAt(labels, screen);

  /** The Ground Item drawn on the floor under a canvas point (CSS px). */
  const groundItemAt = (screen: Vec): ItemId | null =>
    groundItemUnder(
      lyingAt,
      onWorld(shot, screen),
      GROUND_ITEM.size / 2 + GROUND_ITEM.grab,
    );

  /**
   * Draws each Ground Item on the floor with its name label over it, gold
   * for `hovered`, and drops the labels of Items no longer lying there.
   */
  const drawGroundItems = (
    world: World,
    hovered: ItemId | null,
    uiScale: number,
  ) => {
    const lying = groundItemsOf(world);
    groundItems.clear();
    labelBacks.clear();
    const half = GROUND_ITEM.size / 2;
    const sized = lying.map(({ item, pos }) => {
      const at = toScreen(pos);
      groundItems
        .poly([
          at.x,
          at.y - half,
          at.x + half,
          at.y,
          at.x,
          at.y + half,
          at.x - half,
          at.y,
        ])
        .fill(itemColour(item.type))
        .stroke({ color: GROUND_ITEM.edge, width: 1 });
      let text = labelTexts.get(item.id);
      if (!text) {
        text = new Text({
          text: itemOf(item.type).name,
          style: { fontFamily: SERIF },
        });
        text.anchor.set(0.5, 0.5);
        labelTexts.set(item.id, text);
        overWorld.addChild(text);
      }
      sizeText(text, GROUND_LABEL.textSize * uiScale);
      const width = text.width + 2 * GROUND_LABEL.padding * uiScale;
      return { id: item.id, at, width };
    });
    // Labels are laid out on the screen, at the UI Scale.
    labels = groundLabels(
      sized.map(({ id, at, width }) => ({ id, at: onScreen(shot, at), width })),
      uiScale,
    );
    lyingAt = sized.map(({ id, at }) => ({ id, at }));
    for (const { id, rect } of labels) {
      labelBacks
        .rect(rect.x, rect.y, rect.w, rect.h)
        .fill({ color: GROUND_ITEM.label, alpha: GROUND_ITEM.labelAlpha });
      const text = labelTexts.get(id);
      if (!text) continue;
      text.style.fill =
        id === hovered ? GROUND_ITEM.hoveredName : GROUND_ITEM.name;
      text.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    for (const [id, text] of labelTexts) {
      if (lying.some(({ item }) => item.id === id)) continue;
      text.destroy();
      labelTexts.delete(id);
    }
  };

  return {
    screenToTile,
    monsterAt,
    groundLabelAt: groundLabelUnder,
    groundItemAt,

    panelAt,

    /**
     * The pause-menu button under a click on the canvas (CSS px), or null
     * off them all; `confirming` while asking to confirm a New Hero, and
     * the Fullscreen button only where `fullscreen` says it's allowed.
     */
    menuChoiceAt(
      screen: Vec,
      confirming: boolean,
      fullscreen: Fullscreen,
    ): MenuChoice | null {
      return menuChoiceAt(
        viewportOf(app.screen),
        screen,
        confirming,
        activeInput.way,
        fullscreen,
      );
    },

    /**
     * The Rotate Notice's Fullscreen button under a tap on the canvas (CSS
     * px), or null: shown only for touch on a screen too small, where
     * `fullscreen` says it's allowed.
     */
    rotateNoticeChoiceAt(
      screen: Vec,
      fullscreen: Fullscreen,
    ): FullscreenChoice | null {
      return rotateNoticeChoiceAt(
        viewportOf(app.screen),
        screen,
        activeInput.way,
        fullscreen,
      );
    },

    /** Turns a step's events into effects. */
    react(events: readonly SimEvent[], nowMs: number) {
      const arrivedIn = arrivedInDisplayName(events, areaDisplayNames);
      if (arrivedIn !== null) showBanner(arrivedIn, nowMs);
      for (const number of damageNumbers(events)) {
        const sprite =
          number.on === "hero"
            ? hero.sprite
            : typeof number.on === "number"
              ? monsters.get(number.on)?.sprite
              : minionViews.get(number.on.minion)?.view.sprite;
        if (!sprite) continue;
        const text = new Text({
          text: floatText(number),
          style: { fill: NUMBER_COLOUR[number.kind], fontFamily: SERIF },
        });
        text.anchor.set(0.5, 1);
        numbers.addChild(text);
        // Over where a Monster's Life bar goes; `gap` more at the UI Scale
        // as it's drawn.
        const at = { x: sprite.position.x, y: barTop(sprite) };
        floating.push({ text, bornMs: nowMs, at });
      }
      for (const event of events) {
        if (event.type === "HitLanded") {
          const view = monsters.get(event.target);
          if (view) view.flashUntilMs = nowMs + FLASH_MS;
        }
        if (event.type === "MonsterDied") {
          const view = monsters.get(event.id);
          if (view) view.diedAtMs = nowMs;
        }
        // Killed, it crumbles away as when replaced.
        const gone =
          event.type === "MinionCrumbled" || event.type === "MinionDied";
        const drawn = gone && minionViews.get(event.minion);
        if (drawn) {
          crumbling.push({ ...drawn, atMs: nowMs });
          minionViews.delete(event.minion);
        }
        if (event.type === "HeroHit") hurtAtMs = nowMs;
        if (event.type === "LevelReached") levelAtMs = nowMs;
        if (event.type === "TownPortalOpened") townPortalOpenedAtMs = nowMs;
        if (event.type === "TownPortalClosed") {
          closingTownPortals.push({
            area: event.area,
            pos: event.pos,
            atMs: nowMs,
          });
        }
      }
    },

    /** Shows the click marker at a target in tile units. */
    markClick(target: Vec, nowMs: number) {
      const at = toScreen(target);
      marker.position.set(at.x, at.y);
      markedAtMs = nowMs;
    },

    /**
     * `alpha` (0..1) is how far the frame is from the previous step to the
     * current one; `pointer` is the cursor on the canvas (CSS px), if on it,
     * which outlines what it's over in the World, or off a panel, shows the
     * tooltip of the Item it's over on one. `menus` shows the Hero and
     * Inventory panels while they're open, and the pause menu over
     * everything while paused. `heldSkill` is the Held Skill, if any, drawn
     * at the pointer, and `heldSkillSlot` the Skill Bar slot it was picked
     * up from, drawn dimmed. `target` is the Target auto-aim picked, if any,
     * outlined and named as a hovered Monster is when the pointer is over no
     * one. `focus` is where the Focus rests in an open panel, if it shows,
     * ringed as the pause menu's focused button is.
     */
    draw(
      world: World,
      alpha: number,
      pointer: Vec | null,
      nowMs: number,
      menus: Menus,
      heldSkill: Skill | null = null,
      heldSkillSlot: SkillBarSlot | null = null,
      target: MonsterId | null = null,
      focus: Rect | null = null,
    ) {
      const active = world.areas[world.areaName];
      // Read afresh each frame, so a resized window re-lays the HUD at once.
      const viewport = viewportOf(app.screen);
      const { uiScale } = viewport;
      shownPanels = {
        heroPanelOpen: menus.heroPanelOpen,
        inventoryOpen: menus.inventoryOpen,
        skillTreeOpen: menus.skillTreeOpen,
        pendingPoints: { ...menus.pendingPoints },
      };
      if (world !== drawnWorld) {
        showWorld(world);
        // A new World starts the Hero in an Area: they've arrived there.
        showBanner(areaDisplayNames[world.areaName], nowMs);
      } else if (active !== area) showArea(active);
      const heroAt = lerp(world.hero.prevPos, world.hero.pos, alpha);
      const at = toScreen(heroAt);

      // Snap the camera and sprites to device pixels so the art stays
      // crisp, with the Hero at the centre of the screen.
      const { resolution } = app.renderer;
      shot = cameraOn(viewport, at, resolution);
      camera.position.set(shot.x, shot.y);
      camera.scale.set(shot.zoom);
      // A device pixel, in the World's own pixels.
      const pixel = shot.zoom * resolution;
      const snap = (value: number) => Math.round(value * pixel) / pixel;
      const snapOnScreen = (value: number) =>
        Math.round(value * resolution) / resolution;
      const place = (view: CharacterView, at: Vec, depth = 0) => {
        const screen = toScreen(at);
        view.sprite.position.set(snap(screen.x), snap(screen.y));
        view.sprite.zIndex = screen.y - depth;
      };

      place(hero, heroAt);
      active.npcs.forEach((npc, i) => {
        const view = npcs[i];
        place(view, npc.pos);
        const ms = nowMs + i * NPC_STAGGER_MS;
        show(view, "stance", NPC.compass, frameAt(art.hero.timing.stance, ms));
      });
      const { swing } = world.hero;
      const heroCompass = compassOf(world.hero.facing);
      if (world.death) {
        // Down from dying until back in Town.
        const ms = world.death.elapsed * STEP_MS;
        show(hero, "die", heroCompass, frameAt(art.hero.timing.die, ms));
      } else if (swing) {
        const frame = swingFrame(
          {
            ...HERO_SWING,
            frames: art.hero.timing.swing.frames,
            strikeFrame: HERO_STRIKE_FRAME,
          },
          swing.elapsed * STEP_MS,
        );
        show(hero, "swing", heroCompass, frame);
      } else if (world.hero.cast || world.hero.opening) {
        // A placeholder: the swing, slowed to the cast or opening time.
        const { cast, opening } = world.hero;
        const progress = cast
          ? cast.elapsed / CAST_STEPS[cast.skill]
          : (opening?.elapsed ?? 0) / OPENING_STEPS;
        const { frames } = art.hero.timing.swing;
        show(
          hero,
          "swing",
          heroCompass,
          Math.min(frames - 1, Math.floor(progress * frames)),
        );
      } else if (world.hero.flinch > 0) {
        const ms = (HERO_FLINCH_STEPS - world.hero.flinch) * STEP_MS;
        show(hero, "hit", heroCompass, frameAt(art.hero.timing.hit, ms));
      } else {
        walkOrStand(hero, world.hero, heroAt, heroCompass, nowMs);
      }

      const levelUpLeft =
        levelAtMs === null ? 0 : 1 - (nowMs - levelAtMs) / LEVEL_UP.ms;
      levelRing.clear();
      if (levelUpLeft > 0) {
        levelFlash.alpha = LEVEL_UP.strength * levelUpLeft;
        hero.sprite.filters = [levelFlash];
        const radius = LEVEL_UP.ringRadius * (1 - levelUpLeft);
        levelRing
          .poly(
            [
              { x: radius, y: 0 },
              { x: 0, y: radius },
              { x: -radius, y: 0 },
              { x: 0, y: -radius },
            ].flatMap((v) => {
              const screen = toScreen(v);
              return [at.x + screen.x, at.y + screen.y];
            }),
          )
          .stroke({
            color: LEVEL_UP.colour,
            width: LEVEL_UP.ringWidth,
            alpha: levelUpLeft,
          });
      } else if (hero.sprite.filters) {
        hero.sprite.filters = null;
      }

      // The open end bursting open or standing, then any shrinking away.
      const shownTownPortals: { pos: Vec; scale: number; msOpen: number }[] =
        [];
      const townPortalEnd = townPortalIn(world);
      if (townPortalEnd) {
        const msOpen =
          townPortalOpenedAtMs === null
            ? Number.POSITIVE_INFINITY
            : nowMs - townPortalOpenedAtMs;
        shownTownPortals.push({
          pos: townPortalEnd,
          scale: townPortalOpenScale(msOpen),
          msOpen,
        });
      }
      for (let i = closingTownPortals.length - 1; i >= 0; i--) {
        const closing = closingTownPortals[i];
        const scale = townPortalCloseScale(nowMs - closing.atMs);
        if (scale === 0) closingTownPortals.splice(i, 1);
        else if (closing.area === world.areaName) {
          shownTownPortals.push({
            pos: closing.pos,
            scale,
            msOpen: Number.POSITIVE_INFINITY,
          });
        }
      }
      while (townPortals.length < shownTownPortals.length) {
        const view = new Graphics();
        scene.addChild(view);
        townPortals.push(view);
      }
      townPortalGlows.clear();
      townPortals.forEach((view, i) => {
        view.clear();
        const shown = shownTownPortals[i];
        if (!shown) return;
        const foot = toScreen(shown.pos);
        drawTownPortal(view, foot, shown.scale, shown.msOpen, nowMs);
        view.zIndex = foot.y;
        for (const ring of townPortalGlow(shown.scale)) {
          townPortalGlows
            .ellipse(foot.x, foot.y, ring.radiusX, ring.radiusY)
            .fill({ color: townPortalLook.colours.glow, alpha: ring.alpha });
        }
      });

      const seen = new Set<MonsterId>();
      telegraphs.clear();
      for (const monster of world.monsters) {
        seen.add(monster.id);
        const view = viewOf(monster.id, monster.type);
        const monsterAt = lerp(monster.prevPos, monster.pos, alpha);
        place(view, monsterAt);
        view.facing = monster.facing;
        const compass = compassOf(view.facing);
        if (monster.state === "windup") {
          // A flinch doesn't stop a wind-up, so it shows over one.
          const progress = windUpProgress(monster);
          // An archer draws its bow with its own animation.
          const { shoot, swing } = view.art.timing;
          const animation = shoot ? "shoot" : "swing";
          const { frames } = shoot ?? swing;
          const frame = Math.min(frames - 1, Math.floor(progress * frames));
          show(view, animation, compass, frame);
          // A ranged attack has no reach to show: the drawn bow is the tell.
          const { attack } = monsterTuning[monster.type];
          if (attack.kind === "melee") {
            telegraph(telegraphs, attack, monsterAt, view.facing, progress);
          }
        } else if (monster.flinch > 0) {
          const ms = (FLINCH_STEPS[monster.type] - monster.flinch) * STEP_MS;
          show(view, "hit", compass, frameAt(view.art.timing.hit, ms));
        } else {
          walkOrStand(view, monster, monsterAt, compass, nowMs);
        }
        flash(view, nowMs);
      }

      while (projectiles.length < world.projectiles.length) {
        const sprite = new Sprite();
        projectiles.push(sprite);
        scene.addChild(sprite);
      }
      for (const sprite of projectiles.splice(world.projectiles.length)) {
        sprite.destroy();
      }
      world.projectiles.forEach((projectile, i) => {
        const sprite = projectiles[i];
        const { frames, timing, height } = art.projectiles[projectile.kind];
        const texture = frames[frameAt(timing, nowMs)];
        sprite.texture = texture;
        sprite.anchor.copyFrom(texture.defaultAnchor ?? { x: 0.5, y: 0.5 });
        const ground = toScreen(
          lerp(projectile.prevPos, projectile.pos, alpha),
        );
        sprite.position.set(snap(ground.x), snap(ground.y - height));
        sprite.zIndex = ground.y;
        // Rotated to its direction of flight on screen, and foreshortened
        // along it as the floor is.
        const flight = toScreen(projectile.direction);
        sprite.rotation = Math.atan2(flight.y, flight.x);
        sprite.scale.set(
          Math.hypot(flight.x, flight.y) / PROJECTILE_EAST_LENGTH,
          1,
        );
      });

      for (const corpse of world.corpses) {
        seen.add(corpse.id);
        const view = viewOf(corpse.id, corpse.type);
        // Already dead when first drawn: lying still.
        view.diedAtMs ??= -Infinity;
        place(view, corpse.pos, CORPSE_DEPTH);
        const ms = nowMs - view.diedAtMs;
        const frame = frameAt(view.art.timing.die, ms);
        show(view, "die", compassOf(view.facing), frame);
        flash(view, nowMs);
      }

      const living = new Set(world.minions.map((minion) => minion.id));
      for (const id of [...minionViews.keys()]) {
        if (!living.has(id)) dropMinionView(id);
      }
      for (const minion of world.minions) {
        let drawn = minionViews.get(minion.id);
        if (!drawn) {
          const { type } = minion;
          drawn = { view: minionView(type), type, compass: "s" };
          minionViews.set(minion.id, drawn);
        }
        const minionAt = lerp(minion.prevPos, minion.pos, alpha);
        place(drawn.view, minionAt);
        drawn.compass = compassOf(minion.facing);
        if (minion.state === "windup") {
          const { frames } = drawn.view.art.timing.swing;
          const progress = minionWindUpProgress(minion);
          const frame = Math.min(frames - 1, Math.floor(progress * frames));
          show(drawn.view, "swing", drawn.compass, frame);
        } else {
          walkOrStand(drawn.view, minion, minionAt, drawn.compass, nowMs);
        }
      }
      for (let i = crumbling.length - 1; i >= 0; i--) {
        const { view, atMs } = crumbling[i];
        const ms = nowMs - atMs;
        if (ms >= CRUMBLE_MS) {
          view.sprite.destroy();
          crumbling.splice(i, 1);
          continue;
        }
        const { compass } = crumbling[i];
        show(view, "die", compass, frameAt(view.art.timing.die, ms));
        view.sprite.alpha = 1 - ms / CRUMBLE_MS;
      }

      for (const [id, view] of monsters) {
        if (seen.has(id)) continue;
        view.sprite.destroy();
        view.flash?.destroy();
        monsters.delete(id);
      }

      overheads.clear();
      for (const monster of world.monsters) {
        const life = monsterMaxLife(monster);
        if (monster.life >= life) continue;
        const { sprite } = viewOf(monster.id, monster.type);
        lifeBar(overheads, {
          x: sprite.position.x - MONSTER_BAR.width / 2,
          y: barTop(sprite),
          width: MONSTER_BAR.width,
          height: MONSTER_BAR.height,
          fraction: monster.life / life,
        });
      }

      for (let i = floating.length - 1; i >= 0; i--) {
        const { text, bornMs, at } = floating[i];
        const float = floatAt(nowMs - bornMs, uiScale);
        if (!float) {
          text.destroy();
          floating.splice(i, 1);
          continue;
        }
        const sizes = atUiScale(DAMAGE_NUMBER, uiScale);
        sizeText(text, sizes.size, sizes.stroke);
        const over = onScreen(shot, at);
        text.position.set(
          snapOnScreen(over.x),
          snapOnScreen(over.y - sizes.gap - float.rise),
        );
        text.alpha = float.alpha;
      }

      // No hover outline or nameplate under a panel.
      const onPanel = pointer && panelAt(pointer);
      const onWorld = onPanel ? null : pointer;
      // After moving the camera, so the highlight matches this frame.
      const cursor = onWorld && screenToTile(onWorld);
      // What a click there picks: a label over a Monster, a Monster over an
      // Item lying under it.
      const hoveredLabel = onWorld && groundLabelUnder(onWorld);
      const hoveredId = onWorld && !hoveredLabel && characterAt(onWorld);
      const hoveredItem =
        hoveredLabel ||
        (onWorld && typeof hoveredId !== "number"
          ? groundItemAt(onWorld)
          : null);
      drawGroundItems(world, hoveredItem, uiScale);
      const hoveredMonster =
        world.monsters.find((monster) => monster.id === hoveredId) ?? null;
      // With the pointer over no one, the Target is shown as if hovered.
      const pointed =
        typeof hoveredId === "number" || typeof hoveredId === "object"
          ? hoveredId
          : null;
      const hovered = hoveredOf(world, pointed, target);
      const hoveredView =
        hovered && "monster" in hovered
          ? monsters.get(hovered.monster.id)
          : hovered && minionViews.get(hovered.minion.id)?.view;
      outline.show(hoveredView?.sprite ?? null);
      nameplate.clear();
      nameplateText.visible = hovered !== null;
      if (hovered) {
        const { name, fraction, friendly } = nameplateOf(hovered);
        const layout = nameplateLayout(viewport);
        const { panel, bar } = layout;
        nameplate
          .rect(panel.x, panel.y, panel.w, panel.h)
          .fill({ color: 0x000000, alpha: NAMEPLATE_STYLE.alpha });
        lifeBar(nameplate, {
          x: bar.x,
          y: bar.y,
          width: bar.w,
          height: bar.h,
          fraction,
          colour: friendly ? FRIENDLY.life : LIFE_COLOUR,
        });
        nameplateText.text = name;
        nameplateText.style.fill = friendly
          ? FRIENDLY.name
          : NAMEPLATE_STYLE.nameColour;
        sizeText(nameplateText, layout.nameSize);
        nameplateText.position.set(layout.nameAt.x, layout.nameAt.y);
      }

      // A click on a Minion is a move, so its tile is shown too.
      const tile =
        cursor && !hoveredMonster && isFloor(active, cursor)
          ? tileOf(cursor)
          : null;
      if (tile?.x !== hoveredTile?.x || tile?.y !== hoveredTile?.y) {
        hoveredTile = tile;
        hover.clear();
        if (tile) {
          hover.poly(diamond(tile.x, tile.y)).stroke({
            color: HOVER_LINE,
            width: 1.5,
            alpha: 0.7,
          });
        }
      }

      orb.draw(viewport, world, nowMs);
      skillBar.draw(viewport, world, heldSkillSlot);
      beltStrip.draw(viewport, world);
      panelButtons.draw(
        viewport,
        menus,
        { heroDead: world.death !== null, inTown: inTown(world) },
        hoveredPanelButton(onPanel),
      );
      experience.draw(viewport, world);
      levelUp.draw(viewport, world, nowMs);
      touchControls.draw(viewport, world, menus);
      heroPanel.draw(viewport, world, menus.heroPanelOpen, menus.pendingPoints);
      // The focused or long-pressed Skill shows its tooltip; the mouse's
      // pointer, as before, none, and nor does a Held Skill.
      const touching = activeInput.way === "touch";
      const skillTooltipAt = (focus || touching) && !heldSkill ? pointer : null;
      skillTreePanel.draw(viewport, world, menus.skillTreeOpen, skillTooltipAt);
      heldSkillView.draw(heldSkill, pointer, uiScale);
      const spot = onPanel && "inventory" in onPanel ? onPanel.inventory : null;
      inventoryPanel.draw(viewport, world, menus.inventoryOpen, spot, pointer);
      focusRing.clear();
      if (focus) {
        const { colour, width } = FOCUS_RING;
        focusRing
          .rect(focus.x, focus.y, focus.w, focus.h)
          .stroke({ color: colour, width: width * uiScale });
      }

      const hurtLeft = hurtAtMs === null ? 0 : 1 - (nowMs - hurtAtMs) / HURT_MS;
      hurt.visible = hurtLeft > 0;
      if (hurt.visible) {
        hurt.alpha = HURT_STRENGTH * hurtLeft;
        hurt.scale.set(app.screen.width, app.screen.height);
      }

      const bannerAlpha =
        arrivedAtMs === null ? null : bannerOpacityAt(nowMs - arrivedAtMs);
      banner.visible = bannerAlpha !== null;
      if (bannerAlpha !== null) {
        const layout = areaBannerLayout(viewport);
        banner.alpha = bannerAlpha;
        sizeText(banner, layout.size, layout.stroke);
        banner.position.set(layout.at.x, layout.at.y);
      } else arrivedAtMs = null;

      death.draw(app.screen, world, nowMs);

      const darkness = areaFade(world);
      fade.visible = darkness > 0;
      if (fade.visible) {
        fade.alpha = darkness;
        fade.scale.set(app.screen.width, app.screen.height);
      }
      const flashed = townPortalFlash(world);
      greenFlash.visible = flashed > 0;
      if (greenFlash.visible) {
        greenFlash.alpha = flashed;
        greenFlash.scale.set(app.screen.width, app.screen.height);
      }

      menu.draw(
        viewport,
        menus.pause,
        world.hero.progress.level,
        // Only a controller picks with the menu's focus.
        activeInput.way === "controller" ? menus.menuFocus : null,
        menus.fullscreen,
      );
      notice.draw(viewport, menus.fullscreen);

      const markerProgress =
        markedAtMs === null
          ? 1
          : (nowMs - markedAtMs) / inputTuning.clickMarkerMs;
      marker.visible = markerProgress < 1;
      if (marker.visible) {
        marker.alpha = 1 - markerProgress;
        marker.scale.set(1 - 0.6 * markerProgress);
      }
    },
  };
}

function characterView(art: CharacterArt, runSpeed: number): CharacterView {
  return {
    sprite: new Sprite(frameOf(art, "stance", "s", 0)),
    art,
    runSpeed,
    runMs: 0,
    drawnAt: null,
  };
}

function monsterView(art: Art, type: MonsterType): MonsterView {
  const view = characterView(art.monsters[type], monsterTuning[type].speed);
  view.sprite.scale.set(MONSTER_SCALE[type]);
  return {
    ...view,
    type,
    // Down the screen, as the Hero starts.
    facing: Math.PI / 4,
    diedAtMs: null,
    flashUntilMs: 0,
    flash: null,
  };
}

/** A placeholder NPC: the Hero's art, tinted. It never walks. */
function npcView(art: Art): CharacterView {
  const view = characterView(art.hero, 0);
  view.sprite.tint = NPC.tint;
  return view;
}

function show(
  view: CharacterView,
  animation: Animation,
  compass: Compass,
  frame: number,
) {
  const texture = frameOf(view.art, animation, compass, frame);
  view.sprite.texture = texture;
  // Every Flare frame has its own anchor, and setting a texture keeps the
  // old one.
  view.sprite.anchor.copyFrom(texture.defaultAnchor ?? { x: 0, y: 0 });
}

/**
 * Plays `run` while the sim moved the character in its last step, its feet
 * following the ground actually covered so they never slide, and `stance`
 * otherwise.
 */
function walkOrStand(
  view: CharacterView,
  { pos, prevPos }: { pos: Vec; prevPos: Vec },
  at: Vec,
  compass: Compass,
  nowMs: number,
) {
  const walking = pos.x !== prevPos.x || pos.y !== prevPos.y;
  if (walking && view.drawnAt) {
    const covered = Math.hypot(at.x - view.drawnAt.x, at.y - view.drawnAt.y);
    view.runMs += (covered / view.runSpeed) * 1000;
  }
  view.drawnAt = at;
  if (walking) {
    show(view, "run", compass, frameAt(view.art.timing.run, view.runMs));
  } else {
    show(view, "stance", compass, frameAt(view.art.timing.stance, nowMs));
  }
}

/**
 * Draws a Town Portal end standing on `foot` into `view`: its oval in square
 * pixels at `scale` of its full size, and its sparks, with the splash while
 * it bursts open, `msOpen` after it opened.
 */
function drawTownPortal(
  view: Graphics,
  foot: Vec,
  scale: number,
  msOpen: number,
  nowMs: number,
) {
  const { pixel, sparkSize, colours } = townPortalLook;
  // One fill per colour, not per pixel.
  const byColour = new Map<number, Vec[]>();
  for (const { x, y, colour } of townPortalPixels(scale, nowMs)) {
    const pixels = byColour.get(colour) ?? [];
    pixels.push({ x, y });
    byColour.set(colour, pixels);
  }
  for (const [colour, pixels] of byColour) {
    for (const { x, y } of pixels) {
      view.rect(foot.x + x, foot.y + y, pixel, pixel);
    }
    view.fill(colour);
  }
  for (const spark of townPortalSparks(scale, nowMs, msOpen)) {
    view
      .rect(foot.x + spark.x, foot.y + spark.y, sparkSize, sparkSize)
      .fill({ color: colours.spark, alpha: spark.alpha });
  }
}

/** Washes a hit Monster towards white, fading out over `FLASH_MS`. */
function flash(view: MonsterView, nowMs: number) {
  const left = (view.flashUntilMs - nowMs) / FLASH_MS;
  if (left <= 0) {
    if (view.sprite.filters) view.sprite.filters = null;
    return;
  }
  if (!view.flash) {
    view.flash = new ColorMatrixFilter({ resolution: "inherit" });
    view.flash.matrix = washTo(0xffffff);
  }
  view.flash.alpha = FLASH_STRENGTH * left;
  if (!view.sprite.filters) view.sprite.filters = [view.flash];
}

/**
 * A colour matrix turning every colour to `colour`, keeping alpha; a filter's
 * `alpha` mixes it in.
 */
function washTo(colour: number): ColorMatrixFilter["matrix"] {
  const r = ((colour >> 16) & 0xff) / 0xff;
  const g = ((colour >> 8) & 0xff) / 0xff;
  const b = (colour & 0xff) / 0xff;
  return [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0];
}

/**
 * Draws a winding-up Monster's telegraph: its reach and arc faintly, and the
 * part of it that `progress` (0..1) has filled.
 */
function telegraph(
  graphics: Graphics,
  { reach, arcDegrees }: MeleeTuning,
  at: Vec,
  facing: number,
  progress: number,
) {
  const arc = (arcDegrees * Math.PI) / 180;
  const wedge = (radius: number) => {
    const points = [toScreen(at)];
    for (let i = 0; i <= TELEGRAPH_SEGMENTS; i++) {
      const angle = facing - arc + (2 * arc * i) / TELEGRAPH_SEGMENTS;
      points.push(
        toScreen({
          x: at.x + radius * Math.cos(angle),
          y: at.y + radius * Math.sin(angle),
        }),
      );
    }
    return points.flatMap(({ x, y }) => [x, y]);
  };
  graphics
    .poly(wedge(reach))
    .fill({ color: TELEGRAPH_COLOUR, alpha: TELEGRAPH_ALPHA.reach });
  graphics
    .poly(wedge(reach * progress))
    .fill({ color: TELEGRAPH_COLOUR, alpha: TELEGRAPH_ALPHA.filled });
}

/** Where the top of the Life bar over a character's head goes (CSS px). */
function barTop(sprite: Sprite): number {
  return (
    sprite.position.y -
    HEAD_HEIGHT * sprite.scale.y -
    MONSTER_BAR.above -
    MONSTER_BAR.height
  );
}

/**
 * A Life bar: a dark back, filled from the left by `fraction` (0..1), in
 * `colour`, a Monster's red if not given.
 */
function lifeBar(
  graphics: Graphics,
  bar: {
    x: number;
    y: number;
    width: number;
    height: number;
    fraction: number;
    colour?: number;
  },
) {
  graphics
    .rect(bar.x, bar.y, bar.width, bar.height)
    .fill({ color: LIFE_BACK.colour, alpha: LIFE_BACK.alpha });
  graphics
    .rect(bar.x, bar.y, bar.width * bar.fraction, bar.height)
    .fill(bar.colour ?? LIFE_COLOUR);
}

/**
 * An outline for one sprite at a time: copies of its frame, solid in
 * `OUTLINE.colour`, shifted a little each way and drawn just behind it.
 */
function outlineView() {
  const layer = new Container();
  const solid = new ColorMatrixFilter({ resolution: "inherit" });
  const r = ((OUTLINE.colour >> 16) & 0xff) / 255;
  const g = ((OUTLINE.colour >> 8) & 0xff) / 255;
  const b = (OUTLINE.colour & 0xff) / 255;
  // Every colour to the outline's. Faint pixels, such as Flare's soft
  // shadows, drop out and the rest turn opaque, so only the body is outlined.
  solid.matrix = [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 10, -9];
  layer.filters = [solid];
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const copies = offsets.map(([x, y]) => {
    const copy = new Sprite();
    copy.position.set(x * OUTLINE.width, y * OUTLINE.width);
    layer.addChild(copy);
    return copy;
  });
  layer.visible = false;
  return {
    layer,
    /** Outlines `sprite` as last placed, or nothing. */
    show(sprite: Sprite | null) {
      layer.visible = sprite !== null;
      if (!sprite) return;
      layer.position.copyFrom(sprite.position);
      layer.zIndex = sprite.zIndex - 0.5;
      for (const copy of copies) {
        copy.texture = sprite.texture;
        copy.anchor.copyFrom(sprite.anchor);
        copy.scale.copyFrom(sprite.scale);
      }
    },
  };
}

/**
 * The stone strip along the bottom of the screen, with the Hero's Life orb
 * on it at the left and their Mana orb at the right, each filling from the
 * bottom. In Combat their surfaces ripple harder, with an "⚔ In Combat" badge
 * over the Life orb; while Life regenerates, bubbles rise through it under a
 * badge with the rate.
 */
function orbsView() {
  const layer = new Container();
  const graphics = new Graphics();
  const badge = new Text({
    text: "",
    style: { fill: BADGE.combat, fontFamily: SERIF },
  });
  badge.anchor.set(0.5, 1);
  layer.addChild(graphics, badge);

  return {
    layer,
    draw(screen: Viewport, world: World, nowMs: number) {
      const { uiScale } = screen;
      const { strip, edge, life: lifeOrb, mana: manaOrb } = orbsLayout(screen);
      const { radius: r, rim, y: cy } = lifeOrb;
      const lifeX = lifeOrb.x;
      const manaX = manaOrb.x;
      const seconds = nowMs / 1000;
      const inCombat = isInCombat(world);
      const regenerating = isRegenerating(world);

      graphics.clear();
      graphics
        .rect(strip.x, strip.y, strip.w, strip.h)
        .fill({ color: STRIP.colour, alpha: STRIP.alpha });
      graphics.rect(strip.x, strip.y, strip.w, edge).fill(STRIP.edgeColour);

      /** Draws an orb's rim, its fill up to `fraction` and its glass. */
      const drawOrb = (orb: Orb, cx: number, fraction: number) => {
        const colours = ORB_COLOURS[orb];
        graphics
          .circle(cx, cy, r + rim)
          .fill(ORB.rimColour)
          .stroke({ width: 2, color: ORB.rimLine });
        graphics.circle(cx, cy, r).fill(colours.empty);

        // One 1 px row at a time, so the surface can ripple.
        const surface = cy + r - fraction * r * 2;
        const ripple = (inCombat ? RIPPLE.combat : RIPPLE.calm) * uiScale;
        for (let y = Math.floor(surface); y < cy + r; y++) {
          const half = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
          const wave =
            y < surface + RIPPLE.depth * uiScale
              ? Math.sin(seconds * RIPPLE.speed + y) * ripple
              : 0;
          const height = (cy + r - y) / (r * 2);
          const lighter = Math.min(
            colours.lighten,
            Math.floor(height * colours.lighten),
          );
          graphics
            .rect(cx - half + wave, y, half * 2, 1)
            .fill(colours.fill + lighter * colours.lightenStep);
        }
      };

      const life = orbFill(world, "life");
      drawOrb("life", lifeX, life);
      drawOrb("mana", manaX, orbFill(world, "mana"));

      if (regenerating) {
        for (let i = 0; i < BUBBLES.count; i++) {
          const rise = (seconds * BUBBLES.rate + i / BUBBLES.count) % 1;
          const x = lifeX + Math.sin(i * 2.3 + seconds * 2) * r * 0.5;
          const y = cy + r - rise * life * r * 2;
          graphics
            .circle(x, y, BUBBLES.radius * uiScale)
            .fill({ color: BUBBLES.colour, alpha: BUBBLES.alpha * (1 - rise) });
        }
      }

      // The glass: a highlight and its rim, over each orb.
      for (const x of [lifeX, manaX]) {
        graphics
          .ellipse(x - r * 0.3, cy - r * 0.45, r * 0.35, r * 0.18)
          .fill({ color: 0xffffff, alpha: 0.12 });
        graphics.circle(x, cy, r).stroke({ width: 3, color: ORB.glassLine });
      }

      badge.visible = inCombat || regenerating;
      badge.text = inCombat
        ? "⚔ In Combat"
        : `+${heroTuning.regenPerSecond} Life/s`;
      badge.style.fill = inCombat ? BADGE.combat : BADGE.regen;
      sizeText(badge, BADGE.size * uiScale);
      badge.position.set(lifeX, cy - r - rim - BADGE.gap * uiScale);
    },
  };
}

/**
 * The Skill Bar between the orbs: each slot's key in its corner and its
 * Skill's name, dimmed while the Hero lacks the Mana for it or while it's
 * the Held Skill.
 */
function skillBarView(activeInput: Readonly<ActiveInput>) {
  const style = SKILL_BAR_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  const text = (fill: number) => {
    const t = new Text({ text: "", style: { fill, fontFamily: SERIF } });
    layer.addChild(t);
    return t;
  };
  /** Made as the sheet first lists them. */
  const labels: { key: Text; name: Text }[] = [];

  return {
    layer,
    draw(screen: Viewport, world: World, heldFrom: SkillBarSlot | null) {
      const { slots } = skillBarLayout(screen);
      const scale = screen.uiScale;
      graphics.clear();
      const sheet = skillBarSheet(world, heldFrom, activeInput.way);
      sheet.forEach((shown, index) => {
        if (!labels[index]) {
          const key = text(style.key);
          key.anchor.set(1, 0);
          const name = text(style.name);
          name.anchor.set(0.5);
          labels[index] = { key, name };
        }
        const { key, name } = labels[index];
        const rect = slots[shown.slot];
        const alpha = shown.dimmed ? style.dimmed : 1;
        const inset = 3 * scale;
        graphics
          .rect(rect.x, rect.y, rect.w, rect.h)
          .fill(style.fill)
          .stroke({ color: style.edge, width: 1.5 });
        if (shown.name !== null) {
          graphics
            .rect(
              rect.x + inset,
              rect.y + inset,
              rect.w - 2 * inset,
              rect.h - 2 * inset,
            )
            .fill({ color: style.skill, alpha })
            .stroke({ color: style.skillEdge, width: 1, alpha });
        }
        name.visible = shown.name !== null;
        name.text = shown.name ?? "";
        name.alpha = alpha;
        sizeText(name, style.nameSize * scale);
        name.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2 + 4 * scale);
        key.text = shown.key;
        sizeText(key, style.keySize * scale);
        key.position.set(rect.x + rect.w - inset, rect.y + 2 * scale);
      });
    },
  };
}

/**
 * The Belt strip beside the Skill Bar, in its look: each Belt Column's key
 * in its corner, its bottom Potion drawn tinted as its type, and how many
 * Potions the column holds.
 */
function beltStripView(activeInput: Readonly<ActiveInput>) {
  const style = SKILL_BAR_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  const text = (fill: number) => {
    const label = new Text({ text: "", style: { fill, fontFamily: SERIF } });
    layer.addChild(label);
    return label;
  };
  /** Made as the sheet first lists them. */
  const labels: { key: Text; count: Text; name: Text }[] = [];

  return {
    layer,
    draw(screen: Viewport, world: World) {
      const { columns } = beltStripLayout(screen);
      const scale = screen.uiScale;
      graphics.clear();
      const sheet = beltStripSheet(world, activeInput.way);
      sheet.forEach((shown, index) => {
        if (!labels[index]) {
          const key = text(style.key);
          key.anchor.set(1, 0);
          const count = text(style.name);
          count.anchor.set(0, 1);
          const name = text(INVENTORY_STYLE.itemText);
          name.anchor.set(0.5);
          labels[index] = { key, count, name };
        }
        const { key, count, name } = labels[index];
        const rect = columns[shown.column];
        graphics
          .rect(rect.x, rect.y, rect.w, rect.h)
          .fill(style.fill)
          .stroke({ color: style.edge, width: 1.5 });
        if (shown.type !== null) {
          // A placeholder Potion: a round body under a narrow neck.
          const colour = itemColour(shown.type);
          const centreX = rect.x + rect.w / 2;
          const centreY = rect.y + rect.h / 2 + 3 * scale;
          graphics
            .rect(
              centreX - 3 * scale,
              centreY - 15 * scale,
              6 * scale,
              7 * scale,
            )
            .fill(colour)
            .stroke({ color: style.skillEdge, width: 1 });
          graphics
            .circle(centreX, centreY, 10 * scale)
            .fill(colour)
            .stroke({ color: style.skillEdge, width: 1 });
          // Outlined to read over the Potion it names.
          labelItem(name, shown.type, rect.w, scale, 2);
          name.position.set(centreX, centreY);
        }
        name.visible = shown.type !== null;
        count.visible = shown.count > 0;
        count.text = String(shown.count);
        sizeText(count, style.nameSize * scale);
        count.position.set(rect.x + 3 * scale, rect.y + rect.h - 2 * scale);
        key.text = shown.key;
        sizeText(key, style.keySize * scale);
        key.position.set(rect.x + rect.w - 3 * scale, rect.y + 2 * scale);
      });
    },
  };
}

/** The touch controls' look; where they go is `touchControlsLayout`. */
const TOUCH_STYLE = {
  fill: 0x17130e,
  fillAlpha: 0.45,
  pressed: 0x6a4428,
  pressedAlpha: 0.75,
  edge: 0xe8d27a,
  edgeAlpha: 0.5,
  stickAlpha: 0.3,
  knob: 0.42,
  attackSize: 14,
  /** The pause button's two bars, as parts of its side. */
  pauseBar: { w: 0.14, h: 0.44, apart: 0.14 },
};

/**
 * The touch controls, while touch is the Active Input and the World runs
 * (with a panel open, the pause button alone): the Virtual Stick's ring where it rests or where the
 * thumb landed, its knob following the thumb, and the round attack and
 * Skill buttons, each Skill button naming its slot's Skill, dimmed when it
 * has none or lacks the Mana, and the pause button's two bars. A held
 * button shows pressed in.
 */
function touchControlsView(
  activeInput: Readonly<ActiveInput>,
  touch: Readonly<TouchControls>,
) {
  const style = TOUCH_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  const text = () => {
    const label = new Text({
      text: "",
      style: { fill: SKILL_BAR_STYLE.name, fontFamily: SERIF },
    });
    label.anchor.set(0.5);
    layer.addChild(label);
    return label;
  };
  const attackLabel = text();
  attackLabel.text = "Attack";
  const skillLabels = new Map<SkillBarSlot, Text>();

  return {
    layer,
    draw(screen: Viewport, world: World, menus: Menus) {
      layer.visible = touchControlsShown(activeInput.way, menus);
      if (!layer.visible) return;
      const layout = touchControlsLayout(screen, menus);
      const scale = screen.uiScale;
      const held = buttonsHeld(touch);
      graphics.clear();
      const ring = (middle: Vec, radius: number, down: boolean) =>
        graphics
          .circle(middle.x, middle.y, radius)
          .fill({
            color: down ? style.pressed : style.fill,
            alpha: down ? style.pressedAlpha : style.fillAlpha,
          })
          .stroke({ color: style.edge, width: 1.5, alpha: style.edgeAlpha });
      /** Rings the round button in `rect`, returning its middle. */
      const button = (rect: Rect, down: boolean) => {
        const middle = middleOf(rect);
        ring(middle, rect.w / 2, down);
        return middle;
      };

      // The pause button shows even while a panel is open.
      const { pause } = layout;
      const middle = button(pause, held.includes("menu"));
      const bar = style.pauseBar;
      for (const side of [-1, 1]) {
        graphics
          .rect(
            middle.x + side * bar.apart * pause.w - (bar.w * pause.w) / 2,
            middle.y - (bar.h * pause.h) / 2,
            bar.w * pause.w,
            bar.h * pause.h,
          )
          .fill({ color: style.edge, alpha: style.edgeAlpha });
      }
      attackLabel.visible = !layout.pauseOnly;
      for (const label of skillLabels.values()) {
        label.visible = !layout.pauseOnly;
      }
      if (layout.pauseOnly) return;

      const { reach, rest } = layout.stick;
      const stick = stickHeld(touch);
      const from = stick?.from ?? rest;
      graphics
        .circle(from.x, from.y, reach)
        .fill({ color: style.fill, alpha: style.stickAlpha })
        .stroke({ color: style.edge, width: 1.5, alpha: style.edgeAlpha });
      const pushed = stick ? clampedTo(stick.from, stick.at, reach) : from;
      ring(pushed, reach * style.knob, stick !== null);

      const attackMiddle = button(layout.attack, held.includes("a"));
      sizeText(attackLabel, style.attackSize * scale);
      attackLabel.position.set(attackMiddle.x, attackMiddle.y);

      for (const shown of skillBarSheet(world, null, "touch")) {
        const rect = layout.skills[shown.slot];
        const down = held.includes(castButton(shown.slot));
        const skillMiddle = button(rect, down);
        let label = skillLabels.get(shown.slot);
        if (!label) {
          label = text();
          skillLabels.set(shown.slot, label);
        }
        label.text = shown.name ?? "";
        label.alpha = shown.dimmed ? SKILL_BAR_STYLE.dimmed : 1;
        sizeText(label, SKILL_BAR_STYLE.nameSize * scale);
        label.position.set(skillMiddle.x, skillMiddle.y);
      }
    },
  };
}

/** `to`, brought within `reach` of `from`. */
function clampedTo(from: Vec, to: Vec, reach: number): Vec {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y);
  if (length <= reach) return to;
  return { x: from.x + (x / length) * reach, y: from.y + (y / length) * reach };
}

/**
 * The Panel buttons right of the Skill Bar, in its look: a stone-framed
 * square each, with a simple icon of its panel. A lit one, its panel open,
 * is pressed in with a gold frame and a bright icon; all are faded while
 * the Hero lies in Death. After them the round Town Portal button, a green
 * oval in a stone ring, faded and grey while greyed out. The hovered one
 * shows its tooltip over it, naming the buttons of `activeInput`, in an
 * Item tooltip's look, on `tooltipLayer` over the panels.
 */
function panelButtonsView(activeInput: Readonly<ActiveInput>) {
  const style = SKILL_BAR_STYLE;
  const look = PANEL_BUTTON_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  const tooltipLayer = new Container();
  const tooltipBox = new Graphics();
  tooltipLayer.addChild(tooltipBox);
  const tooltipText = new Text({
    text: "",
    style: {
      fill: INVENTORY_STYLE.tooltipName,
      fontSize: INVENTORY_STYLE.tooltipSize,
      fontFamily: SERIF,
    },
  });
  tooltipText.anchor.set(0.5, 0);
  tooltipLayer.addChild(tooltipText);

  return {
    layer,
    tooltipLayer,
    /**
     * `hovered` is the Panel button or Town Portal button under the cursor,
     * if any.
     */
    draw(
      screen: Viewport,
      menus: Menus,
      hero: HeroState & { inTown: boolean },
      hovered: Panel | "townPortal" | null,
    ) {
      const { buttons, townPortal } = panelButtonsLayout(screen);
      const scale = screen.uiScale;
      graphics.clear();
      tooltipBox.clear();
      tooltipText.visible = false;
      for (const shown of panelButtonsSheet(menus, hero)) {
        const rect = buttons[shown.panel];
        const alpha = shown.dimmed ? look.dimmed : 1;
        const edge = shown.lit ? style.skillEdge : style.edge;
        graphics
          .rect(rect.x, rect.y, rect.w, rect.h)
          .fill({ color: shown.lit ? style.skill : style.fill, alpha })
          .stroke({ color: edge, width: look.frame, alpha });
        // The stone frame's inner bevel, deeper when pressed in.
        const bevel = (shown.lit ? look.litBevel : look.bevel) * scale;
        graphics
          .rect(
            rect.x + bevel,
            rect.y + bevel,
            rect.w - 2 * bevel,
            rect.h - 2 * bevel,
          )
          .stroke({ color: edge, width: 1, alpha: look.bevelAlpha * alpha });
        panelIcon(
          graphics,
          shown.panel,
          // Pressed in: the icon sits lower.
          shown.lit ? { ...rect, y: rect.y + look.pressOffset * scale } : rect,
          shown.lit ? style.name : style.key,
          alpha,
          scale,
        );
        if (shown.panel === hovered) {
          tooltipText.text = shown.tooltip;
          tooltipText.visible = true;
          sizeText(tooltipText, INVENTORY_STYLE.tooltipSize * scale);
          drawTooltip(tooltipBox, [tooltipText], screen, (size, gap) =>
            panelButtonTooltipRect(screen, shown.panel, size, gap),
          );
        }
      }
      const portal = townPortalButtonSheet(hero, activeInput.way);
      const alpha = portal.greyed ? look.dimmed : 1;
      const radius = townPortal.w / 2;
      const x = townPortal.x + radius;
      const y = townPortal.y + radius;
      graphics
        .circle(x, y, radius)
        .fill({ color: style.fill, alpha })
        .stroke({ color: style.edge, width: look.frame, alpha });
      graphics.circle(x, y, radius - look.bevel * scale).stroke({
        color: style.edge,
        width: 1,
        alpha: look.bevelAlpha * alpha,
      });
      const icon = atUiScale(look.townPortal, scale);
      graphics.ellipse(x, y, icon.w / 2, icon.h / 2).fill({
        color: portal.greyed ? look.townPortal.greyed : look.townPortal.colour,
        alpha,
      });
      graphics
        .ellipse(
          x,
          y,
          (icon.w / 2) * look.townPortal.core,
          (icon.h / 2) * look.townPortal.core,
        )
        .fill({
          color: portal.greyed ? style.key : look.townPortal.coreColour,
          alpha,
        });
      if (hovered === "townPortal") {
        tooltipText.text = portal.tooltip;
        tooltipText.visible = true;
        sizeText(tooltipText, INVENTORY_STYLE.tooltipSize * scale);
        drawTooltip(tooltipBox, [tooltipText], screen, (size, gap) =>
          panelButtonTooltipRect(screen, "townPortal", size, gap),
        );
      }
    },
  };
}

/**
 * Draws a tooltip's box behind `lines`, already holding their words and
 * anchored at their top centre, and puts the lines in it: where `place`
 * puts a box its size, `gap` from what it's about. In the Item tooltip's
 * look.
 */
function drawTooltip(
  box: Graphics,
  lines: readonly Text[],
  screen: Viewport,
  place: (size: { w: number; h: number }, gap: number) => Rect,
) {
  const sizes = atUiScale(
    {
      padding: INVENTORY_STYLE.tooltipPadding,
      lineHeight: INVENTORY_STYLE.tooltipLineHeight,
      gap: INVENTORY_STYLE.tooltipGap,
    },
    screen.uiScale,
  );
  const pad = sizes.padding;
  const { x, y, w, h } = place(
    {
      w: Math.max(...lines.map((line) => line.width)) + 2 * pad,
      h: lines.length * sizes.lineHeight + 2 * pad,
    },
    sizes.gap,
  );
  box
    .rect(x, y, w, h)
    .fill({
      color: INVENTORY_STYLE.tooltip,
      alpha: INVENTORY_STYLE.tooltipAlpha,
    })
    .stroke({ color: HERO_PANEL_STYLE.edge, width: 1 });
  lines.forEach((line, i) => {
    line.position.set(x + w / 2, y + pad + i * sizes.lineHeight);
  });
}

/**
 * Draws a Panel button's icon centred in `rect` at the UI Scale `scale`: a
 * figure for the Hero panel, a bag for the Inventory panel, and linked
 * nodes for the Skill Tree panel.
 */
function panelIcon(
  graphics: Graphics,
  panel: Panel,
  rect: Rect,
  colour: number,
  alpha: number,
  scale: number,
) {
  const { icon, iconStroke } = PANEL_BUTTON_STYLE;
  const fill = { color: colour, alpha };
  const line = { color: colour, width: iconStroke * scale, alpha };
  const x = rect.x + rect.w / 2;
  const y = rect.y + rect.h / 2;
  if (panel === "hero") {
    const { headY, head, shoulders, shouldersY, feet, feetY } = atUiScale(
      icon.hero,
      scale,
    );
    graphics.circle(x, y + headY, head).fill(fill);
    graphics
      .poly([
        x - feet,
        y + feetY,
        x - shoulders,
        y + shouldersY,
        x + shoulders,
        y + shouldersY,
        x + feet,
        y + feetY,
      ])
      .fill(fill);
  }
  if (panel === "inventory") {
    const bag = atUiScale(icon.inventory, scale);
    graphics
      .roundRect(x - bag.w / 2, y + bag.y, bag.w, bag.h, bag.corner)
      .fill(fill)
      .rect(x - bag.strapW / 2, y + bag.y - bag.strapH, bag.strapW, bag.strapH)
      .stroke(line);
  }
  if (panel === "skillTree") {
    const { rootY, leafX, leafY, node } = atUiScale(icon.skillTree, scale);
    graphics
      .moveTo(x, y + rootY)
      .lineTo(x - leafX, y + leafY)
      .moveTo(x, y + rootY)
      .lineTo(x + leafX, y + leafY)
      .stroke(line);
    graphics.circle(x, y + rootY, node).fill(fill);
    graphics.circle(x - leafX, y + leafY, node).fill(fill);
    graphics.circle(x + leafX, y + leafY, node).fill(fill);
  }
}

/**
 * The Held Skill, drawn as it shows in a Skill Bar slot, centred on the
 * pointer.
 */
function createHeldSkillView() {
  const style = SKILL_BAR_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  const name = new Text({
    text: "",
    style: { fill: style.name, fontFamily: SERIF },
  });
  name.anchor.set(0.5);
  layer.addChild(graphics, name);
  layer.visible = false;

  return {
    layer,
    /** `uiScale` is the UI Scale the Skill Bar is drawn at. */
    draw(skill: Skill | null, pointer: Vec | null, uiScale: number) {
      layer.visible = skill !== null && pointer !== null;
      if (!skill || !pointer) return;
      const slot = SKILL_BAR.slot * uiScale;
      sizeText(name, style.nameSize * uiScale);
      graphics.clear();
      graphics
        .rect(-slot / 2, -slot / 2, slot, slot)
        .fill({ color: style.skill, alpha: 0.85 })
        .stroke({ color: style.skillEdge, width: 1 });
      name.text = skillTuning[skill].name;
      layer.position.set(pointer.x, pointer.y);
    },
  };
}

/**
 * The thin Experience bar along the strip, between the orbs, with
 * `Lv N` before it and `current / next` Experience after it.
 */
function experienceBarView() {
  const layer = new Container();
  const graphics = new Graphics();
  const style = { fill: EXPERIENCE_BAR_STYLE.textColour, fontFamily: SERIF };
  const level = new Text({ text: "", style });
  level.anchor.set(0, 0.5);
  const amount = new Text({ text: "", style });
  amount.anchor.set(1, 0.5);
  layer.addChild(graphics, level, amount);

  return {
    layer,
    draw(screen: Viewport, world: World) {
      const bar = experienceBar(
        world.hero.progress.level,
        world.hero.progress.experience,
      );
      const span = experienceBarLayout(screen);
      const sizes = atUiScale(EXPERIENCE_BAR, screen.uiScale);
      const y = span.y + span.h / 2;
      const left = span.x;
      const right = span.x + span.w;
      level.text = bar.level;
      sizeText(level, sizes.textSize);
      level.position.set(left, y);
      amount.text = bar.experience;
      sizeText(amount, sizes.textSize);
      amount.position.set(right, y);

      const from = left + level.width + sizes.textGap;
      const width = Math.max(0, right - amount.width - sizes.textGap - from);
      const top = y - sizes.height / 2;
      const look = EXPERIENCE_BAR_STYLE;
      graphics.clear();
      graphics
        .rect(from, top, width, sizes.height)
        .fill(look.back)
        .stroke({ width: 1, color: look.edge });
      if (bar.fill > 0) {
        graphics
          .rect(from, top, width * bar.fill, sizes.height)
          .fill(look.fill);
      }
    },
  };
}

/**
 * The Level Up button by the Life orb, shown while Attribute or Skill Points
 * are unspent but not while the Hero lies dead, its edge pulsing to catch
 * the eye.
 */
function levelUpButtonView() {
  const layer = new Container();
  const graphics = new Graphics();
  const label = new Text({
    text: "Level Up",
    style: { fill: HUD_BUTTON.text, fontFamily: SERIF },
  });
  label.anchor.set(0.5);
  layer.addChild(graphics, label);
  layer.visible = false;

  return {
    layer,
    draw(screen: Viewport, world: World, nowMs: number) {
      layer.visible = !world.death && hasUnspentPoints(world);
      if (!layer.visible) return;
      const rect = heroPanelLayout(screen).levelUp;
      sizeText(label, HUD_BUTTON.textSize * screen.uiScale);
      const { pulsesPerSecond, edgeFaint } = HUD_BUTTON;
      const pulse =
        (Math.sin((nowMs / 1000) * pulsesPerSecond * 2 * Math.PI) + 1) / 2;
      graphics.clear();
      button(graphics, rect, edgeFaint + pulse * (1 - edgeFaint));
      label.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
    },
  };
}

/** Draws a HUD button's box, its gold edge `edgeAlpha` opaque (0..1). */
function button(graphics: Graphics, rect: Rect, edgeAlpha = 1) {
  graphics
    .rect(rect.x, rect.y, rect.w, rect.h)
    .fill(HUD_BUTTON.fill)
    .stroke({ color: HUD_BUTTON.edge, width: 1.5, alpha: edgeAlpha });
}

/**
 * Draws a panel's × close button at `rect`, a HUD button with an × across
 * it, `CLOSE_BUTTON.cross` in from its edges at the UI Scale `scale`.
 */
function closeButton(graphics: Graphics, rect: Rect, scale: number) {
  button(graphics, rect);
  const crossInset = CLOSE_BUTTON.cross * scale;
  const left = rect.x + crossInset;
  const right = rect.x + rect.w - crossInset;
  const top = rect.y + crossInset;
  const bottom = rect.y + rect.h - crossInset;
  graphics
    .moveTo(left, top)
    .lineTo(right, bottom)
    .moveTo(right, top)
    .lineTo(left, bottom)
    .stroke({ color: HUD_BUTTON.text, width: 2 * scale });
}

/**
 * A panel's texts with their sizes at native scale, so each draw can size
 * them at the UI Scale.
 */
function scaledTexts() {
  const sizes = new Map<Text, number>();
  return {
    /** Keeps `text`, `size` at native scale. */
    add(text: Text, size: number) {
      sizes.set(text, size);
      return text;
    },
    /** Sizes every text kept at the UI Scale `scale`. */
    size(scale: number) {
      for (const [text, size] of sizes) sizeText(text, size * scale);
    },
  };
}

/**
 * The Hero panel: Level and Experience, each Attribute with a + button while
 * a point is left to place and a − while it has Pending Attribute Points,
 * the unspent points with Accept while any are pending, and what the
 * Attributes add up to, the pending points previewed in each.
 */
function heroPanelView(activeInput: Readonly<ActiveInput>) {
  const style = HERO_PANEL_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.visible = false;
  const texts = scaledTexts();
  const text = (fill: number, size = style.textSize) => {
    const t = new Text({
      text: "",
      style: { fill, fontSize: size, fontFamily: SERIF },
    });
    layer.addChild(t);
    return texts.add(t, size);
  };

  const title = text(style.title, style.titleSize);
  title.text = "Hero";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  /** A row's name at its left and value at its right. */
  const row = () => {
    const name = text(style.name);
    name.anchor.set(0, 0.5);
    const value = text(style.value);
    value.anchor.set(1, 0.5);
    return { name, value };
  };
  type Row = ReturnType<typeof row>;
  const level = row();
  const experience = row();
  const attributes = ATTRIBUTES.map(() => {
    const plus = text(style.title, style.plusSize);
    plus.text = "+";
    plus.anchor.set(0.5);
    const minus = text(style.title, style.plusSize);
    minus.text = "−";
    minus.anchor.set(0.5);
    return { ...row(), plus, minus };
  });
  const points = row();
  const accept = text(HUD_BUTTON.text, HUD_BUTTON.textSize);
  accept.text = "Accept";
  accept.anchor.set(0.5);
  /** Made as the sheet first lists them. */
  const derived: Row[] = [];

  return {
    layer,
    draw(
      screen: Viewport,
      world: World,
      open: boolean,
      pending: PendingPoints,
    ) {
      layer.visible = open;
      if (!open) return;
      hint.text = panelCloseHint("hero", activeInput.way);
      const sheet = heroSheet(world, pending);
      const layout = heroPanelLayout(screen);
      const { panel } = layout;
      const scale = screen.uiScale;
      const { padding, rowHeight } = atUiScale(HERO_PANEL, scale);
      // Attribute values leave room for their − and + buttons.
      const beforeButtons = layout.accept.x - style.plusGap * scale;

      graphics.clear();
      graphics
        .rect(panel.x, panel.y, panel.w, panel.h)
        .fill({ color: style.fill, alpha: style.alpha })
        .stroke({ color: style.edge, width: 2 });
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      const { closeHint } = layout;
      hint.position.set(
        closeHint.x + closeHint.w / 2,
        closeHint.y + closeHint.h,
      );

      const place = (
        shown: Row,
        at: number,
        name: string,
        value: string,
        valueRight?: number,
      ) => {
        const row = heroPanelRow(screen, at);
        const y = row.y + rowHeight / 2;
        shown.name.text = name;
        shown.name.position.set(row.x, y);
        shown.value.text = value;
        shown.value.position.set(valueRight ?? row.x + row.w, y);
        shown.value.style.fill = style.value;
      };
      /** Draws a HUD button at `rect` with `label` centred on it. */
      const placeButton = (label: Text, rect: Rect, shown: boolean) => {
        label.visible = shown;
        if (!shown) return;
        button(graphics, rect);
        label.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
      };
      place(level, PANEL_ROWS.level, sheet.level, "");
      place(experience, PANEL_ROWS.experience, "Experience", sheet.experience);
      sheet.attributes.forEach((attribute, i) => {
        const shown = attributes[i];
        place(
          shown,
          PANEL_ROWS.attributes + i,
          attribute.name,
          attribute.value,
          beforeButtons,
        );
        if (attribute.changed) shown.value.style.fill = style.changed;
        const { attribute: name } = attribute;
        placeButton(shown.plus, layout.raise[name], sheet.canRaise);
        placeButton(shown.minus, layout.lower[name], attribute.canLower);
      });
      place(
        points,
        PANEL_ROWS.attributePoints,
        "Attribute Points",
        sheet.attributePoints.value,
        beforeButtons,
      );
      if (sheet.canRaise) points.value.style.fill = style.title;
      if (sheet.attributePoints.changed) {
        points.value.style.fill = style.changed;
      }
      placeButton(accept, layout.accept, sheet.canAccept);
      sheet.derived.forEach((value, i) => {
        derived[i] ??= row();
        place(derived[i], PANEL_ROWS.derived + i, value.name, value.value);
        if (value.changed) derived[i].value.style.fill = style.changed;
      });
      for (const at of [PANEL_ROWS.attributes, PANEL_ROWS.derived]) {
        const row = heroPanelRow(screen, at);
        const y = row.y - style.ruleGap * scale;
        graphics.rect(row.x, y, row.w, 1).fill(style.edge);
      }
      // Rows made this draw too.
      texts.size(scale);
    },
  };
}

/**
 * The Skill Tree panel, in the Hero panel's look: the unspent Skill Points,
 * then a row for each Skill under its columns' headings: its name, its
 * required Level greyed-out until the Hero reaches it, its Skill Level and
 * Mana cost at the next Skill Level, with a + button while a Skill Point
 * can be spent on it; and the tooltip of the Skill at `tooltipAt`, if any.
 */
function skillTreePanelView(activeInput: Readonly<ActiveInput>) {
  const style = HERO_PANEL_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.visible = false;
  const texts = scaledTexts();
  const text = (fill: number, size = style.textSize) => {
    const t = new Text({
      text: "",
      style: { fill, fontSize: size, fontFamily: SERIF },
    });
    layer.addChild(t);
    return texts.add(t, size);
  };

  const title = text(style.title, style.titleSize);
  title.text = "Skill Tree";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  /** A row's name at its left and value at its right. */
  const row = (nameFill: number = style.name) => {
    const name = text(nameFill);
    name.anchor.set(0, 0.5);
    const value = text(style.value);
    value.anchor.set(1, 0.5);
    return { name, value };
  };
  const points = row();
  /** A column's heading, its right edge where the column's values end. */
  const heading = (label: string) => {
    const t = text(style.hint, style.hintSize);
    t.text = label;
    t.anchor.set(1, 0.5);
    return t;
  };
  const headings = {
    skillLevel: heading("Skill Level"),
    manaCost: heading("Mana"),
  };
  /** A Skill row's cell, at its left (`anchorX` 0) or right (1) edge. */
  const cell = (fill: number, anchorX: 0 | 1) => {
    const t = text(fill);
    t.anchor.set(anchorX, 0.5);
    return t;
  };
  const tooltipBox = new Graphics();
  layer.addChild(tooltipBox);
  /** Tooltip lines, made as more are needed, over its box. */
  const tooltipLines: Text[] = [];
  /** Made as the sheet first lists them. */
  const skills: {
    name: Text;
    requiredLevel: Text;
    skillLevel: Text;
    manaCost: Text;
    plus: Text;
  }[] = [];

  return {
    layer,
    draw(
      screen: Viewport,
      world: World,
      open: boolean,
      tooltipAt: Vec | null = null,
    ) {
      layer.visible = open;
      if (!open) return;
      hint.text = panelCloseHint("skillTree", activeInput.way);
      const sheet = skillTreeSheet(world);
      const layout = skillTreePanelLayout(screen);
      const { panel } = layout;
      const scale = screen.uiScale;
      const { padding, rowHeight } = atUiScale(SKILL_TREE_PANEL, scale);

      graphics.clear();
      graphics
        .rect(panel.x, panel.y, panel.w, panel.h)
        .fill({ color: style.fill, alpha: style.alpha })
        .stroke({ color: style.edge, width: 2 });
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      hint.position.set(panel.x + panel.w / 2, panel.y + panel.h - padding);

      const middle = (row: Rect) => row.y + rowHeight / 2;
      const anyRaisable = sheet.skills.some((skill) => skill.canRaise);
      const pointsRow = skillTreeRow(screen, SKILL_TREE_ROWS.skillPoints);
      points.name.text = "Skill Points";
      points.name.position.set(pointsRow.x, middle(pointsRow));
      points.value.text = sheet.skillPoints;
      points.value.position.set(pointsRow.x + pointsRow.w, middle(pointsRow));
      points.value.style.fill = anyRaisable ? style.title : style.value;

      const headingsRow = skillTreeRow(screen, SKILL_TREE_ROWS.headings);
      const headingAt = skillTreeColumns(screen, headingsRow);
      headings.skillLevel.position.set(
        headingAt.skillLevel,
        middle(headingsRow),
      );
      headings.manaCost.position.set(headingAt.manaCost, middle(headingsRow));
      const ruleY = headingsRow.y - style.ruleGap * scale;
      graphics.rect(headingsRow.x, ruleY, headingsRow.w, 1).fill(style.edge);

      sheet.skills.forEach((skill, index) => {
        if (!skills[index]) {
          const plusText = text(style.title, style.plusSize);
          plusText.text = "+";
          plusText.anchor.set(0.5);
          skills[index] = {
            name: cell(style.title, 0),
            requiredLevel: cell(style.hint, 0),
            skillLevel: cell(style.value, 1),
            manaCost: cell(style.value, 1),
            plus: plusText,
          };
        }
        const shown = skills[index];
        const row = skillTreeRow(screen, skillRow(index));
        const column = skillTreeColumns(screen, row);
        const y = middle(row);
        shown.name.text = skill.name;
        shown.name.position.set(row.x, y);
        shown.requiredLevel.visible = skill.requiredLevel !== null;
        shown.requiredLevel.text = `Level ${skill.requiredLevel}`;
        shown.requiredLevel.position.set(column.requiredLevel, y);
        shown.skillLevel.text = skill.skillLevel;
        shown.skillLevel.position.set(column.skillLevel, y);
        shown.manaCost.text = skill.manaCost;
        shown.manaCost.position.set(column.manaCost, y);
        const rect = layout.raise[skill.skill];
        shown.plus.visible = skill.canRaise;
        if (skill.canRaise) {
          button(graphics, rect);
          shown.plus.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
        }
      });
      // Rows made this draw too.
      texts.size(scale);

      tooltipBox.clear();
      for (const line of tooltipLines) line.visible = false;
      const under =
        tooltipAt &&
        sheet.skills.find((skill) =>
          inside(layout.skills[skill.skill], tooltipAt),
        );
      if (tooltipAt && under) {
        const look = INVENTORY_STYLE;
        const lines = skillTooltip(under, activeInput.way);
        // Over the rows, some made after it.
        layer.setChildIndex(tooltipBox, layer.children.length - 1);
        lines.forEach((line, i) => {
          if (!tooltipLines[i]) {
            tooltipLines[i] = text(look.tooltipLine, look.tooltipSize);
            tooltipLines[i].anchor.set(0.5, 0);
          }
          const shown = tooltipLines[i];
          // Over the box, which is made before any line.
          layer.setChildIndex(shown, layer.children.length - 1);
          shown.visible = true;
          shown.text = line;
          shown.style.fill = i === 0 ? look.tooltipName : look.tooltipLine;
        });
        // Lines made this draw too, before the box is fitted to them.
        texts.size(scale);
        const rect = layout.skills[under.skill];
        drawTooltip(
          tooltipBox,
          tooltipLines.slice(0, lines.length),
          screen,
          (size, gap) => tooltipRect(rect, size, screen, gap),
        );
      }
    },
  };
}

/**
 * The Inventory panel: the Equipment slots over the 10×4 grid, each Item
 * drawn at its size, and the tooltip of the Item under the cursor.
 */
function inventoryPanelView(activeInput: Readonly<ActiveInput>) {
  const style = HERO_PANEL_STYLE;
  const look = INVENTORY_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.visible = false;
  const texts = scaledTexts();
  const text = (fill: number, size: number) => {
    const t = new Text({
      text: "",
      style: { fill, fontSize: size, fontFamily: SERIF },
    });
    layer.addChild(t);
    return texts.add(t, size);
  };

  const title = text(style.title, style.titleSize);
  title.text = "Inventory";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  const slotLabels = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => {
      const label = text(look.slotLabel, look.slotLabelSize);
      label.text = SLOT_NAMES[slot];
      label.anchor.set(0.5);
      return [slot, label];
    }),
  ) as Record<EquipmentSlot, Text>;
  /**
   * Item names, one per Item drawn, made as more are needed, each sized by
   * its label rather than with the panel's texts.
   */
  const names: Text[] = [];
  const itemName = () => {
    const name = new Text({
      text: "",
      style: { fill: look.itemText, fontFamily: SERIF },
    });
    layer.addChild(name);
    return name;
  };
  const tooltipBox = new Graphics();
  layer.addChild(tooltipBox);
  /** Tooltip lines, made as more are needed, over its box. */
  const tooltipLines: Text[] = [];
  /**
   * The Held Item on the cursor, over the panels, drawn even with the panel
   * shut after a lift from the Belt strip.
   */
  const heldLayer = new Container();
  const heldBox = new Graphics();
  const heldName = new Text({
    text: "",
    style: { fill: look.itemText, fontFamily: SERIF },
  });
  heldLayer.addChild(heldBox, heldName);

  /**
   * Draws an Item's box, tinted as its type, with its label in `name` at
   * the UI Scale `scale`.
   */
  const drawItem = (
    to: Graphics,
    name: Text,
    rect: Rect,
    type: ItemType,
    scale: number,
    alpha = look.itemAlpha,
  ) => {
    to.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
      .fill({ color: itemColour(type), alpha })
      .stroke({ color: look.itemEdge, width: 1 });
    name.visible = true;
    labelItem(name, type, rect.w, scale);
    name.anchor.set(0.5);
    name.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
  };

  /**
   * Draws the Held Item, if any, centred on `pointer`, at the size of the
   * grid laid out as `layout`.
   */
  const drawHeld = (
    world: World,
    pointer: Vec | null,
    layout: InventoryPanelLayout,
    scale: number,
  ) => {
    heldBox.clear();
    heldName.visible = false;
    const held = cursorItemOf(world);
    if (!held || !pointer) return;
    const { type } = held.item;
    const rect = heldItemRect(layout, pointer, type);
    drawItem(heldBox, heldName, rect, type, scale, look.heldAlpha);
  };

  return {
    layer,
    heldLayer,
    /**
     * `hovered` is the spot under `pointer`, the cursor on the canvas (CSS
     * px), if it's on the panel.
     */
    draw(
      screen: Viewport,
      world: World,
      open: boolean,
      hovered: ItemSpot | null,
      pointer: Vec | null,
    ) {
      const layout = inventoryPanelLayout(screen, beltRows(world));
      const { panel, grid, cell, slots } = layout;
      const scale = screen.uiScale;
      const { padding } = atUiScale(INVENTORY_PANEL, scale);
      // Before any return: the Held Item's name, drawn with the panel shut.
      // Names and tooltip lines made this draw are sized as they're made.
      texts.size(scale);
      drawHeld(world, pointer, layout, scale);
      layer.visible = open;
      if (!open) return;
      hint.text = panelCloseHint("inventory", activeInput.way);

      graphics.clear();
      graphics
        .rect(panel.x, panel.y, panel.w, panel.h)
        .fill({ color: style.fill, alpha: style.alpha })
        .stroke({ color: style.edge, width: 2 });
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      hint.position.set(panel.x + panel.w / 2, panel.y + panel.h - padding);

      const box = (rect: Rect) =>
        graphics
          .rect(rect.x, rect.y, rect.w, rect.h)
          .fill(look.cell)
          .stroke({ color: look.cellEdge, width: 1 });
      for (let column = 0; column < grid.w / cell; column++) {
        for (let row = 0; row < grid.h / cell; row++) {
          box({
            x: grid.x + column * cell,
            y: grid.y + row * cell,
            w: cell,
            h: cell,
          });
        }
      }

      const items: { rect: Rect; type: ItemType }[] = [];
      const equipment = equipmentOf(world);
      for (const slot of EQUIPMENT_SLOTS) {
        const rect = slots[slot];
        box(rect);
        const item = equipment[slot];
        slotLabels[slot].visible = item === null;
        slotLabels[slot].position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
        if (item) items.push({ rect, type: item.type });
      }
      for (const { item, cell: at } of inventoryOf(world)) {
        items.push({ rect: itemRect(layout, at, item.type), type: item.type });
      }
      const potions = beltOf(world);
      layout.belt.forEach((cells, column) => {
        cells.forEach((rect, row) => {
          box(rect);
          const potion = potions[column]?.[row];
          if (potion) items.push({ rect, type: potion.type });
        });
      });
      items.forEach(({ rect, type }, i) => {
        names[i] ??= itemName();
        drawItem(graphics, names[i], rect, type, scale);
      });
      for (const name of names.slice(items.length)) name.visible = false;

      tooltipBox.clear();
      for (const line of tooltipLines) line.visible = false;
      const held = cursorItemOf(world);
      if (held && pointer) {
        const { type } = held.item;
        if (hovered && isBeltCell(hovered)) {
          // The column's lowest free row where it takes it, else the whole
          // column, refusing it.
          const cells = layout.belt[hovered.beltColumn];
          const lands = beltOf(world)[hovered.beltColumn].length;
          const fits = placement(world, hovered) !== null;
          const top = cells[cells.length - 1];
          const rect = fits
            ? cells[lands]
            : { ...top, h: cells[0].y + cells[0].h - top.y };
          graphics.rect(rect.x, rect.y, rect.w, rect.h).fill({
            color: fits ? look.fits : look.refused,
            alpha: look.landingAlpha,
          });
        }
        if (hovered && isCell(hovered)) {
          // Where it would land, kept to the grid where it hangs off.
          const to = landingCell(layout, pointer, type);
          const rect = itemRect(layout, to, type);
          const x = Math.max(rect.x, grid.x);
          const y = Math.max(rect.y, grid.y);
          const w = Math.min(rect.x + rect.w, grid.x + grid.w) - x;
          const h = Math.min(rect.y + rect.h, grid.y + grid.h) - y;
          const colour = placement(world, to) ? look.fits : look.refused;
          graphics
            .rect(x, y, w, h)
            .fill({ color: colour, alpha: look.landingAlpha });
        }
        if (hovered && isSlot(hovered)) {
          // Whether the slot takes it.
          const rect = slots[hovered];
          const colour = placement(world, hovered) ? look.fits : look.refused;
          graphics
            .rect(rect.x, rect.y, rect.w, rect.h)
            .fill({ color: colour, alpha: look.landingAlpha });
        }
        // No tooltip while holding an Item, as in Diablo 2.
        return;
      }
      const item = hovered && itemUnder(world, hovered);
      if (!hovered || !item) return;
      const under = isSlot(hovered)
        ? slots[hovered]
        : isBeltCell(hovered)
          ? layout.belt[hovered.beltColumn][hovered.row]
          : itemRect(
              layout,
              inventoryOf(world).find((placed) => placed.item.id === item.id)
                ?.cell ?? hovered,
              item.type,
            );
      const lines = itemTooltip(item.type);
      lines.forEach((line, i) => {
        if (!tooltipLines[i]) {
          tooltipLines[i] = text(look.tooltipLine, look.tooltipSize);
          sizeText(tooltipLines[i], look.tooltipSize * scale);
        }
        const shown = tooltipLines[i];
        // Over the box, which is made before any line.
        layer.setChildIndex(shown, layer.children.length - 1);
        shown.visible = true;
        shown.text = line;
        shown.style.fill = i === 0 ? look.tooltipName : look.tooltipLine;
        shown.anchor.set(0.5, 0);
      });
      // Over the Item, or under it where there's no room above.
      drawTooltip(
        tooltipBox,
        tooltipLines.slice(0, lines.length),
        screen,
        (size, gap) => tooltipRect(under, size, screen, gap),
      );
    },
  };
}

/**
 * The screen over a dead Hero: darkening while they lie still, then "You
 * died" with a pulsing hint to go on, named for the Active Input.
 */
function deathScreenView(activeInput: Readonly<ActiveInput>) {
  const layer = new Container();
  const dark = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  const title = new Text({
    text: "You died",
    style: {
      fill: DEATH_SCREEN.title.colour,
      fontSize: DEATH_SCREEN.title.size,
      fontFamily: SERIF,
    },
  });
  title.anchor.set(0.5, 1);
  const hint = new Text({
    text: "",
    style: {
      fill: DEATH_SCREEN.hint.colour,
      fontSize: DEATH_SCREEN.hint.size,
      fontFamily: SERIF,
    },
  });
  hint.anchor.set(0.5, 0);
  layer.addChild(dark, title, hint);
  layer.visible = false;

  return {
    layer,
    draw(
      screen: { width: number; height: number },
      world: World,
      nowMs: number,
    ) {
      layer.visible = world.death !== null;
      if (!world.death) return;
      const lying = Math.min(1, world.death.elapsed / DEATH_STEPS);
      dark.alpha = DEATH_SCREEN.darkness * lying;
      dark.scale.set(screen.width, screen.height);

      const ready = lying === 1;
      title.visible = ready;
      hint.visible = ready;
      hint.text = deathHint(activeInput.way);
      const centre = { x: screen.width / 2, y: screen.height / 2 };
      title.position.set(centre.x, centre.y);
      hint.position.set(centre.x, centre.y + DEATH_SCREEN.hint.gap);
      const wave = Math.sin(
        (nowMs / 1000) * DEATH_SCREEN.pulsesPerSecond * 2 * Math.PI,
      );
      const { faintest } = DEATH_SCREEN;
      hint.alpha = faintest + ((1 - faintest) * (wave + 1)) / 2;
    },
  };
}

/**
 * The menu over a paused game: it credits the Flare art and points to
 * `CREDITS.md` for the rest, and offers a New Hero.
 */
function pauseMenuView(activeInput: Readonly<ActiveInput>) {
  const { darkness, panel, title, credit, question, hint } = PAUSE_MENU;
  const { width, height } = PAUSE_MENU_LAYOUT;
  const layer = new Container();
  const dark = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  dark.alpha = darkness;
  const box = new Graphics()
    .rect(0, 0, width, height)
    .fill(panel.colour)
    .stroke({ color: panel.edge, width: 2 });
  const heading = new Text({
    text: "Paused",
    style: { fill: title.colour, fontSize: title.size, fontFamily: SERIF },
  });
  heading.anchor.set(0.5, 0);
  const credits = new Text({
    text: [
      "Art from Flare: Empyrean Campaign",
      "by Clint Bellanger and contributors",
      "github.com/flareteam/flare-game · CC-BY-SA 3.0",
      "Full credits in CREDITS.md",
    ].join("\n"),
    style: {
      fill: credit.colour,
      fontSize: credit.size,
      fontFamily: SERIF,
      align: "center",
      lineHeight: credit.lineHeight,
    },
  });
  credits.anchor.set(0.5, 0);
  const confirm = new Text({
    text: "",
    style: {
      fill: question.colour,
      fontSize: question.size,
      fontFamily: SERIF,
      align: "center",
      lineHeight: question.lineHeight,
    },
  });
  confirm.anchor.set(0.5, 0);
  const resume = new Text({
    text: "",
    style: { fill: hint.colour, fontSize: hint.size, fontFamily: SERIF },
  });
  resume.anchor.set(0.5, 1);
  /**
   * Each text with where it goes in the panel and its size, at native
   * scale: sized afresh rather than scaled, so it stays crisp.
   */
  const placed = [
    { text: heading, y: title.top, size: title.size },
    { text: credits, y: credit.top, size: credit.size, line: credit },
    { text: confirm, y: question.top, size: question.size, line: question },
    { text: resume, y: height - hint.bottom, size: hint.size },
  ];
  const content = new Container();
  content.addChild(box, heading, credits, confirm, resume);
  layer.addChild(dark, content);
  // On the screen, where `pauseMenuLayout` puts them.
  const buttons = menuButtonsView(layer);
  layer.visible = false;

  return {
    layer,
    /**
     * While confirming, asks whether to give up the Level `level` Hero for a
     * New Hero. The button `focus` names is ringed, for a controller. The
     * Fullscreen button shows, and reads, as `fullscreen` says.
     */
    draw(
      screen: Viewport,
      pause: Pause,
      level: number,
      focus: MenuChoice | null,
      fullscreen: Fullscreen,
    ) {
      layer.visible = pause.paused;
      if (!pause.paused) return;
      const { confirming } = pause;
      credits.visible = !confirming;
      confirm.visible = confirming;
      if (confirming) {
        confirm.text = [
          "Start a New Hero?",
          `Your Level ${level} Hero will be lost for good.`,
        ].join("\n");
      }
      resume.text = resumeHint(confirming, activeInput.way);
      dark.scale.set(screen.width, screen.height);
      const layout = pauseMenuLayout(
        screen,
        confirming,
        activeInput.way,
        fullscreen,
      );
      const scale = screen.uiScale;
      content.position.set(layout.panel.x, layout.panel.y);
      box.scale.set(scale);
      for (const { text, y, size, line } of placed) {
        sizeText(text, size * scale);
        if (line) text.style.lineHeight = line.lineHeight * scale;
        text.position.set((width / 2) * scale, y * scale);
      }
      buttons.draw(layout.buttons, scale, focus);
    },
  };
}

/**
 * The Rotate Notice's look: the pause menu's colours on a screen blacked
 * out, its title and text centred. Its sizes are `ROTATE_NOTICE_LAYOUT`'s.
 */
const ROTATE_NOTICE = {
  title: { colour: PAUSE_MENU.title.colour },
  body: { colour: PAUSE_MENU.credit.colour },
};

/**
 * The Rotate Notice, hiding the game while the viewport says it shows:
 * asking to turn the screen sideways, or saying it's too small, in the
 * Active Input's words, with the Fullscreen button for touch where the
 * browser allows fullscreen.
 */
function rotateNoticeView(activeInput: Readonly<ActiveInput>) {
  const { titleSize, bodySize, lineHeight, margin } = ROTATE_NOTICE_LAYOUT;
  const layer = new Container();
  const black = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  const heading = new Text({
    text: "",
    style: {
      fill: ROTATE_NOTICE.title.colour,
      fontSize: titleSize,
      fontFamily: SERIF,
      align: "center",
      wordWrap: true,
    },
  });
  heading.anchor.set(0.5, 1);
  const message = new Text({
    text: "",
    style: {
      fill: ROTATE_NOTICE.body.colour,
      fontSize: bodySize,
      fontFamily: SERIF,
      align: "center",
      lineHeight,
      wordWrap: true,
    },
  });
  message.anchor.set(0.5, 0);
  layer.addChild(black, heading, message);
  const buttons = menuButtonsView(layer);
  layer.visible = false;

  return {
    layer,
    /** The Fullscreen button shows, and reads, as `fullscreen` says. */
    draw(screen: Viewport, fullscreen: Fullscreen) {
      layer.visible = screen.rotateNotice !== null;
      if (screen.rotateNotice === null) return;
      const text = rotateNoticeText(screen.rotateNotice, activeInput.way);
      heading.text = text.title;
      message.text = text.body;
      black.scale.set(screen.width, screen.height);
      const scale = screen.uiScale;
      const wrap = Math.max(1, screen.width - 2 * margin * scale);
      for (const t of [heading, message]) {
        if (t.style.wordWrapWidth !== wrap) t.style.wordWrapWidth = wrap;
      }
      sizeText(heading, titleSize * scale);
      sizeText(message, bodySize * scale);
      if (message.style.lineHeight !== lineHeight * scale) {
        message.style.lineHeight = lineHeight * scale;
      }
      const layout = rotateNoticeLayout(screen, activeInput.way, fullscreen);
      heading.position.set(screen.width / 2, layout.title.bottom);
      message.position.set(screen.width / 2, layout.body.top);
      buttons.draw(layout.button ? [layout.button] : [], scale, null);
    },
  };
}

/**
 * Menu buttons with their labels, added to `layer`: the pause menu's, and
 * the Rotate Notice's Fullscreen button.
 */
function menuButtonsView(layer: Container) {
  const graphics = new Graphics();
  layer.addChild(graphics);
  /** Made as the buttons are first drawn. */
  const labels: Text[] = [];
  return {
    /**
     * Draws `buttons` where they are laid out, at the UI Scale `scale`,
     * ringing the one `focus` names for a controller.
     */
    draw(
      buttons: readonly MenuButton[],
      scale: number,
      focus: MenuChoice | null,
    ) {
      graphics.clear();
      for (const label of labels) label.visible = false;
      buttons.forEach(({ choice, label: name, rect }, i) => {
        button(graphics, rect);
        if (choice === focus) {
          const { colour, width } = FOCUS_RING;
          const ring = (width * scale) / 2 + 1;
          graphics
            .rect(
              rect.x - ring,
              rect.y - ring,
              rect.w + 2 * ring,
              rect.h + 2 * ring,
            )
            .stroke({ color: colour, width: width * scale });
        }
        labels[i] ??= menuLabel(layer);
        const label = labels[i];
        label.text = name;
        label.visible = true;
        sizeText(label, PAUSE_MENU.button.size * scale);
        label.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
      });
    },
  };
}

/** A menu button's label, centred where it's put, added to `layer`. */
function menuLabel(layer: Container): Text {
  const label = new Text({
    text: "",
    style: {
      fill: HUD_BUTTON.text,
      fontSize: PAUSE_MENU.button.size,
      fontFamily: SERIF,
    },
  });
  label.anchor.set(0.5);
  layer.addChild(label);
  return label;
}

/** The style Item labels are measured in, made on first use. */
let itemLabelStyle: TextStyle | null = null;

/** How wide `text` is in the Item labels' font at `size` (CSS px). */
function measureItemText(text: string, size: number): number {
  itemLabelStyle ??= new TextStyle({ fontFamily: SERIF });
  itemLabelStyle.fontSize = size;
  return CanvasTextMetrics.measureText(text, itemLabelStyle).width;
}

/** How far an Item's label keeps in from each side of its box (CSS px). */
const ITEM_LABEL_INSET = 2;

/**
 * Sets `text` to an Item type's label for a box `width` CSS px wide, on one
 * line inside its inset, at the UI Scale `scale`, with a black outline
 * `stroke` wide if given: the full name, or the Short name where it won't
 * fit. Names grow with a UI Scale over 1, never shrink below their normal
 * size with one under it.
 */
function labelItem(
  text: Text,
  type: ItemType,
  width: number,
  scale: number,
  stroke?: number,
) {
  const { name, shortName } = itemOf(type);
  const label = itemLabel({
    name,
    shortName,
    width: width - 2 * ITEM_LABEL_INSET,
    measure: measureItemText,
    uiScale: scale,
  });
  text.text = label.text;
  text.style.wordWrap = false;
  sizeText(text, label.size, stroke);
}

/** The width of the black outline `sizeText` last gave each text. */
const strokeWidths = new WeakMap<Text, number>();

/**
 * Sets `text`'s font size, and its black outline's width if given, only
 * when they change, as each change renders the text afresh.
 */
function sizeText(text: Text, size: number, stroke?: number) {
  if (text.style.fontSize !== size) text.style.fontSize = size;
  if (stroke !== undefined && strokeWidths.get(text) !== stroke) {
    text.style.stroke = { color: 0x000000, width: stroke };
    strokeWidths.set(text, stroke);
  }
}

/** The point `alpha` (0..1) of the way from `from` to `to`. */
function lerp(from: Vec, to: Vec, alpha: number): Vec {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  };
}

/** The corners of tile (i, j) on screen: top, right, bottom, left. */
function diamond(i: number, j: number): number[] {
  return [
    toScreen({ x: i, y: j }),
    toScreen({ x: i + 1, y: j }),
    toScreen({ x: i + 1, y: j + 1 }),
    toScreen({ x: i, y: j + 1 }),
  ].flatMap(({ x, y }) => [x, y]);
}

/**
 * One sprite per tile of a row-major grid of tile ids, each standing on the
 * centre of its diamond and sorted by it.
 */
function drawTiles(area: Area, tiles: (number | null)[], art: Art) {
  const sprites: Sprite[] = [];
  const tileset = area.tileset === null ? undefined : art.tiles[area.tileset];
  tiles.forEach((id, i) => {
    if (id === null) return;
    const texture = tileset?.get(id);
    if (!texture) {
      throw new Error(`Area "${area.name}" uses missing tile ${id}`);
    }
    const sprite = new Sprite(texture);
    const at = toScreen({
      x: (i % area.width) + 0.5,
      y: Math.floor(i / area.width) + 0.5,
    });
    sprite.position.set(at.x, at.y);
    sprite.zIndex = at.y;
    sprites.push(sprite);
  });
  return sprites;
}

/** A diamond centred on its origin, the size of one tile. */
function drawMarker() {
  return new Graphics()
    .poly(diamond(-0.5, -0.5))
    .stroke({ color: MARKER_LINE, width: 2 });
}
