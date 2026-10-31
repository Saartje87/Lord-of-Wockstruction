import {
  type Application,
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import type { CursorHit } from "../cursor";
import type { Fullscreen } from "../fullscreen";
import type { ActiveInput } from "../input/activeInput";
import { castButton } from "../input/pad";
import { buttonsHeld, stickHeld, type TouchControls } from "../input/touch";
import {
  type FullscreenChoice,
  type HeroState,
  type MenuChoice,
  type Menus,
  noPendingPoints,
  type Panel,
  type PendingPoints,
  type StartScreen,
} from "../menus";
import type { Pause } from "../pause";
import { itemTitle } from "../sim/affixes";
import type { Area } from "../sim/area";
import { beltOf, beltRows, isBeltCell } from "../sim/belt";
import {
  cursorItemOf,
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
  equipmentOf,
  type Item,
  type ItemId,
  type ItemSpot,
  inventoryItemAt,
  inventoryOf,
  isCell,
  isGoodSpot,
  isSlot,
  placement,
} from "../sim/inventory";
import { monsterMaxLife } from "../sim/monsters";
import { inside, middleOf, type Rect } from "../sim/rect";
import type { SkillBarSlot } from "../sim/skillBar";
import { cornersOf, type Vec } from "../sim/vec";
import { buyable, goodAt, goodsOf } from "../sim/vendor";
import {
  ATTRIBUTES,
  areaFade,
  DEATH_STEPS,
  groundItemsOf,
  hasQuestToDeal,
  inTown,
  isInCombat,
  isRegenerating,
  type MinionId,
  type Monster,
  type MonsterId,
  npcsIn,
  type SimEvent,
  townPortalFlash,
  townPortalIn,
  type World,
} from "../sim/world";
import { heroTuning } from "../tuning/hero";
import {
  type ItemType,
  inventoryTuning,
  itemOf,
  type Rarity,
} from "../tuning/items";
import type { MinionType } from "../tuning/minions";
import type { MonsterType } from "../tuning/monsters";
import { type Branch, type Skill, skillTuning } from "../tuning/skills";
import { townPortalLook } from "../tuning/townPortalLook";
import { vendorTuning } from "../tuning/vendor";
import { atUiScale, type Viewport, viewportOf } from "../viewport";
import { tileToScreen, type WorldCamera } from "../world3d/camera";
import { CRUMBLE_SECONDS } from "../world3d/crumble";
import { groundSpotsOf } from "../world3d/groundSpots";
import { MONSTER_LOOKS } from "../world3d/monsterLook";
import { NPC_LOOKS } from "../world3d/npcLook";
import { npcPickablesOf, pickablesOf } from "../world3d/pickables";
import { characterUnder3d, type Pickable3d } from "../world3d/picking";
import type { DepartedMinion, Effects } from "../world3d/view";
import {
  actCompletedText,
  actCompleteLayout,
  actCompleteOpacityAt,
} from "./actCompleteBanner";
import {
  areaBannerLayout,
  arrivedInDisplayName,
  bannerOpacityAt,
} from "./areaBanner";
import { beltStripLayout, beltStripSheet } from "./beltStrip";
import { CLOSE_BUTTON } from "./closeButton";
import { corpseBurst } from "./corpseBurst";
import {
  CURSE_MARK,
  type CurseLook,
  curseCircle,
  curseLook,
  curseMarkAlpha,
} from "./curse";
import { cursorHitAt, type ShownPanels } from "./cursorHit";
import {
  DAMAGE_NUMBER,
  type DamageNumber,
  damageNumbers,
  floatAt,
  floatText,
  numberColour,
} from "./damageNumbers";
import { DIALOGUE, dialogueLayout, dialogueSheet } from "./dialoguePanel";
import {
  EXPERIENCE_BAR,
  experienceBar,
  experienceBarLayout,
} from "./experienceBar";
import {
  GOLD_COLOUR,
  goldPileLabel,
  goldTotalLabel,
  UNAFFORDABLE_COLOUR,
} from "./goldArt";
import {
  GROUND_LABEL,
  type GroundLabel,
  goldLabelId,
  groundItemLabelAt,
  groundItemUnder,
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
import {
  deathHint,
  mapTooltip,
  panelCloseHint,
  resumeHint,
  skillTooltip,
} from "./hints";
import {
  type CharacterId,
  hoveredOf,
  nameplateLayout,
  nameplateOf,
} from "./hover";
import { hurtFlashLeft } from "./hurtFlash";
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
import { itemColour, itemLabel, rarityColour } from "./itemArt";
import {
  MAP_LOOK,
  MAP_OVERLAY,
  type MapInputs,
  mapAreaNameLayout,
  mapMarks,
  mapOffset,
  mapOverlayScale,
} from "./mapMarks";
import {
  MINI_MAP,
  miniMapLayout,
  miniMapScale,
  miniMapShown,
  miniMapTooltipRect,
} from "./miniMap";
import {
  MINION_FRAME,
  minionFrameLayout,
  minionFrameRows,
  minionsFlashed,
} from "./minionFrame";
import {
  heroHitShows,
  type Orb,
  orbFill,
  orbsLayout,
  wardFill,
  wardPulseBrightness,
} from "./orbs";
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
import { QUEST_MARK, questMarkBob } from "./questMark";
import { QUEST_PANEL, questPanelLayout, questPanelSheet } from "./questPanel";
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
  skillTreeBranchRow,
  skillTreeColumns,
  skillTreePanelLayout,
  skillTreeRow,
  skillTreeSheet,
} from "./skillTreePanel";
import { slotHintPolygons } from "./slotHints";
import { GAME_NAME, startChoiceAt, startScreenLayout } from "./startScreen";
import { tooltipRect } from "./tooltip";
import { touchControlsLayout, touchControlsShown } from "./touchControls";
import { shownTownPortals, townPortalCloseScale } from "./townPortalLook";
import {
  goodsGrid,
  goodTooltip,
  inventoryGrid,
  sellTooltip,
  VENDOR_PANEL,
  type VendorHit,
  vendorPanelLayout,
} from "./vendorPanel";
import {
  WAYPOINT_LIST,
  waypointListLayout,
  waypointListSheet,
  waypointPickable,
} from "./waypointList";

/** How long a hit Monster flashes white (ms), fading out. */
const FLASH_MS = 120;
/** How white a hit Monster turns at the start of its flash (0..1). */
const FLASH_STRENGTH = 0.8;

/**
 * How opaque the screen's red flash starts when the Hero is hit (0..1), fading
 * out over `HURT_FLASH_MS`.
 */
const HURT_STRENGTH = 0.3;
const HURT_COLOUR = 0xff0000;

/**
 * The Hero's Death on screen: it darkens to `darkness` over `DEATH_STEPS`,
 * then shows "YOU TRIED" over a hint that pulses `pulsesPerSecond` times a
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
 * with the art's credit, the Quit to Start Screen button and a hint to
 * resume. Where things go is `PAUSE_MENU_LAYOUT`.
 */
const PAUSE_MENU = {
  darkness: 0.6,
  panel: { colour: 0x17130e, edge: 0x5a4a2e },
  title: { colour: 0xe8d27a, size: 40, top: 28 },
  credit: { colour: 0xd8d0b8, size: 15, top: 96, lineHeight: 22 },
  button: { size: 17 },
  question: { colour: 0xd8d0b8 },
  hint: { colour: 0x9a9080, size: 14, bottom: 26 },
};

/** The HUD's font, for the nameplate and damage numbers. */
const SERIF = "Georgia, serif";
/** How tall the Hero and the Minions stand in the 3D World, in tiles. */
const HERO_HEIGHT = 0.9;
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
 * The ring round the Life orb while the Hero has a Bone Ward: bone white
 * along the middle of its rim, `width` of the rim's width, running clockwise
 * from the top as far as the Bone Ward has left, over a faint `trackAlpha`
 * ring all the way round.
 */
const WARD_RING = { colour: 0xe8e0c8, width: 0.6, trackAlpha: 0.2 };
/**
 * The pulse over the Bone Ward ring when it soaks damage: a brighter bone
 * white ring `width` CSS px across at native scale (drawn at the UI Scale),
 * at `strength` opacity (0..1) as it begins. Its length is `WARD_PULSE.ms`.
 */
const WARD_PULSE_LOOK = { colour: 0xfffaf0, width: 6, strength: 0.8 };
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
  /** The faint outline in an empty slot, hinting at what it takes. */
  slotHint: 0x6a6050,
  slotHintAlpha: 0.55,
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
    /** A scroll: a page `w` by `h` with `lines` lines of text on it, `lineGap` apart. */
    quest: { w: 16, h: 20, lines: 3, lineGap: 5, inset: 3 },
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
 * How far from a Ground Item's model a click still picks it up (CSS px at
 * World zoom 1).
 */
const GROUND_ITEM_GRAB = 24;

/**
 * A Ground Item's name label: a dark back `labelAlpha` opaque, the name gold
 * while hovered (where the label goes and how big is `groundLabels`).
 */
const GROUND_ITEM = {
  label: 0x000000,
  labelAlpha: 0.7,
  /** The back of a hovered label, which keeps its Rarity colour. */
  hoveredAlpha: 0.95,
};

/**
 * The badge over the Life orb: its size and gap over the rim (CSS px at
 * native scale) and colours.
 */
const BADGE = { size: 13, gap: 4, combat: 0xd84a3a, regen: 0x9cd89c };

/**
 * What the renderer remembers of a Monster or Corpse the World drew: where
 * it stood, for damage numbers, and the milliseconds-long effects on it.
 */
type MonsterMark = {
  type: MonsterType;
  /** Where it stood when last drawn, in tile units. */
  at: Vec;
  diedAtMs: number | null;
  flashUntilMs: number;
};

/**
 * Draws the HUD, the panels and the maps over the 3D World into a Pixi
 * stage, and places what hangs over the World (damage numbers, Life bars,
 * Curse marks and Ground Item labels) through the 3D World's camera,
 * `cameraOf`, as last drawn. `areaDisplayNames` are what the Area Banner on
 * arriving in an Area shows, by Area name. Hints name the buttons of
 * `activeInput`, read as it is each frame, and the touch controls show while
 * it is touch, held as `touch` is each frame.
 */
export function createRenderer(
  app: Application,
  cameraOf: () => WorldCamera,
  areaDisplayNames: Readonly<Record<string, string>>,
  activeInput: Readonly<ActiveInput>,
  touch: Readonly<TouchControls>,
) {
  /** Where each character stood as last drawn, for picking. */
  let standing: Pickable3d<CharacterId>[] = [];
  let highlighted: CharacterId | null = null;
  /** Where the NPCs stood as last drawn, for picking. */
  let standingNpcs: Pickable3d<number>[] = [];
  // Over the 3D World, under the HUD, bottom to top: Ground Item labels,
  // damage numbers, then Life bars and Curse marks, which are scaled by the
  // World zoom.
  const labels3d = new Container();
  app.stage.addChild(labels3d);
  const numbers = new Container();
  app.stage.addChild(numbers);
  const overheads3d = new Container();
  app.stage.addChild(overheads3d);
  const overheads = new Graphics();
  overheads3d.addChild(overheads);

  // Filled by `showArea`.
  let area: Area | null = null;
  // Ground Items' name labels, always shown.
  const labelBacks = new Graphics();
  labels3d.addChild(labelBacks);
  const labelTexts = new Map<ItemId, Text>();
  /** Where each Ground Item's label was last drawn on the screen. */
  let labels: GroundLabel[] = [];
  /** Where each Ground Item was last drawn, on the screen (CSS px). */
  let lyingAt: { id: ItemId; at: Vec }[] = [];
  const floating: { text: Text; bornMs: number; at: Vec; lift: number }[] = [];
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
  // Under the HUD, over the World; the HUD and panels draw over it.
  const mapOverlay = mapOverlayView();
  app.stage.addChild(mapOverlay.layer);
  const orb = orbsView();
  app.stage.addChild(orb.layer);
  const skillBar = skillBarView(activeInput);
  app.stage.addChild(skillBar.layer);
  const beltStrip = beltStripView(activeInput);
  app.stage.addChild(beltStrip.layer);
  const panelButtons = panelButtonsView(activeInput);
  app.stage.addChild(panelButtons.layer);
  const miniMap = miniMapView(activeInput);
  app.stage.addChild(miniMap.layer);
  // Under the panels, which cover it where they meet; it takes no clicks.
  const minionFrame = minionFrameView();
  app.stage.addChild(minionFrame.layer);
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
  const vendorPanel = vendorPanelView(activeInput);
  app.stage.addChild(vendorPanel.layer);
  const skillTreePanel = skillTreePanelView(activeInput);
  app.stage.addChild(skillTreePanel.layer);
  const questPanel = questPanelView(activeInput);
  app.stage.addChild(questPanel.layer);
  const waypointList = waypointListView(activeInput, areaDisplayNames);
  app.stage.addChild(waypointList.layer);
  const dialoguePanel = dialoguePanelView(activeInput);
  app.stage.addChild(dialoguePanel.layer);
  // The Focus's ring, over the panel it is in.
  const focusRing = new Graphics();
  app.stage.addChild(focusRing);
  // Over the panels, so a hovered Panel button's tooltip is never hidden.
  app.stage.addChild(panelButtons.tooltipLayer);
  app.stage.addChild(miniMap.tooltipLayer);
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
  // The same, for completing an Act: bigger, and lower.
  const actBanner = new Text({
    text: "",
    style: { fill: BANNER_COLOUR, fontFamily: SERIF },
  });
  actBanner.anchor.set(0.5);
  actBanner.visible = false;
  app.stage.addChild(actBanner);
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
  // The Start Screen's name and choices, over a World without a HUD.
  const start = startScreenView(activeInput);
  app.stage.addChild(start.layer);
  // Instead of the game, over everything.
  const notice = rotateNoticeView(activeInput);
  app.stage.addChild(notice.layer);

  /**
   * Everything the HUD and the World's overlays draw, which the Start
   * Screen hides: the stage's layers under the pause menu, the Start Screen
   * and the Rotate Notice.
   */
  const hudLayers = app.stage.children.filter(
    (layer) =>
      layer !== menu.layer && layer !== start.layer && layer !== notice.layer,
  );
  /** Whether `hudLayers` were hidden for the Start Screen. */
  let hudHidden = false;
  /** Hides the HUD, the World's overlays and the pause menu. */
  const hideHud = () => {
    hudHidden = true;
    for (const layer of hudLayers) layer.visible = false;
    menu.layer.visible = false;
  };

  /** Living Monsters and Corpses by id. */
  const monsters = new Map<MonsterId, MonsterMark>();
  /** Where the Hero and each living Minion stood as last drawn (tile units). */
  let heroTile: Vec = { x: 0, y: 0 };
  const minionTiles = new Map<MinionId, Vec>();
  /** Each living Minion as last drawn, for it to crumble where it stood. */
  const minionLooks = new Map<
    MinionId,
    { type: MinionType; pos: Vec; facing: number }
  >();
  /** The Minions crumbling away, with when each left the World. */
  const departing: (Omit<DepartedMinion, "ageMs"> & { atMs: number })[] = [];
  let hurtAtMs: number | null = null;
  // When each Minion's bar in the Minion Frame was last hit.
  const minionFlashedAtMs = new Map<MinionId, number>();
  let levelAtMs: number | null = null;
  /** When the Hero's Town Portal last opened, for its burst. */
  let townPortalOpenedAtMs: number | null = null;
  /** Town Portal ends shrinking away, each in its Area from when it closed. */
  const closingTownPortals: { area: string; pos: Vec; atMs: number }[] = [];
  /** The Town Portal ends to draw in the active Area at `nowMs`. */
  const portalsShown = (world: World, nowMs: number) =>
    shownTownPortals({
      end: townPortalIn(world),
      openedAtMs: townPortalOpenedAtMs,
      closing: closingTownPortals,
      area: world.areaName,
      nowMs,
    });
  /** Corpses bursting in the active Area, each over its radius (tiles). */
  const bursts: { pos: Vec; radius: number; atMs: number }[] = [];
  /** Curses cast in the active Area, each over its radius (tiles). */
  const curses: {
    skill: Skill;
    pos: Vec;
    radius: number;
    atMs: number;
  }[] = [];
  /** When the Hero last arrived in an Area, for the Area Banner. */
  let arrivedAtMs: number | null = null;
  /** Starts the Area Banner showing `displayName`, as of `nowMs`. */
  const showBanner = (displayName: string, nowMs: number) => {
    banner.text = displayName;
    arrivedAtMs = nowMs;
  };
  /** When the Hero last completed an Act, for the Act Complete banner. */
  let actCompletedAtMs: number | null = null;
  /** The World last drawn; a New Hero brings another. */
  let drawnWorld: World | null = null;
  /** Which panels were open, and the Pending Attribute Points, when last drawn. */
  let shownPanels: ShownPanels = {
    mapOpen: false,
    heroPanelOpen: false,
    inventoryOpen: false,
    skillTreeOpen: false,
    questOpen: false,
    waypointsOpen: false,
    dialogueOpen: false,
    vendorOpen: false,
    dialogueNpc: 0,
    dialoguePage: 0,
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

  /** Drops what was in the air in the Area left behind. */
  const showArea = (next: Area) => {
    area = next;
    for (const { text } of floating.splice(0)) text.destroy();
    bursts.length = 0;
    curses.length = 0;
  };

  /**
   * Starts afresh for another World, whose Monster ids start over: drops
   * every Monster mark and the Hero's hurt and level-up effects, and shows
   * its Area.
   */
  const showWorld = (next: World) => {
    drawnWorld = next;
    monsters.clear();
    // Minion ids start over too.
    minionTiles.clear();
    minionLooks.clear();
    minionFlashedAtMs.clear();
    departing.length = 0;
    // Item ids start over too.
    for (const text of labelTexts.values()) text.destroy();
    labelTexts.clear();
    hurtAtMs = levelAtMs = null;
    townPortalOpenedAtMs = null;
    closingTownPortals.length = 0;
    showArea(next.areas[next.areaName]);
  };

  /**
   * The living Monster or Minion drawn under a point on the canvas (CSS
   * px), as last drawn: the one in front where they overlap.
   */
  const characterAt = (screen: Vec): CharacterId | null =>
    characterUnder3d(cameraOf(), standing, screen);

  /**
   * The Monster drawn under a point on the canvas (CSS px), as last drawn;
   * none where a Minion stands in front, so a click there is a move.
   */
  const monsterAt = (screen: Vec): MonsterId | null => {
    const id = characterAt(screen);
    return typeof id === "number" ? id : null;
  };

  /**
   * The NPC (index in the Area's `npcs`) drawn under a point on the canvas
   * (CSS px), as last drawn.
   */
  const npcAt = (screen: Vec): number | null =>
    characterUnder3d(cameraOf(), standingNpcs, screen);

  /** The Ground Item whose label is under a canvas point (CSS px). */
  const groundLabelUnder = (screen: Vec): ItemId | null =>
    groundItemLabelAt(labels, screen);

  /** The Ground Item drawn on the floor under a canvas point (CSS px). */
  const groundItemAt = (screen: Vec): ItemId | null =>
    groundItemUnder(lyingAt, screen, GROUND_ITEM_GRAB * cameraOf().zoom);

  /**
   * Draws each Ground Item's name label over where its model is on the
   * screen, gold for `hovered`, and drops the labels of Items no longer
   * lying there.
   */
  const drawGroundItems = (
    world: World,
    hovered: ItemId | null,
    uiScale: number,
  ) => {
    const lying = groundItemsOf(world);
    labelBacks.clear();
    const spots = groundSpotsOf(
      cameraOf(),
      lying.map(({ item, pos }) => ({ id: item.id, type: item.type, pos })),
    );
    const piles = world.goldPiles.map(({ id, amount, pos }) => ({
      id: goldLabelId(id),
      amount,
      pos,
    }));
    const pileSpots = groundSpotsOf(cameraOf(), piles);
    const labelled = [
      ...lying.map(({ item }, i) => ({
        id: item.id,
        name: itemTitle(item),
        at: spots[i].at,
      })),
      ...piles.map(({ id, amount }, i) => ({
        id,
        name: goldPileLabel(amount),
        at: pileSpots[i].at,
      })),
    ];
    const sized = labelled.map(({ id, name, at }) => {
      let text = labelTexts.get(id);
      if (!text) {
        text = new Text({ text: name, style: { fontFamily: SERIF } });
        text.anchor.set(0.5, 0.5);
        labelTexts.set(id, text);
        labels3d.addChild(text);
      }
      sizeText(text, GROUND_LABEL.textSize * uiScale);
      const width = text.width + 2 * GROUND_LABEL.padding * uiScale;
      return { id, at, width };
    });
    // Labels are laid out on the screen, at the UI Scale.
    labels = groundLabels(sized, uiScale);
    const rarityOf = new Map(lying.map(({ item }) => [item.id, item.rarity]));
    // A Gold Pile is never grabbed by a click: only Items are looked for.
    lyingAt = sized
      .filter(({ id }) => id > 0)
      .map(({ id, at }) => ({ id, at }));
    for (const { id, rect } of labels) {
      labelBacks.rect(rect.x, rect.y, rect.w, rect.h).fill({
        color: GROUND_ITEM.label,
        alpha:
          id === hovered ? GROUND_ITEM.hoveredAlpha : GROUND_ITEM.labelAlpha,
      });
      const text = labelTexts.get(id);
      if (!text) continue;
      text.style.fill =
        id < 0 ? GOLD_COLOUR : rarityColour(rarityOf.get(id) ?? "normal");
      text.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    for (const [id, text] of labelTexts) {
      if (sized.some((shown) => shown.id === id)) continue;
      text.destroy();
      labelTexts.delete(id);
    }
  };

  return {
    /**
     * What the 3D World shows that lasts milliseconds: each hit Monster's
     * flash, how long ago each killed Monster died, the Town Portal ends,
     * and the Corpse bursts, Curses, Level Up ring and crumbling Minions,
     * which are dropped here once they are over.
     */
    effectsAt(nowMs: number, world: World): Effects {
      const flashes = new Map<MonsterId, number>();
      const deadForMs = new Map<MonsterId, number>();
      for (const [id, mark] of monsters) {
        const left = (mark.flashUntilMs - nowMs) / FLASH_MS;
        if (left > 0) flashes.set(id, FLASH_STRENGTH * left);
        if (mark.diedAtMs !== null) deadForMs.set(id, nowMs - mark.diedAtMs);
      }
      const portals = portalsShown(world, nowMs);
      for (let i = closingTownPortals.length - 1; i >= 0; i--) {
        if (townPortalCloseScale(nowMs - closingTownPortals[i].atMs) === 0) {
          closingTownPortals.splice(i, 1);
        }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const { radius, atMs } = bursts[i];
        if (!corpseBurst(nowMs - atMs, radius)) bursts.splice(i, 1);
      }
      for (let i = curses.length - 1; i >= 0; i--) {
        const { radius, atMs } = curses[i];
        if (!curseCircle(nowMs - atMs, radius)) curses.splice(i, 1);
      }
      const ageOf = ({ pos, radius, atMs }: (typeof bursts)[number]) => ({
        pos,
        radius,
        ageMs: nowMs - atMs,
      });
      for (let i = departing.length - 1; i >= 0; i--) {
        if ((nowMs - departing[i].atMs) / 1000 >= CRUMBLE_SECONDS) {
          departing.splice(i, 1);
        }
      }
      return {
        flashes,
        deadForMs,
        portals,
        bursts: bursts.map(ageOf),
        curses: curses.map((curse) => ({
          ...ageOf(curse),
          skill: curse.skill,
        })),
        levelUpAgoMs: levelAtMs === null ? null : nowMs - levelAtMs,
        departedMinions: departing.map(({ atMs, ...minion }) => ({
          ...minion,
          ageMs: nowMs - atMs,
        })),
      };
    },

    /**
     * The Monster or Minion outlined as hovered, or as the auto-aim Target
     * with the pointer over no one, as last drawn.
     */
    highlightedCharacter(): CharacterId | null {
      return highlighted;
    },

    monsterAt,
    npcAt,
    groundLabelAt: groundLabelUnder,
    groundItemAt,

    panelAt,

    /**
     * The pause-menu button under a click on the canvas (CSS px), or null
     * off them all; the Fullscreen button only where `fullscreen` says it's
     * allowed.
     */
    menuChoiceAt(screen: Vec, fullscreen: Fullscreen): MenuChoice | null {
      return menuChoiceAt(
        viewportOf(app.screen),
        screen,
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

    /**
     * The Start Screen button under a click on the canvas (CSS px), or
     * null off them all.
     */
    startChoiceAt(
      point: Vec,
      startScreen: StartScreen,
      fullscreen: Fullscreen,
    ): MenuChoice | null {
      return startChoiceAt(
        viewportOf(app.screen),
        point,
        startScreen,
        activeInput.way,
        fullscreen,
      );
    },

    /**
     * Draws the Start Screen's name and choices over the 3D World, with the
     * HUD, the Area Banner and every overlay hidden. `level` is the Level of
     * the Hero a New Hero would give up.
     */
    drawStart(
      startScreen: StartScreen,
      level: number,
      fullscreen: Fullscreen,
      focus: MenuChoice | null,
    ) {
      hideHud();
      const viewport = viewportOf(app.screen);
      // Only a controller picks with the focus.
      start.draw(
        viewport,
        startScreen,
        level,
        fullscreen,
        activeInput.way === "controller" ? focus : null,
      );
      notice.draw(viewport, fullscreen);
    },

    /**
     * Draws only the Rotate Notice, over the failed Loading Screen's place
     * before any World shows.
     */
    drawRotateNoticeOnly(fullscreen: Fullscreen) {
      hideHud();
      start.layer.visible = false;
      notice.draw(viewportOf(app.screen), fullscreen);
    },

    /** Turns a step's events into effects. */
    react(events: readonly SimEvent[], nowMs: number) {
      const arrivedIn = arrivedInDisplayName(events, areaDisplayNames);
      if (arrivedIn !== null) showBanner(arrivedIn, nowMs);
      const completed = actCompletedText(events);
      if (completed !== null) {
        actBanner.text = completed;
        actCompletedAtMs = nowMs;
      }
      for (const number of damageNumbers(events)) {
        // Over the character as last drawn, the tile it stood on.
        const mark =
          typeof number.on === "number" ? monsters.get(number.on) : null;
        const at =
          number.on === "hero"
            ? heroTile
            : typeof number.on === "number"
              ? mark?.at
              : minionTiles.get(number.on.minion);
        if (!at) continue;
        const text = new Text({
          text: floatText(number),
          style: { fill: numberColour(number), fontFamily: SERIF },
        });
        text.anchor.set(0.5, 1);
        numbers.addChild(text);
        const height = mark ? MONSTER_LOOKS[mark.type].height : HERO_HEIGHT;
        floating.push({ text, bornMs: nowMs, at, lift: height + 0.15 });
      }
      // Red only when Life was lost; the Bone Ward ring pulses when it soaked.
      const shown = heroHitShows(events);
      if (shown.hurt) hurtAtMs = nowMs;
      if (shown.pulses) orb.startPulse(nowMs);
      for (const id of minionsFlashed(events)) minionFlashedAtMs.set(id, nowMs);
      for (const event of events) {
        if (event.type === "HitLanded") {
          const mark = monsters.get(event.target);
          if (mark) mark.flashUntilMs = nowMs + FLASH_MS;
        }
        if (event.type === "MonsterDied") {
          const mark = monsters.get(event.id);
          if (mark) mark.diedAtMs = nowMs;
        }
        if (event.type === "MinionCrumbled" || event.type === "MinionDied") {
          minionTiles.delete(event.minion);
          const look = minionLooks.get(event.minion);
          if (look) {
            departing.push({
              id: event.minion,
              ...look,
              pos: event.pos,
              atMs: nowMs,
            });
          }
          minionLooks.delete(event.minion);
        }
        if (event.type === "LevelReached") levelAtMs = nowMs;
        if (event.type === "TownPortalOpened") townPortalOpenedAtMs = nowMs;
        if (event.type === "CorpseExploded") {
          bursts.push({ pos: event.pos, radius: event.radius, atMs: nowMs });
        }
        if (event.type === "CurseCast") {
          curses.push({
            skill: event.skill,
            pos: event.pos,
            radius: event.radius,
            atMs: nowMs,
          });
        }
        if (event.type === "TownPortalClosed") {
          closingTownPortals.push({
            area: event.area,
            pos: event.pos,
            atMs: nowMs,
          });
        }
      }
    },

    /**
     * `alpha` (0..1) is how far the frame is from the previous step to the
     * current one; `pointer` is the cursor on the canvas (CSS px), if on it,
     * which names what it's over in the World, or off a panel, shows the
     * tooltip of the Item it's over on one. `menus` shows the Hero and
     * Inventory panels while they're open, and the pause menu over
     * everything while paused. `heldSkill` is the Held Skill, if any, drawn
     * at the pointer, and `heldSkillSlot` the Skill Bar slot it was picked
     * up from, drawn dimmed. `target` is the Target auto-aim picked, if any,
     * named as a hovered Monster is when the pointer is over no one. `focus`
     * is where the Focus rests in an open panel, if it shows, ringed as the
     * pause menu's focused button is.
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
      if (hudHidden) {
        // Play after the Start Screen: each view sets its own layer's
        // visibility as it draws, below.
        hudHidden = false;
        for (const layer of hudLayers) layer.visible = true;
        start.layer.visible = false;
      }
      const active = world.areas[world.areaName];
      // Read afresh each frame, so a resized window re-lays the HUD at once.
      const viewport = viewportOf(app.screen);
      const { uiScale } = viewport;
      shownPanels = {
        mapOpen: menus.mapOpen,
        heroPanelOpen: menus.heroPanelOpen,
        inventoryOpen: menus.inventoryOpen,
        skillTreeOpen: menus.skillTreeOpen,
        questOpen: menus.questOpen,
        waypointsOpen: menus.waypointsOpen,
        dialogueOpen: menus.dialogueOpen,
        vendorOpen: menus.vendorOpen,
        dialogueNpc: menus.dialogueNpc,
        dialoguePage: menus.dialoguePage,
        pendingPoints: { ...menus.pendingPoints },
      };
      if (world !== drawnWorld) {
        showWorld(world);
        // A new World starts the Hero in an Area: they've arrived there.
        showBanner(areaDisplayNames[world.areaName], nowMs);
      } else if (active !== area) showArea(active);
      const heroAt = lerp(world.hero.prevPos, world.hero.pos, alpha);
      heroTile = heroAt;
      const { resolution } = app.renderer;
      const snapOnScreen = (value: number) =>
        Math.round(value * resolution) / resolution;

      // Where each character stands, for damage numbers, with the marks of
      // the effects on them.
      const seen = new Set<MonsterId>();
      const markOf = (id: MonsterId, type: MonsterType): MonsterMark => {
        let mark = monsters.get(id);
        if (!mark) {
          mark = { type, at: heroAt, diedAtMs: null, flashUntilMs: 0 };
          monsters.set(id, mark);
        }
        seen.add(id);
        return mark;
      };
      for (const monster of world.monsters) {
        markOf(monster.id, monster.type).at = lerp(
          monster.prevPos,
          monster.pos,
          alpha,
        );
      }
      for (const corpse of world.corpses) {
        const mark = markOf(corpse.id, corpse.type);
        mark.at = corpse.pos;
        // Already dead when first drawn: lying still.
        mark.diedAtMs ??= -Infinity;
      }
      for (const id of [...monsters.keys()]) {
        if (!seen.has(id)) monsters.delete(id);
      }
      minionTiles.clear();
      minionLooks.clear();
      for (const minion of world.minions) {
        const at = lerp(minion.prevPos, minion.pos, alpha);
        minionTiles.set(minion.id, at);
        minionLooks.set(minion.id, {
          type: minion.type,
          pos: at,
          facing: minion.facing,
        });
      }

      overheads.clear();
      const camera = cameraOf();
      overheads3d.scale.set(camera.zoom);
      standing = pickablesOf(world, alpha);
      standingNpcs = npcPickablesOf(world);
      /** Where the top of a Monster's Life bar goes, in the space it's drawn in. */
      const barAnchor = (monster: Monster): Vec => {
        const head = tileToScreen(
          camera,
          lerp(monster.prevPos, monster.pos, alpha),
          MONSTER_LOOKS[monster.type].height,
        );
        return {
          x: head.x / camera.zoom,
          y: head.y / camera.zoom - MONSTER_BAR.above - MONSTER_BAR.height,
        };
      };
      const markAlpha = curseMarkAlpha(nowMs);
      for (const monster of world.monsters) {
        if (!monster.curse) continue;
        const anchor = barAnchor(monster);
        curseMark(
          overheads,
          anchor.x,
          anchor.y,
          markAlpha,
          curseLook(monster.curse.skill),
        );
      }
      // A mark over each NPC with a Quest to give or take back.
      for (const npc of npcsIn(world)) {
        if (!hasQuestToDeal(world, npc.id)) continue;
        const head = tileToScreen(camera, npc.pos, NPC_LOOKS[npc.name].height);
        questMark(
          overheads,
          head.x / camera.zoom,
          head.y / camera.zoom - QUEST_MARK.lift - questMarkBob(nowMs),
        );
      }
      for (const monster of world.monsters) {
        const life = monsterMaxLife(monster);
        if (monster.life >= life) continue;
        const anchor = barAnchor(monster);
        lifeBar(overheads, {
          x: anchor.x - MONSTER_BAR.width / 2,
          y: anchor.y,
          width: MONSTER_BAR.width,
          height: MONSTER_BAR.height,
          fraction: monster.life / life,
        });
      }

      for (let i = floating.length - 1; i >= 0; i--) {
        const { text, bornMs, at, lift } = floating[i];
        const float = floatAt(nowMs - bornMs, uiScale);
        if (!float) {
          text.destroy();
          floating.splice(i, 1);
          continue;
        }
        const sizes = atUiScale(DAMAGE_NUMBER, uiScale);
        sizeText(text, sizes.size, sizes.stroke);
        const over = tileToScreen(camera, at, lift);
        text.position.set(
          snapOnScreen(over.x),
          snapOnScreen(over.y - sizes.gap - float.rise),
        );
        text.alpha = float.alpha;
      }

      // No nameplate under a panel.
      const onPanel = pointer && panelAt(pointer);
      const overWorld = onPanel ? null : pointer;
      // What a click there picks: a label over a Monster, a Monster over an
      // Item lying under it.
      const hoveredLabel = overWorld && groundLabelUnder(overWorld);
      const hoveredId = overWorld && !hoveredLabel && characterAt(overWorld);
      const hoveredItem =
        hoveredLabel ||
        (overWorld && typeof hoveredId !== "number"
          ? groundItemAt(overWorld)
          : null);
      drawGroundItems(world, hoveredItem, uiScale);
      // With the pointer over no one, the Target is shown as if hovered.
      const pointed =
        typeof hoveredId === "number" || typeof hoveredId === "object"
          ? hoveredId
          : null;
      const hovered = hoveredOf(world, pointed, target);
      highlighted = hovered
        ? "monster" in hovered
          ? hovered.monster.id
          : { minion: hovered.minion.id }
        : null;
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

      // One input for both maps, made once a frame.
      const mapInputs: MapInputs = {
        area: active,
        explored: world.explored,
        heroAt,
        minions: world.minions.map((minion) =>
          lerp(minion.prevPos, minion.pos, alpha),
        ),
        townPortal: townPortalIn(world),
        npcs: npcsIn(world),
        boneAltars: world.boneAltars.map(({ pos }) => pos),
        displayNames: areaDisplayNames,
      };
      mapOverlay.draw(viewport, mapInputs, menus.mapOpen);
      orb.draw(viewport, world, nowMs);
      skillBar.draw(viewport, world, heldSkillSlot);
      beltStrip.draw(viewport, world);
      panelButtons.draw(
        viewport,
        menus,
        { heroDead: world.death !== null, inTown: inTown(world) },
        hoveredPanelButton(onPanel),
      );
      miniMap.draw(
        viewport,
        mapInputs,
        miniMapShown(menus, world.death !== null),
        onPanel !== null &&
          "button" in onPanel &&
          onPanel.button?.type === "miniMap",
      );
      // Only Minions still alive keep a flash.
      for (const id of minionFlashedAtMs.keys()) {
        if (!world.minions.some((minion) => minion.id === id)) {
          minionFlashedAtMs.delete(id);
        }
      }
      minionFrame.draw(viewport, world, minionFlashedAtMs, nowMs);
      experience.draw(viewport, world);
      levelUp.draw(viewport, world, nowMs);
      touchControls.draw(viewport, world, menus);
      heroPanel.draw(viewport, world, menus.heroPanelOpen, menus.pendingPoints);
      // The focused or long-pressed Skill shows its tooltip; the mouse's
      // pointer, as before, none, and nor does a Held Skill.
      const touching = activeInput.way === "touch";
      const skillTooltipAt = (focus || touching) && !heldSkill ? pointer : null;
      skillTreePanel.draw(viewport, world, menus.skillTreeOpen, skillTooltipAt);
      questPanel.draw(viewport, world, menus.questOpen);
      waypointList.draw(viewport, world, menus.waypointsOpen);
      dialoguePanel.draw(
        viewport,
        world,
        menus.dialogueOpen,
        menus.dialogueNpc,
        menus.dialoguePage,
      );
      heldSkillView.draw(heldSkill, pointer, uiScale);
      const spot = onPanel && "inventory" in onPanel ? onPanel.inventory : null;
      // The Held Item over the Vendor panel is drawn at its cells' size.
      inventoryPanel.draw(
        viewport,
        world,
        menus.inventoryOpen,
        spot,
        pointer,
        menus.vendorOpen ? vendorPanelLayout(viewport).cell : null,
      );
      vendorPanel.draw(
        viewport,
        world,
        menus.vendorOpen,
        onPanel && "vendor" in onPanel ? onPanel.vendor : undefined,
        pointer,
      );
      focusRing.clear();
      if (focus) {
        const { colour, width } = FOCUS_RING;
        focusRing
          .rect(focus.x, focus.y, focus.w, focus.h)
          .stroke({ color: colour, width: width * uiScale });
      }

      const hurtLeft = hurtAtMs === null ? 0 : hurtFlashLeft(nowMs - hurtAtMs);
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

      const actAlpha =
        actCompletedAtMs === null
          ? null
          : actCompleteOpacityAt(nowMs - actCompletedAtMs);
      actBanner.visible = actAlpha !== null;
      if (actAlpha !== null) {
        const layout = actCompleteLayout(viewport);
        actBanner.alpha = actAlpha;
        sizeText(actBanner, layout.size, layout.stroke);
        actBanner.position.set(layout.at.x, layout.at.y);
      } else actCompletedAtMs = null;

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
        // Only a controller picks with the menu's focus.
        activeInput.way === "controller" ? menus.menuFocus : null,
        menus.fullscreen,
      );
      notice.draw(viewport, menus.fullscreen);
    },
  };
}

/**
 * The mark over an NPC with a Quest: an exclamation mark centred on `x`, its
 * foot at `bottom`.
 */
function questMark(graphics: Graphics, x: number, bottom: number) {
  const { colour, outline, outlineWidth, barWidth, barHeight, dot, gap } =
    QUEST_MARK;
  const dotTop = bottom - dot;
  graphics
    .roundRect(x - dot / 2, dotTop, dot, dot, dot / 2)
    .fill(colour)
    .stroke({ color: outline, width: outlineWidth });
  graphics
    .roundRect(
      x - barWidth / 2,
      dotTop - gap - barHeight,
      barWidth,
      barHeight,
      barWidth / 2,
    )
    .fill(colour)
    .stroke({ color: outline, width: outlineWidth });
}

/** The outline of a plus centred on (`x`, `y`) reaching `half` each way. */
function crossPoints(x: number, y: number, half: number): number[] {
  const arm = half / 3;
  return [
    x - arm,
    y - half,
    x + arm,
    y - half,
    x + arm,
    y - arm,
    x + half,
    y - arm,
    x + half,
    y + arm,
    x + arm,
    y + arm,
    x + arm,
    y + half,
    x - arm,
    y + half,
    x - arm,
    y + arm,
    x - half,
    y + arm,
    x - half,
    y - arm,
    x - arm,
    y - arm,
  ];
}

/**
 * The mark over a Cursed Monster, in its Curse's `look`: centred on `x`, its
 * foot `gap` above `lifeBarTop`, where its Life bar's top is or would be.
 */
function curseMark(
  graphics: Graphics,
  x: number,
  lifeBarTop: number,
  alpha: number,
  look: CurseLook,
) {
  const { size, gap, outline, outlineWidth } = CURSE_MARK;
  const colour = look.mark;
  const half = size / 2;
  const bottom = lifeBarTop - gap;
  const shape =
    look.shape === "triangle"
      ? [x - half, bottom - size, x + half, bottom - size, x, bottom]
      : look.shape === "cross"
        ? crossPoints(x, bottom - half, half)
        : look.shape === "square"
          ? [
              x - half,
              bottom - size,
              x + half,
              bottom - size,
              x + half,
              bottom,
              x - half,
              bottom,
            ]
          : [
              x,
              bottom - size,
              x + half,
              bottom - half,
              x,
              bottom,
              x - half,
              bottom - half,
            ];
  graphics
    .poly(shape)
    .fill({ color: colour, alpha })
    .stroke({ color: outline, width: outlineWidth, alpha });
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
 * The stone strip along the bottom of the screen, with the Hero's Life orb
 * on it at the left and their Mana orb at the right, each filling from the
 * bottom. In Combat their surfaces ripple harder, with an "⚔ In Combat" badge
 * over the Life orb; while Life regenerates, bubbles rise through it under a
 * badge with the rate. A ring round the Life orb shows what is left of the
 * Hero's Bone Ward.
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
  // When the Bone Ward ring's last pulse began, if it still shows.
  let pulseAtMs: number | null = null;

  return {
    layer,
    /** Starts the Bone Ward ring's pulse, as the Bone Ward soaks damage. */
    startPulse(nowMs: number) {
      pulseAtMs = nowMs;
    },
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

      const ward = wardFill(world);
      // No Bone Ward left (used up, Death, a loaded Save) leaves no pulse to
      // show on a Bone Ward cast later.
      if (ward === null) pulseAtMs = null;
      if (ward !== null) {
        const ringRadius = r + rim / 2;
        const ring = { width: rim * WARD_RING.width, color: WARD_RING.colour };
        graphics
          .circle(lifeX, cy, ringRadius)
          .stroke({ ...ring, alpha: WARD_RING.trackAlpha });
        const top = -Math.PI / 2;
        graphics
          .moveTo(lifeX, cy - ringRadius)
          .arc(lifeX, cy, ringRadius, top, top + ward * Math.PI * 2)
          .stroke(ring);
        // A soaked hit lays a bright bone-white ring over the whole ring,
        // which fades away.
        const glow =
          pulseAtMs === null
            ? 0
            : wardPulseBrightness(nowMs - pulseAtMs) * WARD_PULSE_LOOK.strength;
        if (glow > 0) {
          graphics.circle(lifeX, cy, ringRadius).stroke({
            width: WARD_PULSE_LOOK.width * uiScale,
            color: WARD_PULSE_LOOK.colour,
            alpha: glow,
          });
        }
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
      layer.visible = touchControlsShown(
        activeInput.way,
        menus,
        world.death !== null,
      );
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
  if (panel === "quest") {
    const { w, h, lines, lineGap, inset } = atUiScale(icon.quest, scale);
    graphics.rect(x - w / 2, y - h / 2, w, h).stroke(line);
    for (let i = 0; i < lines; i += 1) {
      const lineY = y - h / 2 + inset * 2 + i * lineGap;
      graphics
        .moveTo(x - w / 2 + inset, lineY)
        .lineTo(x + w / 2 - inset, lineY)
        .stroke(line);
    }
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
 * What the Map Overlay and the Mini Map draw: the Area's wall and floor
 * lines and its marks, centred on a point of the screen with the Hero's mark
 * on it, and the Exits' and NPCs' names too when `withNames`. The lines are
 * drawn again whenever more of the Area is Explored or the scale changes,
 * and moved as the Hero walks.
 */
function mapView(withNames: boolean) {
  const layer = new Container();
  const lines = new Graphics();
  const marks = new Graphics();
  const heroMark = new Graphics();
  const names = new Container();
  names.visible = withNames;
  layer.addChild(lines, marks, heroMark, names);
  let drawn: { area: Area; seen: number; scale: number } | null = null;
  /** The names in use, grown as needed: Exits' and NPCs'. */
  const nameTexts: Text[] = [];
  const nameText = (index: number) => {
    if (!nameTexts[index]) {
      nameTexts[index] = new Text({ text: "", style: { fontFamily: SERIF } });
      names.addChild(nameTexts[index]);
    }
    return nameTexts[index];
  };

  return {
    layer,
    /**
     * Draws `inputs` centred on `centre`, a tile taking `scale` of the
     * World's size, the marks at the UI Scale `uiScale`.
     */
    draw(centre: Vec, inputs: MapInputs, scale: number, uiScale: number) {
      const { heroAt } = inputs;
      const found = mapMarks(inputs);
      // Tiles are only ever added to what is Explored, so a count tells.
      const seen = inputs.explored.filter(Boolean).length;
      if (
        drawn?.area !== inputs.area ||
        drawn.seen !== seen ||
        drawn.scale !== scale
      ) {
        drawn = { area: inputs.area, seen, scale };
        lines.clear();
        const origin = { x: 0, y: 0 };
        // Water is filled first, so the lines draw over it.
        for (const tile of found.water) {
          const corners = cornersOf(tile).map((corner) =>
            mapOffset(corner, origin, scale),
          );
          lines.poly(corners.flatMap(({ x, y }) => [x, y]));
        }
        lines.fill({
          color: MAP_LOOK.water.colour,
          alpha: MAP_LOOK.water.alpha,
        });
        for (const kind of ["floor", "wall"] as const) {
          const look = MAP_LOOK[kind];
          for (const edge of found.edges) {
            if (edge.kind !== kind) continue;
            const from = mapOffset(edge.from, origin, scale);
            const to = mapOffset(edge.to, origin, scale);
            lines.moveTo(from.x, from.y).lineTo(to.x, to.y);
          }
          lines.stroke({ color: look.colour, width: look.width * uiScale });
        }
      }
      const shift = mapOffset(heroAt, { x: 0, y: 0 }, scale);
      lines.position.set(centre.x - shift.x, centre.y - shift.y);
      /** Where a point of the Area is on screen. */
      const onScreen = (tile: Vec) => {
        const offset = mapOffset(tile, heroAt, scale);
        return { x: centre.x + offset.x, y: centre.y + offset.y };
      };

      marks.clear();
      const { exit, townPortal: portal, minion } = MAP_LOOK;
      for (const { at } of found.exits) {
        const point = onScreen(at);
        const halfWidth = (exit.width / 2) * uiScale;
        const halfHeight = (exit.height / 2) * uiScale;
        marks
          .poly([
            point.x - halfWidth,
            point.y,
            point.x,
            point.y - halfHeight,
            point.x + halfWidth,
            point.y,
            point.x,
            point.y + halfHeight,
          ])
          .fill(exit.colour);
      }
      if (found.townPortal) {
        const point = onScreen(found.townPortal);
        marks
          .ellipse(
            point.x,
            point.y,
            (portal.width / 2) * uiScale,
            (portal.height / 2) * uiScale,
          )
          .stroke({ color: portal.colour, width: portal.ringWidth * uiScale })
          .circle(point.x, point.y, portal.dot * uiScale)
          .fill(portal.colour);
      }
      if (found.waypoint) {
        const point = onScreen(found.waypoint);
        const { waypoint } = MAP_LOOK;
        const halfWidth = (waypoint.diamond + 1) * uiScale;
        marks
          .ellipse(
            point.x,
            point.y,
            (waypoint.width / 2) * uiScale,
            (waypoint.height / 2) * uiScale,
          )
          .stroke({
            color: waypoint.colour,
            width: waypoint.ringWidth * uiScale,
          })
          .poly([
            point.x - halfWidth,
            point.y,
            point.x,
            point.y - waypoint.diamond * uiScale,
            point.x + halfWidth,
            point.y,
            point.x,
            point.y + waypoint.diamond * uiScale,
          ])
          .fill(waypoint.colour);
      }
      for (const at of found.boneAltars) {
        const point = onScreen(at);
        const half = (MAP_LOOK.boneAltar.size / 2) * uiScale;
        marks
          .rect(point.x - half, point.y - half, 2 * half, 2 * half)
          .fill(MAP_LOOK.boneAltar.colour);
      }
      for (const at of found.minions) {
        const point = onScreen(at);
        marks
          .circle(point.x, point.y, minion.radius * uiScale)
          .fill(minion.colour);
      }

      // Names: the Exits' above their diamonds, the NPCs' on the NPC.
      const labels = withNames
        ? [
            ...found.exits.map(({ at, name }) => ({
              name,
              point: onScreen(at),
              look: exit,
              bold: false,
              above: (exit.height / 2 + exit.nameGap) * uiScale,
            })),
            ...found.npcs.map(({ at, name }) => ({
              name,
              point: onScreen(at),
              look: MAP_LOOK.npc,
              bold: true,
              above: null,
            })),
          ]
        : [];
      labels.forEach((label, index) => {
        const text = nameText(index);
        text.text = label.name;
        text.style.fill = label.look.nameColour;
        text.style.fontWeight = label.bold ? "bold" : "normal";
        text.style.fontSize = label.look.nameSize * uiScale;
        // An Exit's name sits above its diamond, an NPC's on the NPC.
        text.anchor.set(0.5, label.above === null ? 0.5 : 1);
        text.position.set(label.point.x, label.point.y - (label.above ?? 0));
        text.visible = true;
      });
      for (let index = labels.length; index < nameTexts.length; index++) {
        nameTexts[index].visible = false;
      }

      const { colour, size, width } = MAP_LOOK.hero;
      const reach = (size / 2) * uiScale;
      heroMark.clear();
      heroMark
        .moveTo(centre.x - reach, centre.y)
        .lineTo(centre.x + reach, centre.y)
        .moveTo(centre.x, centre.y - reach)
        .lineTo(centre.x, centre.y + reach)
        .stroke({ color: colour, width: width * uiScale });
    },
  };
}

/**
 * The Map Overlay: the whole screen's map, see through, centred on the Hero,
 * with the Area's display name at the top right.
 */
function mapOverlayView() {
  const map = mapView(true);
  const layer = new Container();
  layer.alpha = MAP_OVERLAY.opacity;
  layer.visible = false;
  const areaName = new Text({
    text: "",
    style: { fill: MAP_LOOK.areaName.colour, fontFamily: SERIF },
  });
  areaName.anchor.set(1, 0);
  layer.addChild(map.layer, areaName);

  return {
    layer,
    draw(screen: Viewport, inputs: MapInputs, open: boolean) {
      layer.visible = open;
      if (!open) return;
      map.draw(
        { x: screen.width / 2, y: screen.height / 2 },
        inputs,
        mapOverlayScale(screen),
        screen.uiScale,
      );
      const label = mapAreaNameLayout(screen);
      areaName.text = inputs.displayNames[inputs.area.name] ?? inputs.area.name;
      sizeText(areaName, label.size);
      areaName.position.set(label.at.x, label.at.y);
    },
  };
}

/**
 * The Mini Map at the top right: the map, without names, clipped to a
 * bronze-framed square with gold studs at its corners over a dark fill,
 * hidden unless `shown`. While hovered it shows its tooltip, naming how
 * `activeInput` opens the Map Overlay (none for touch), on `tooltipLayer`.
 */
function miniMapView(activeInput: Readonly<ActiveInput>) {
  const look = MINI_MAP;
  const layer = new Container();
  layer.visible = false;
  const back = new Graphics();
  const map = mapView(false);
  map.layer.alpha = look.opacity;
  const clip = new Graphics();
  map.layer.mask = clip;
  const frame = new Graphics();
  layer.addChild(back, map.layer, clip, frame);
  const tooltipLayer = new Container();
  const tooltipBox = new Graphics();
  const tooltipText = new Text({
    text: "",
    style: {
      fill: INVENTORY_STYLE.tooltipName,
      fontSize: INVENTORY_STYLE.tooltipSize,
      fontFamily: SERIF,
    },
  });
  tooltipText.anchor.set(0.5, 0);
  tooltipLayer.addChild(tooltipBox, tooltipText);

  return {
    layer,
    tooltipLayer,
    draw(
      screen: Viewport,
      inputs: MapInputs,
      shown: boolean,
      hovered: boolean,
    ) {
      layer.visible = shown;
      tooltipBox.clear();
      tooltipText.visible = false;
      if (!shown) return;
      const { x, y, w, h } = miniMapLayout(screen);
      const { frame: thickness, stud } = atUiScale(look, screen.uiScale);
      back.clear().rect(x, y, w, h).fill({
        color: look.fill,
        alpha: look.fillAlpha,
      });
      clip.clear().rect(x, y, w, h).fill(0xffffff);
      map.draw(
        { x: x + w / 2, y: y + h / 2 },
        inputs,
        miniMapScale(screen),
        screen.uiScale,
      );
      frame
        .clear()
        .rect(
          x + thickness / 2,
          y + thickness / 2,
          w - thickness,
          h - thickness,
        )
        .stroke({ color: look.frameColour, width: thickness });
      for (const corner of [
        { x, y },
        { x: x + w, y },
        { x, y: y + h },
        { x: x + w, y: y + h },
      ]) {
        frame
          .rect(corner.x - stud / 2, corner.y - stud / 2, stud, stud)
          .fill(look.studColour);
      }
      // Touch has no hover, so no tooltip.
      const tip = mapTooltip(activeInput.way);
      if (hovered && tip) {
        tooltipText.text = tip;
        tooltipText.visible = true;
        sizeText(tooltipText, INVENTORY_STYLE.tooltipSize * screen.uiScale);
        drawTooltip(tooltipBox, [tooltipText], screen, (size, gap) =>
          miniMapTooltipRect(screen, size, gap),
        );
      }
    },
  };
}

/** The colour a Minion's bar flashes when it is hit. */
const MINION_FLASH_COLOUR = 0xffffff;

/** The Minion Frame's look: an icon box and the icons' colours. */
const MINION_FRAME_STYLE = {
  box: 0x1a1510,
  boxAlpha: 0.8,
  edge: 0x4a4236,
  stone: 0x8a8478,
  bone: 0xe8e0c8,
  socket: 0x15120e,
  bow: 0xb08850,
};

/**
 * Draws a Minion kind's fixed icon in `box`: a stone Golem, a Skeleton's
 * skull, and the skull with a bow for an Archer.
 */
const MINION_ICONS: Record<
  MinionType,
  (graphics: Graphics, box: Rect) => void
> = {
  golem: (graphics, { x, y, w, h }) => {
    const look = MINION_FRAME_STYLE;
    graphics
      .rect(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.7)
      .fill(look.stone)
      .rect(x + w * 0.3, y + h * 0.32, w * 0.15, h * 0.15)
      .fill(look.socket)
      .rect(x + w * 0.55, y + h * 0.32, w * 0.15, h * 0.15)
      .fill(look.socket);
  },
  raisedSkeleton: (graphics, { x, y, w, h }) => {
    const look = MINION_FRAME_STYLE;
    graphics
      .circle(x + w / 2, y + h * 0.42, w * 0.3)
      .fill(look.bone)
      .rect(x + w * 0.35, y + h * 0.6, w * 0.3, h * 0.25)
      .fill(look.bone)
      .circle(x + w * 0.38, y + h * 0.42, w * 0.08)
      .fill(look.socket)
      .circle(x + w * 0.62, y + h * 0.42, w * 0.08)
      .fill(look.socket);
  },
  raisedArcher: (graphics, box) => {
    MINION_ICONS.raisedSkeleton(graphics, box);
    const { x, y, w, h } = box;
    graphics
      .moveTo(x + w * 0.85, y + h * 0.1)
      .quadraticCurveTo(x + w * 1.05, y + h * 0.5, x + w * 0.85, y + h * 0.9)
      .stroke({ width: Math.max(1, w * 0.07), color: MINION_FRAME_STYLE.bow });
  },
};

/**
 * The Minion Frame at the top left: a row per Minion kind the Hero has, its
 * icon and a thin Life bar per Minion, oldest first. Where it goes is
 * `minionFrameLayout`.
 */
function minionFrameView() {
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.eventMode = "none";
  // One count label per row, made as rows first need them.
  const counts: Text[] = [];

  return {
    layer,
    draw(
      screen: Viewport,
      world: World,
      flashedAtMs: ReadonlyMap<MinionId, number>,
      nowMs: number,
    ) {
      graphics.clear();
      const rows = minionFrameRows(world);
      for (const label of counts) label.visible = false;
      const laidOut = minionFrameLayout(screen, rows).rows;
      laidOut.forEach((row, index) => {
        const look = MINION_FRAME_STYLE;
        const { x, y, w, h } = row.icon;
        graphics
          .rect(x, y, w, h)
          .fill({ color: look.box, alpha: look.boxAlpha })
          .stroke({ width: 1, color: look.edge });
        MINION_ICONS[row.kind](graphics, row.icon);
        if (row.count !== null) {
          let label = counts[index];
          if (!label) {
            label = new Text({
              text: "",
              style: { fill: look.bone, fontFamily: SERIF },
            });
            label.anchor.set(0, 0.5);
            counts[index] = label;
            layer.addChild(label);
          }
          label.visible = true;
          label.text = row.count.text;
          sizeText(label, MINION_FRAME.countSize * screen.uiScale, 2);
          const { rect } = row.count;
          label.position.set(rect.x, rect.y + rect.h / 2);
        }
        for (const { id, fraction, rect } of row.bars) {
          lifeBar(graphics, {
            x: rect.x,
            y: rect.y,
            width: rect.w,
            height: rect.h,
            fraction,
            colour: FRIENDLY.life,
          });
          const hitAtMs = flashedAtMs.get(id);
          const flash =
            hitAtMs === undefined ? 0 : hurtFlashLeft(nowMs - hitAtMs);
          if (flash > 0) {
            graphics
              .rect(rect.x, rect.y, rect.w, rect.h)
              .fill({ color: MINION_FLASH_COLOUR, alpha: flash });
          }
        }
      });
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
  const { layer, graphics, texts, text } = panelScaffold();

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
      panelFrame(graphics, panel);
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
 * What a Hero-panel-look panel view starts with: a hidden layer holding a
 * Graphics, and `text`, which adds Text to the layer and keeps it at the
 * UI Scale (`texts.size(scale)` after drawing).
 */
function panelScaffold() {
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.visible = false;
  const texts = scaledTexts();
  const text = (fill: number, size: number = HERO_PANEL_STYLE.textSize) => {
    const t = new Text({
      text: "",
      style: { fill, fontSize: size, fontFamily: SERIF },
    });
    layer.addChild(t);
    return texts.add(t, size);
  };
  return { layer, graphics, texts, text };
}

/** Fills and edges a Hero-panel-look panel. */
function panelFrame(graphics: Graphics, panel: Rect) {
  const style = HERO_PANEL_STYLE;
  graphics
    .rect(panel.x, panel.y, panel.w, panel.h)
    .fill({ color: style.fill, alpha: style.alpha })
    .stroke({ color: style.edge, width: 2 });
}

/**
 * The Waypoint list, in the Hero panel's look: a row for each of Act 1's
 * Waypoints, the untouched greyed out and the one the Hero stands on marked,
 * under a title and over a hint how to close it.
 */
function waypointListView(
  activeInput: Readonly<ActiveInput>,
  displayNames: Readonly<Record<string, string>>,
) {
  const style = HERO_PANEL_STYLE;
  const { layer, graphics, texts, text } = panelScaffold();
  const title = text(style.title, style.titleSize);
  title.text = "Waypoints";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  /** Made as the sheet first lists them. */
  const names: Text[] = [];
  const notes: Text[] = [];

  return {
    layer,
    draw(screen: Viewport, world: World, open: boolean) {
      layer.visible = open;
      if (!open) return;
      hint.text = panelCloseHint("waypoints", activeInput.way);
      const sheet = waypointListSheet(world, displayNames);
      const layout = waypointListLayout(screen, sheet.length);
      const { panel } = layout;
      const scale = screen.uiScale;
      const { padding } = atUiScale(WAYPOINT_LIST, scale);

      graphics.clear();
      panelFrame(graphics, panel);
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      hint.position.set(panel.x + panel.w / 2, panel.y + panel.h - padding);

      sheet.forEach((waypoint, index) => {
        names[index] ??= text(style.title);
        notes[index] ??= text(style.hint, style.hintSize);
        const row = layout.rows[index];
        const y = row.y + row.h / 2;
        if (waypointPickable(waypoint)) button(graphics, row);
        else graphics.rect(row.x, row.y, row.w, row.h).stroke(style.edge);
        const name = names[index];
        name.text = waypoint.name;
        name.anchor.set(0, 0.5);
        name.position.set(row.x + padding / 2, y);
        // Greyed out until touched.
        name.style.fill = waypoint.touched ? style.title : style.hint;
        const note = notes[index];
        note.text = waypoint.here ? "You are here" : "";
        note.anchor.set(1, 0.5);
        note.position.set(row.x + row.w - padding / 2, y);
      });
      // Rows made this draw too.
      texts.size(scale);
    },
  };
}

/**
 * The Dialogue panel, in the Hero panel's look: the NPC's name over what
 * they say, a button for each thing the Hero can answer, and a hint how to
 * close it.
 */
function dialoguePanelView(activeInput: Readonly<ActiveInput>) {
  const style = HERO_PANEL_STYLE;
  const { layer, graphics, texts, text } = panelScaffold();
  const title = text(style.title, style.titleSize);
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  const body = text(style.name);
  body.style.wordWrap = true;
  /** Made as the sheet first lists them. */
  const labels: Text[] = [];

  return {
    layer,
    draw(
      screen: Viewport,
      world: World,
      open: boolean,
      npc: number,
      page: number,
    ) {
      const sheet = dialogueSheet(world, npc, page);
      layer.visible = open && sheet !== null;
      if (!open || !sheet) return;
      hint.text = panelCloseHint("dialogue", activeInput.way);
      const layout = dialogueLayout(screen, sheet.buttons.length);
      const { panel } = layout;
      const scale = screen.uiScale;
      const { padding } = atUiScale(DIALOGUE, scale);

      graphics.clear();
      panelFrame(graphics, panel);
      closeButton(graphics, layout.closeButton, scale);
      title.text = sheet.name;
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      hint.position.set(panel.x + panel.w / 2, panel.y + panel.h - padding);
      body.text = sheet.lines.join("\n\n");
      body.position.set(layout.body.x, layout.body.y);
      body.style.wordWrapWidth = layout.body.w;

      sheet.buttons.forEach(({ label }, index) => {
        labels[index] ??= text(style.title);
        const row = layout.buttons[index];
        button(graphics, row);
        const t = labels[index];
        t.text = label;
        t.anchor.set(0.5, 0.5);
        t.position.set(row.x + row.w / 2, row.y + row.h / 2);
      });
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
  const { layer, graphics, texts, text } = panelScaffold();

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
  /** Each Branch's heading row: its name at the left, its columns' headings. */
  const branchHeadings: Partial<
    Record<Branch, { name: Text; skillLevel: Text; manaCost: Text }>
  > = {};
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
      panelFrame(graphics, panel);
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

      for (const { branch, name } of sheet.branches) {
        if (!branchHeadings[branch]) {
          const nameText = text(style.hint, style.hintSize);
          nameText.anchor.set(0, 0.5);
          branchHeadings[branch] = {
            name: nameText,
            skillLevel: heading("Skill Level"),
            manaCost: heading("Mana"),
          };
        }
        const shown = branchHeadings[branch];
        const headingsRow = skillTreeBranchRow(screen, branch);
        const headingAt = skillTreeColumns(screen, headingsRow);
        shown.name.text = name;
        shown.name.position.set(headingsRow.x, middle(headingsRow));
        shown.skillLevel.visible = !screen.compact;
        shown.manaCost.visible = !screen.compact;
        shown.skillLevel.position.set(
          headingAt.skillLevel,
          middle(headingsRow),
        );
        shown.manaCost.position.set(headingAt.manaCost, middle(headingsRow));
        const ruleY = headingsRow.y + rowHeight - style.ruleGap * scale;
        graphics.rect(headingsRow.x, ruleY, headingsRow.w, 1).fill(style.edge);
      }

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
        const row = layout.skills[skill.skill];
        const column = skillTreeColumns(screen, row);
        const y = middle(row);
        // What holds it back: its Prerequisite first, else its Level.
        const heldBack = skill.prerequisite
          ? "Locked"
          : skill.requiredLevel !== null
            ? `Level ${skill.requiredLevel}`
            : null;
        // A Passive Skill sits in its own frame: it's never cast, so it
        // isn't looked for on the Skill Bar.
        if (skill.passive) {
          graphics
            .rect(row.x - 3, row.y + 1, row.w + 6, row.h - 2)
            .stroke({ width: 1, color: style.edge });
        }
        shown.name.text = skill.name;
        shown.name.style.fill = heldBack ? style.hint : style.title;
        shown.name.position.set(row.x, y);
        shown.requiredLevel.visible = heldBack !== null && !screen.compact;
        shown.requiredLevel.text = heldBack ?? "";
        shown.requiredLevel.position.set(column.requiredLevel, y);
        shown.skillLevel.text = skill.skillLevel;
        shown.skillLevel.position.set(column.skillLevel, y);
        shown.manaCost.visible = !screen.compact;
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
 * The Quest panel, in the Hero panel's look: a row for each of the Act's
 * Quests with its name at the left and its state at the right, and under it,
 * for a Quest that is Given, what to do next. A Quest ready to hand in is lit
 * and a Done one greyed.
 */
function questPanelView(activeInput: Readonly<ActiveInput>) {
  const style = HERO_PANEL_STYLE;
  const { layer, graphics, texts, text } = panelScaffold();

  const title = text(style.title, style.titleSize);
  title.text = "Quests";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  /** Made as the sheet first lists them. */
  const rows: { name: Text; state: Text; next: Text }[] = [];

  return {
    layer,
    draw(screen: Viewport, world: World, open: boolean) {
      layer.visible = open;
      if (!open) return;
      hint.text = panelCloseHint("quest", activeInput.way);
      const sheet = questPanelSheet(world);
      const layout = questPanelLayout(screen, sheet.length);
      const { panel } = layout;
      const scale = screen.uiScale;
      const { padding, nextOffset, ruleInset } = atUiScale(QUEST_PANEL, scale);

      graphics.clear();
      panelFrame(graphics, panel);
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      hint.position.set(panel.x + panel.w / 2, panel.y + panel.h - padding);

      sheet.forEach((quest, index) => {
        if (!rows[index]) {
          const next = text(style.hint, style.hintSize);
          next.style.wordWrap = true;
          rows[index] = {
            name: text(style.name),
            state: text(style.value),
            next,
          };
          rows[index].name.anchor.set(0, 0);
          rows[index].state.anchor.set(1, 0);
        }
        const shown = rows[index];
        const row = layout.rows[index];
        const lit = quest.state === "ready";
        const done = quest.state === "done";
        shown.name.text = quest.name;
        shown.name.style.fill = lit ? style.title : style.name;
        shown.name.alpha = done ? 0.6 : 1;
        shown.name.position.set(row.x, row.y);
        shown.state.text = quest.stateName;
        shown.state.style.fill = lit ? style.title : style.value;
        shown.state.alpha = done ? 0.6 : 1;
        shown.state.position.set(row.x + row.w, row.y);
        shown.next.visible = quest.nextStep !== null;
        shown.next.text = quest.nextStep ?? "";
        shown.next.style.wordWrapWidth = row.w;
        shown.next.position.set(row.x, row.y + nextOffset);
        graphics
          .rect(row.x, row.y + row.h - ruleInset, row.w, 1)
          .fill(style.edge);
      });
      // Rows made this draw too.
      texts.size(scale);
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
  /** The Hero's Gold, at the top left. */
  const gold = text(GOLD_COLOUR, style.textSize);
  gold.anchor.set(0, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
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
    rarity: Rarity,
    scale: number,
    alpha = look.itemAlpha,
  ) => {
    to.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
      .fill({ color: itemColour(type), alpha })
      .stroke({ color: look.itemEdge, width: 1 });
    name.visible = true;
    labelItem(name, type, rect.w, scale);
    name.style.fill = rarityColour(rarity);
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
    const { type, rarity } = held.item;
    const rect = heldItemRect(layout, pointer, type);
    drawItem(heldBox, heldName, rect, type, rarity, scale, look.heldAlpha);
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
      heldCell: number | null = null,
    ) {
      const layout = inventoryPanelLayout(screen, beltRows(world));
      const { panel, grid, cell, slots } = layout;
      const scale = screen.uiScale;
      const { padding } = atUiScale(INVENTORY_PANEL, scale);
      // Before any return: the Held Item's name, drawn with the panel shut.
      // Names and tooltip lines made this draw are sized as they're made.
      texts.size(scale);
      drawHeld(
        world,
        pointer,
        heldCell === null ? layout : { ...layout, cell: heldCell },
        scale,
      );
      layer.visible = open;
      if (!open) return;
      hint.text = panelCloseHint("inventory", activeInput.way);

      graphics.clear();
      panelFrame(graphics, panel);
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      gold.text = goldTotalLabel(world.hero.progress.gold);
      gold.position.set(panel.x + padding, panel.y + padding + 4 * scale);
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

      const items: { rect: Rect; type: ItemType; rarity: Rarity }[] = [];
      const equipment = equipmentOf(world);
      for (const slot of EQUIPMENT_SLOTS) {
        const rect = slots[slot];
        box(rect);
        const item = equipment[slot];
        if (item === null) {
          for (const polygon of slotHintPolygons(slot, rect)) {
            graphics.poly(polygon).stroke({
              color: look.slotHint,
              width: 1,
              alpha: look.slotHintAlpha,
            });
          }
        }
        if (item) items.push({ rect, type: item.type, rarity: item.rarity });
      }
      for (const { item, cell: at } of inventoryOf(world)) {
        items.push({
          rect: itemRect(layout, at, item.type),
          type: item.type,
          rarity: item.rarity,
        });
      }
      const potions = beltOf(world);
      layout.belt.forEach((cells, column) => {
        cells.forEach((rect, row) => {
          box(rect);
          const potion = potions[column]?.[row];
          if (potion)
            items.push({ rect, type: potion.type, rarity: potion.rarity });
        });
      });
      items.forEach(({ rect, type, rarity }, i) => {
        names[i] ??= itemName();
        drawItem(graphics, names[i], rect, type, rarity, scale);
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
      const lines = itemTooltip(item);
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
        shown.style.fill =
          i === 0 ? rarityColour(item.rarity) : look.tooltipLine;
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
 * The Vendor panel, in the Inventory panel's look: the Vendor's grid beside
 * the Hero's Inventory grid, each Item drawn at its size, the Hero's Gold,
 * and the tooltip of the Item under the cursor, a good's with its Value.
 */
function vendorPanelView(activeInput: Readonly<ActiveInput>) {
  const style = HERO_PANEL_STYLE;
  const look = INVENTORY_STYLE;
  const { layer, graphics, texts, text } = panelScaffold();
  const title = text(style.title, style.titleSize);
  title.anchor.set(0.5, 0);
  const gold = text(GOLD_COLOUR, style.textSize);
  gold.anchor.set(0, 0);
  const hint = text(style.hint, style.hintSize);
  hint.anchor.set(0.5, 1);
  /** Item names, one per Item drawn, made as more are needed. */
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
  const tooltipLines: Text[] = [];

  return {
    layer,
    /**
     * `hovered` is the spot under `pointer`, the cursor on the canvas (CSS
     * px), if it's on the panel.
     */
    draw(
      screen: Viewport,
      world: World,
      open: boolean,
      hovered: VendorHit["vendor"] | undefined,
      pointer: Vec | null,
    ) {
      layer.visible = open;
      if (!open) return;
      const layout = vendorPanelLayout(screen);
      const { panel, cell } = layout;
      const scale = screen.uiScale;
      const { padding } = atUiScale(VENDOR_PANEL, scale);
      const vendor = world.areas[world.areaName].npcs.find((npc) => npc.vendor);
      title.text = vendor?.name ?? "Vendor";
      hint.text = panelCloseHint("vendor", activeInput.way);
      graphics.clear();
      panelFrame(graphics, panel);
      closeButton(graphics, layout.closeButton, scale);
      title.position.set(panel.x + panel.w / 2, panel.y + padding);
      gold.text = goldTotalLabel(world.hero.progress.gold);
      gold.position.set(panel.x + padding, panel.y + padding + 4 * scale);
      hint.position.set(panel.x + panel.w / 2, panel.y + panel.h - padding);

      const box = (rect: Rect) =>
        graphics
          .rect(rect.x, rect.y, rect.w, rect.h)
          .fill(look.cell)
          .stroke({ color: look.cellEdge, width: 1 });
      for (const [grid, columns, rows] of [
        [layout.goods, vendorTuning.grid.columns, vendorTuning.grid.rows],
        [layout.inventory, inventoryTuning.columns, inventoryTuning.rows],
      ] as const) {
        for (let column = 0; column < columns; column++) {
          for (let row = 0; row < rows; row++) {
            box({
              x: grid.x + column * cell,
              y: grid.y + row * cell,
              w: cell,
              h: cell,
            });
          }
        }
      }

      const goodsLayout = goodsGrid(layout);
      const mine = inventoryGrid(layout);
      const drawn: { rect: Rect; item: Item }[] = [
        ...goodsOf(world).map(({ item, cell: at }) => ({
          rect: itemRect(goodsLayout, at, item.type),
          item,
        })),
        ...inventoryOf(world).map(({ item, cell: at }) => ({
          rect: itemRect(mine, at, item.type),
          item,
        })),
      ];
      drawn.forEach(({ rect, item }, i) => {
        names[i] ??= itemName();
        const name = names[i];
        graphics
          .rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
          .fill({ color: itemColour(item.type), alpha: look.itemAlpha })
          .stroke({ color: look.itemEdge, width: 1 });
        name.visible = true;
        labelItem(name, item.type, rect.w, scale);
        name.style.fill = rarityColour(item.rarity);
        name.anchor.set(0.5);
        name.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
      });
      for (const name of names.slice(drawn.length)) name.visible = false;
      texts.size(scale);

      tooltipBox.clear();
      for (const line of tooltipLines) line.visible = false;
      const held = cursorItemOf(world);
      if (held) {
        // Where it would land on the Inventory grid, and whether it would.
        if (pointer && hovered && "inventory" in hovered) {
          const to = landingCell(mine, pointer, held.item.type);
          const rect = itemRect(mine, to, held.item.type);
          const x = Math.max(rect.x, mine.grid.x);
          const y = Math.max(rect.y, mine.grid.y);
          const w = Math.min(rect.x + rect.w, mine.grid.x + mine.grid.w) - x;
          const h = Math.min(rect.y + rect.h, mine.grid.y + mine.grid.h) - y;
          const fits = isGoodSpot(held.from)
            ? buyable(world, to)
            : placement(world, to) !== null;
          graphics.rect(x, y, w, h).fill({
            color: fits ? look.fits : look.refused,
            alpha: look.landingAlpha,
          });
        }
        // No tooltip while holding an Item, as in the Inventory panel.
        return;
      }
      if (!hovered) return;
      let shown: { item: Item; rect: Rect; value: boolean } | null = null;
      if ("good" in hovered) {
        const good = goodAt(world, hovered.good);
        if (good) {
          shown = {
            item: good.item,
            rect: itemRect(goodsLayout, good.cell, good.item.type),
            value: true,
          };
        }
      } else {
        const placed = inventoryItemAt(world, hovered.inventory);
        if (placed) {
          shown = {
            item: placed.item,
            rect: itemRect(mine, placed.cell, placed.item.type),
            value: false,
          };
        }
      }
      if (!shown) return;
      const { item } = shown;
      // Over the Item names, which are made as more Items are drawn.
      layer.setChildIndex(tooltipBox, layer.children.length - 1);
      const { lines, affordable } = shown.value
        ? goodTooltip(item, world.hero.progress.gold)
        : { lines: sellTooltip(item), affordable: true };
      lines.forEach((line, i) => {
        if (!tooltipLines[i]) {
          tooltipLines[i] = text(look.tooltipLine, look.tooltipSize);
          sizeText(tooltipLines[i], look.tooltipSize * scale);
        }
        const row = tooltipLines[i];
        layer.setChildIndex(row, layer.children.length - 1);
        row.visible = true;
        row.text = line;
        const isValue = i === lines.length - 1;
        row.style.fill =
          i === 0
            ? rarityColour(item.rarity)
            : isValue
              ? affordable
                ? GOLD_COLOUR
                : UNAFFORDABLE_COLOUR
              : look.tooltipLine;
        row.anchor.set(0.5, 0);
      });
      const under = shown.rect;
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
 * The screen over a dead Hero: darkening while they lie still, then "YOU
 * TRIED" with a pulsing hint to go on, named for the Active Input.
 */
function deathScreenView(activeInput: Readonly<ActiveInput>) {
  const layer = new Container();
  const dark = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  const title = new Text({
    text: "YOU TRIED",
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
 * The menu over a paused game: it credits the KayKit models and points to
 * `CREDITS.md` for the rest, and offers a New Hero.
 */
function pauseMenuView(activeInput: Readonly<ActiveInput>) {
  const { darkness, panel, title, credit, hint } = PAUSE_MENU;
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
      "3D models by Kay Lousberg (KayKit)",
      "kaylousberg.com · CC0",
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
    { text: resume, y: height - hint.bottom, size: hint.size },
  ];
  const content = new Container();
  content.addChild(box, heading, credits, resume);
  layer.addChild(dark, content);
  // On the screen, where `pauseMenuLayout` puts them.
  const buttons = menuButtonsView(layer);
  layer.visible = false;

  return {
    layer,
    /**
     * The button `focus` names is ringed, for a controller. The Fullscreen
     * button shows, and reads, as `fullscreen` says.
     */
    draw(
      screen: Viewport,
      pause: Pause,
      focus: MenuChoice | null,
      fullscreen: Fullscreen,
    ) {
      layer.visible = pause.paused;
      if (!pause.paused) return;
      resume.text = resumeHint(activeInput.way);
      dark.scale.set(screen.width, screen.height);
      const layout = pauseMenuLayout(screen, activeInput.way, fullscreen);
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
 * The Start Screen's look: the pause menu's colours, the game's name in
 * the title's gold with a black outline, over a World lightly darkened.
 */
const START_SCREEN = {
  darkness: 0.35,
  stroke: 6,
  question: { size: 20, lineHeight: 30, gap: 24 },
};

/**
 * The Start Screen: the game's name above its row of buttons, which asks
 * to confirm a New Hero as the pause menu does. Where things go is
 * `startScreenLayout`.
 */
function startScreenView(activeInput: Readonly<ActiveInput>) {
  const layer = new Container();
  const dark = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  dark.alpha = START_SCREEN.darkness;
  const title = new Text({
    text: GAME_NAME,
    style: { fill: PAUSE_MENU.title.colour, fontFamily: SERIF },
  });
  title.anchor.set(0.5);
  const question = new Text({
    text: "",
    style: {
      fill: PAUSE_MENU.question.colour,
      fontFamily: SERIF,
      align: "center",
    },
  });
  question.anchor.set(0.5, 1);
  layer.addChild(dark, title, question);
  const buttons = menuButtonsView(layer);
  layer.visible = false;

  return {
    layer,
    draw(
      viewport: Viewport,
      startScreen: StartScreen,
      level: number,
      fullscreen: Fullscreen,
      focus: MenuChoice | null,
    ) {
      layer.visible = true;
      dark.scale.set(viewport.width, viewport.height);
      const layout = startScreenLayout(
        viewport,
        startScreen,
        activeInput.way,
        fullscreen,
      );
      const scale = viewport.uiScale;
      sizeText(title, layout.title.size, START_SCREEN.stroke * scale);
      title.position.set(layout.title.at.x, layout.title.at.y);
      question.visible = startScreen.confirming;
      if (startScreen.confirming) {
        const { size, lineHeight, gap } = START_SCREEN.question;
        question.text = [
          "Start a New Hero?",
          `Your Level ${level} Hero will be lost for good.`,
        ].join("\n");
        sizeText(question, size * scale);
        question.style.lineHeight = lineHeight * scale;
        question.position.set(
          viewport.width / 2,
          layout.buttons[0].rect.y - gap * scale,
        );
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
