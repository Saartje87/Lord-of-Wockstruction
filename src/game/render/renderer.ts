import {
  type Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
} from "pixi.js";
import { toScreen, toTile } from "../iso";
import type { MenuChoice, Menus } from "../menus";
import type { Pause } from "../pause";
import { type Area, isFloor } from "../sim/area";
import {
  cursorItemOf,
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
  equipmentOf,
  type ItemId,
  type ItemSpot,
  inventoryOf,
  isSlot,
  placement,
} from "../sim/inventory";
import { windUpProgress } from "../sim/monsters";
import type { Rect } from "../sim/rect";
import { STEP_MS } from "../sim/units";
import { tileOf, type Vec } from "../sim/vec";
import {
  ATTRIBUTES,
  areaFade,
  DEATH_STEPS,
  FLINCH_STEPS,
  groundItemsOf,
  HERO_FLINCH_STEPS,
  HIT_STEP,
  isInCombat,
  isRegenerating,
  type MonsterId,
  maxLife,
  type SimEvent,
  SWING_STEPS,
  type World,
} from "../sim/world";
import { heroTuning } from "../tuning/hero";
import { inputTuning } from "../tuning/input";
import { type ItemKind, type ItemType, itemOf } from "../tuning/items";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { type Compass, compassOf, frameAt, swingFrame } from "./animation";
import { type Animation, type Art, type CharacterArt, frameOf } from "./art";
import {
  type DamageNumber,
  damageNumbers,
  floatAt,
  floatText,
} from "./damageNumbers";
import { experienceBar } from "./experienceBar";
import {
  GROUND_LABEL,
  type GroundLabel,
  groundItemUnder,
  groundLabelAt,
  groundLabels,
} from "./groundLabels";
import {
  HERO_PANEL,
  heroPanelLayout,
  heroSheet,
  PANEL_ROWS,
  type PanelHit,
  panelHitAt,
  rowTop,
} from "./heroPanel";
import {
  type DropHit,
  INVENTORY_PANEL,
  type InventoryHit,
  inventoryHitAt,
  inventoryPanelLayout,
  itemRect,
  itemTooltip,
  itemUnder,
  landingCell,
} from "./inventoryPanel";
import { menuChoiceAt, PAUSE_MENU_LAYOUT, pauseMenuLayout } from "./pauseMenu";

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
 * The death screen: it darkens to `darkness` over `DEATH_STEPS`, then shows
 * "You died" over a hint that pulses `pulsesPerSecond` times a second.
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
 * Each Monster type's size against Flare's native scale. The Skeleton is
 * drawn as Flare made it; this is the one number to change if it looks off.
 */
const MONSTER_SCALE: Record<MonsterType, number> = { skeleton: 1 };
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
/** A Monster's clickable box around its feet at native scale (CSS px). */
const MONSTER_BOX = { left: -35, right: 35, top: -135, bottom: 15 };
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
 * The top-centre nameplate of a hovered Monster (CSS px): a dark panel with
 * the name `nameTop` below its top and a Life bar `barBottom` above its bottom.
 */
const NAMEPLATE = {
  width: 220,
  height: 46,
  top: 10,
  alpha: 0.6,
  nameTop: 6,
  nameColour: 0xe8e0c8,
  nameSize: 16,
  bar: 180,
  barHeight: 8,
  barBottom: 8,
};
/** A Life bar's fill, and its dark back with how opaque that is (0..1). */
const LIFE_COLOUR = 0xc02020;
const LIFE_BACK = { colour: 0x2a0606, alpha: 0.85 };
/** Damage numbers: their size and black outline (CSS px). */
const NUMBER = { size: 18, stroke: 3, gap: 2 };
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
};

/** The stone strip along the bottom of the screen (CSS px). */
const STRIP = {
  height: 34,
  colour: 0x15120e,
  alpha: 0.92,
  edge: 2,
  edgeColour: 0x4a4236,
};
/**
 * The Hero's Life orb at the bottom left (CSS px): `left` and `bottom` from
 * the screen's corner to its stone rim, which is `rim` wide.
 */
const ORB = {
  radius: 52,
  rim: 8,
  left: 24,
  bottom: 10,
  rimColour: 0x2a241c,
  rimLine: 0x4a4236,
  glassLine: 0x6b6258,
  empty: 0x140404,
  /** The Life at the bottom, lighter towards the surface by up to `lighten`. */
  life: 0x8a0e0e,
  lighten: 0x30,
};
/** How far the surface ripples either way (CSS px) and how fast (rad/s). */
const RIPPLE = { calm: 1, combat: 2.5, speed: 5, depth: 3 };
/** Bubbles rising through the orb while the Hero regenerates. */
const BUBBLES = {
  count: 6,
  radius: 2,
  colour: 0xff9a9a,
  alpha: 0.6,
  /** Rises per second, bottom to surface. */
  rate: 0.6,
};
/**
 * The Experience bar along the strip, right of the orb (CSS px): `gap` from
 * the orb's rim, `right` from the screen's edge, with `Lv N` before it and
 * `current / next` after it, each `textGap` from the bar.
 */
const EXPERIENCE_BAR = {
  gap: 14,
  right: 16,
  height: 6,
  textGap: 8,
  textSize: 13,
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
 * Attribute values keep `plusGap` from their + buttons (CSS px).
 */
const HERO_PANEL_STYLE = {
  fill: 0x17130e,
  alpha: 0.94,
  edge: 0x5a4a2e,
  title: 0xe8d27a,
  titleSize: 22,
  name: 0xb8ae98,
  value: 0xe8e0c8,
  textSize: 15,
  plusSize: 18,
  plusGap: 10,
  hint: 0x9a9080,
  hintSize: 13,
  ruleGap: 4,
};
/**
 * The Inventory panel's look, in the Hero panel's colours; where things go
 * is `inventoryPanelLayout`. Each Item is a box tinted by its kind with its
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
  itemTextSize: 11,
  tooltip: 0x000000,
  tooltipAlpha: 0.85,
  tooltipName: 0xe8d27a,
  tooltipLine: 0xe8e0c8,
  tooltipSize: 14,
  tooltipLineHeight: 19,
  tooltipPadding: 8,
  tooltipGap: 6,
};
/** The tint of each kind of Item on the Inventory panel. */
const ITEM_COLOUR: Record<ItemKind, number> = {
  weapon: 0x4a4a52,
  armour: 0x5a4028,
  ring: 0x3a3a68,
  amulet: 0x5a3a5a,
};
/**
 * A Ground Item: a small diamond on the floor tinted by its kind, `size`
 * across (CSS px), under a dark label with its name, gold while hovered.
 * A click within `grab` of the diamond's box picks it up too.
 */
const GROUND_ITEM = {
  size: 14,
  grab: 4,
  edge: 0xd8c890,
  label: 0x000000,
  labelAlpha: 0.7,
  name: 0xe8e0c8,
  hoveredName: 0xe8d27a,
  textSize: 13,
};

/** The name shown in each empty Equipment slot. */
const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  armour: "Armour",
  amulet: "Amulet",
  ring1: "Ring",
  ring2: "Ring",
};

/** The badge over the orb: its size, gap over the rim (CSS px) and colours. */
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
 * following the Hero.
 */
export function createRenderer(app: Application, art: Art) {
  const camera = new Container();
  app.stage.addChild(camera);

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
  // Under the scene, so the ring spreads at the Hero's feet.
  const levelRing = new Graphics();
  camera.addChildAt(levelRing, camera.getChildIndex(scene));
  const levelFlash = new ColorMatrixFilter({ resolution: "inherit" });
  levelFlash.matrix = washTo(LEVEL_UP.colour);
  const outline = outlineView();
  scene.addChild(outline.layer);
  // Over the scene: Life bars over heads and damage numbers.
  const overheads = new Graphics();
  camera.addChild(overheads);
  // Ground Items' name labels, always shown.
  const labelBacks = new Graphics();
  camera.addChild(labelBacks);
  const labelTexts = new Map<ItemId, Text>();
  /** Where each Ground Item's label was last drawn, in camera space. */
  let labels: GroundLabel[] = [];
  /** Where each Ground Item was last drawn on the floor, in camera space. */
  let lyingAt: { id: ItemId; at: Vec }[] = [];
  const numbers = new Container();
  camera.addChild(numbers);
  const floating: { text: Text; bornMs: number; at: Vec }[] = [];
  const nameplate = new Graphics();
  app.stage.addChild(nameplate);
  const nameplateText = new Text({
    text: "",
    style: {
      fill: NAMEPLATE.nameColour,
      fontSize: NAMEPLATE.nameSize,
      fontFamily: SERIF,
    },
  });
  nameplateText.anchor.set(0.5, 0);
  app.stage.addChild(nameplateText);
  const orb = lifeOrbView();
  app.stage.addChild(orb.layer);
  const experience = experienceBarView();
  app.stage.addChild(experience.layer);
  const levelUp = levelUpButtonView();
  app.stage.addChild(levelUp.layer);
  const heroPanel = heroPanelView();
  app.stage.addChild(heroPanel.layer);
  const inventoryPanel = inventoryPanelView();
  app.stage.addChild(inventoryPanel.layer);
  // Over the whole screen, stretched to it each frame.
  const hurt = new Graphics().rect(0, 0, 1, 1).fill(HURT_COLOUR);
  hurt.visible = false;
  app.stage.addChild(hurt);
  const death = deathScreenView();
  app.stage.addChild(death.layer);
  // The fade to black of an Area change, over everything.
  const fade = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  fade.visible = false;
  app.stage.addChild(fade);
  const menu = pauseMenuView();
  app.stage.addChild(menu.layer);

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
  let hoveredTile: Vec | null = null;
  let markedAtMs: number | null = null;
  let hurtAtMs: number | null = null;
  let levelAtMs: number | null = null;
  /** The World last drawn; a New Hero brings another. */
  let drawnWorld: World | null = null;
  /** Whether the Hero panel was open when last drawn. */
  let heroPanelOpenNow = false;
  /** Whether the Inventory panel was open when last drawn. */
  let inventoryOpenNow = false;

  /**
   * What a point on the canvas (CSS px) hits of the Hero panel, the Level Up
   * button and the Inventory panel, as last drawn, or null when it's for
   * the World.
   */
  const panelAt = (screen: Vec): PanelHit | InventoryHit | DropHit | null => {
    if (!drawnWorld) return null;
    const holding = cursorItemOf(drawnWorld) !== null;
    return (
      panelHitAt(app.screen, screen, drawnWorld, heroPanelOpenNow) ??
      inventoryHitAt(app.screen, screen, inventoryOpenNow, holding)
    );
  };

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
    // Item ids start over too.
    for (const text of labelTexts.values()) text.destroy();
    labelTexts.clear();
    hurtAtMs = levelAtMs = null;
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
    markedAtMs = null;
    hoveredTile = null;
    hover.clear();
  };

  /** Maps a point on the canvas (CSS px) to tile units, as last drawn. */
  const screenToTile = (screen: Vec): Vec =>
    toTile({
      x: screen.x - camera.position.x,
      y: screen.y - camera.position.y,
    });

  /** The Monster drawn under a point on the canvas (CSS px), as last drawn. */
  const monsterAt = (screen: Vec): MonsterId | null => {
    const x = screen.x - camera.position.x;
    const y = screen.y - camera.position.y;
    let nearest: { id: MonsterId; y: number } | null = null;
    for (const [id, view] of monsters) {
      if (view.diedAtMs !== null) continue;
      const { position } = view.sprite;
      const scale = MONSTER_SCALE[view.type];
      const dx = (x - position.x) / scale;
      const dy = (y - position.y) / scale;
      const inside =
        dx >= MONSTER_BOX.left &&
        dx <= MONSTER_BOX.right &&
        dy >= MONSTER_BOX.top &&
        dy <= MONSTER_BOX.bottom;
      // The one in front wins where they overlap.
      if (inside && (!nearest || position.y > nearest.y)) {
        nearest = { id, y: position.y };
      }
    }
    return nearest?.id ?? null;
  };

  /** The Ground Item whose label is under a canvas point (CSS px). */
  const groundLabelUnder = (screen: Vec): ItemId | null =>
    groundLabelAt(labels, {
      x: screen.x - camera.position.x,
      y: screen.y - camera.position.y,
    });

  /** The Ground Item drawn on the floor under a canvas point (CSS px). */
  const groundItemAt = (screen: Vec): ItemId | null =>
    groundItemUnder(
      lyingAt,
      { x: screen.x - camera.position.x, y: screen.y - camera.position.y },
      GROUND_ITEM.size / 2 + GROUND_ITEM.grab,
    );

  /**
   * Draws each Ground Item on the floor with its name label over it, gold
   * for `hovered`, and drops the labels of Items no longer lying there.
   */
  const drawGroundItems = (world: World, hovered: ItemId | null) => {
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
        .fill(ITEM_COLOUR[itemOf(item.type).kind])
        .stroke({ color: GROUND_ITEM.edge, width: 1 });
      let text = labelTexts.get(item.id);
      if (!text) {
        text = new Text({
          text: itemOf(item.type).name,
          style: { fontSize: GROUND_ITEM.textSize, fontFamily: SERIF },
        });
        text.anchor.set(0.5, 0.5);
        labelTexts.set(item.id, text);
        camera.addChild(text);
      }
      const width = text.width + 2 * GROUND_LABEL.padding;
      return { id: item.id, at, width };
    });
    labels = groundLabels(sized);
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
     * off them all; `confirming` while asking to confirm a New Hero.
     */
    menuChoiceAt(screen: Vec, confirming: boolean): MenuChoice | null {
      return menuChoiceAt(app.screen, screen, confirming);
    },

    /** Turns a step's events into effects. */
    react(events: readonly SimEvent[], nowMs: number) {
      for (const number of damageNumbers(events)) {
        const sprite =
          number.on === "hero" ? hero.sprite : monsters.get(number.on)?.sprite;
        if (!sprite) continue;
        const text = new Text({
          text: floatText(number),
          style: {
            fill: NUMBER_COLOUR[number.kind],
            fontSize: NUMBER.size,
            fontFamily: SERIF,
            stroke: { color: 0x000000, width: NUMBER.stroke },
          },
        });
        text.anchor.set(0.5, 1);
        numbers.addChild(text);
        // Just over where a Monster's Life bar goes.
        const at = { x: sprite.position.x, y: barTop(sprite) - NUMBER.gap };
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
        if (event.type === "HeroHit") hurtAtMs = nowMs;
        if (event.type === "LevelReached") levelAtMs = nowMs;
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
     * everything while paused.
     */
    draw(
      world: World,
      alpha: number,
      pointer: Vec | null,
      nowMs: number,
      menus: Menus,
    ) {
      const active = world.areas[world.areaName];
      heroPanelOpenNow = menus.heroPanelOpen;
      inventoryOpenNow = menus.inventoryOpen;
      if (world !== drawnWorld) showWorld(world);
      else if (active !== area) showArea(active);
      const heroAt = lerp(world.hero.prevPos, world.hero.pos, alpha);
      const at = toScreen(heroAt);

      // Snap the camera and sprites to device pixels so the art stays
      // crisp, with the Hero at the centre of the screen.
      const centre = { x: app.screen.width / 2, y: app.screen.height / 2 };
      const snap = (v: number) =>
        Math.round(v * app.renderer.resolution) / app.renderer.resolution;
      camera.position.set(snap(centre.x - at.x), snap(centre.y - at.y));
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
          const { frames } = view.art.timing.swing;
          const frame = Math.min(frames - 1, Math.floor(progress * frames));
          show(view, "swing", compass, frame);
          telegraph(telegraphs, monster.type, monsterAt, view.facing, progress);
        } else if (monster.flinch > 0) {
          const ms = (FLINCH_STEPS[monster.type] - monster.flinch) * STEP_MS;
          show(view, "hit", compass, frameAt(view.art.timing.hit, ms));
        } else {
          walkOrStand(view, monster, monsterAt, compass, nowMs);
        }
        flash(view, nowMs);
      }

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

      for (const [id, view] of monsters) {
        if (seen.has(id)) continue;
        view.sprite.destroy();
        view.flash?.destroy();
        monsters.delete(id);
      }

      overheads.clear();
      for (const monster of world.monsters) {
        const { life } = monsterTuning[monster.type];
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
        const float = floatAt(nowMs - bornMs);
        if (!float) {
          text.destroy();
          floating.splice(i, 1);
          continue;
        }
        text.position.set(snap(at.x), snap(at.y - float.rise));
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
      const hoveredId = onWorld && !hoveredLabel && monsterAt(onWorld);
      const hoveredItem =
        hoveredLabel || (onWorld && !hoveredId ? groundItemAt(onWorld) : null);
      drawGroundItems(world, hoveredItem);
      const hovered =
        world.monsters.find((monster) => monster.id === hoveredId) ?? null;
      const hoveredView = hovered && monsters.get(hovered.id);
      outline.show(hoveredView?.sprite ?? null);
      nameplate.clear();
      nameplateText.visible = hovered !== null;
      if (hovered) {
        const tuning = monsterTuning[hovered.type];
        const centre = app.screen.width / 2;
        nameplate
          .rect(
            centre - NAMEPLATE.width / 2,
            NAMEPLATE.top,
            NAMEPLATE.width,
            NAMEPLATE.height,
          )
          .fill({ color: 0x000000, alpha: NAMEPLATE.alpha });
        lifeBar(nameplate, {
          x: centre - NAMEPLATE.bar / 2,
          y:
            NAMEPLATE.top +
            NAMEPLATE.height -
            NAMEPLATE.barHeight -
            NAMEPLATE.barBottom,
          width: NAMEPLATE.bar,
          height: NAMEPLATE.barHeight,
          fraction: hovered.life / tuning.life,
        });
        nameplateText.text = tuning.name;
        nameplateText.position.set(centre, NAMEPLATE.top + NAMEPLATE.nameTop);
      }

      const tile =
        cursor && !hovered && isFloor(active, cursor) ? tileOf(cursor) : null;
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

      orb.draw(app.screen, world, nowMs);
      experience.draw(app.screen, world);
      levelUp.draw(app.screen, world, nowMs);
      heroPanel.draw(app.screen, world, menus.heroPanelOpen);
      const spot = onPanel && "inventory" in onPanel ? onPanel.inventory : null;
      inventoryPanel.draw(
        app.screen,
        world,
        menus.inventoryOpen,
        spot,
        pointer,
      );

      const hurtLeft = hurtAtMs === null ? 0 : 1 - (nowMs - hurtAtMs) / HURT_MS;
      hurt.visible = hurtLeft > 0;
      if (hurt.visible) {
        hurt.alpha = HURT_STRENGTH * hurtLeft;
        hurt.scale.set(app.screen.width, app.screen.height);
      }

      death.draw(app.screen, world, nowMs);

      const darkness = areaFade(world);
      fade.visible = darkness > 0;
      if (fade.visible) {
        fade.alpha = darkness;
        fade.scale.set(app.screen.width, app.screen.height);
      }

      menu.draw(app.screen, menus.pause, world.hero.progress.level);

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
  type: MonsterType,
  at: Vec,
  facing: number,
  progress: number,
) {
  const { reach, arcDegrees } = monsterTuning[type];
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

/** A Life bar: a dark back, filled from the left by `fraction` (0..1). */
function lifeBar(
  graphics: Graphics,
  bar: {
    x: number;
    y: number;
    width: number;
    height: number;
    fraction: number;
  },
) {
  graphics
    .rect(bar.x, bar.y, bar.width, bar.height)
    .fill({ color: LIFE_BACK.colour, alpha: LIFE_BACK.alpha });
  graphics
    .rect(bar.x, bar.y, bar.width * bar.fraction, bar.height)
    .fill(LIFE_COLOUR);
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
 * The stone strip along the bottom of the screen and the Hero's Life orb on
 * it, filling from the bottom with Life. In Combat its surface ripples harder
 * under an "⚔ In Combat" badge; while regenerating, bubbles rise through it
 * under one with the rate.
 */
function lifeOrbView() {
  const layer = new Container();
  const graphics = new Graphics();
  const badge = new Text({
    text: "",
    style: { fill: BADGE.combat, fontSize: BADGE.size, fontFamily: SERIF },
  });
  badge.anchor.set(0.5, 1);
  layer.addChild(graphics, badge);

  return {
    layer,
    draw(
      screen: { width: number; height: number },
      world: World,
      nowMs: number,
    ) {
      const { radius: r } = ORB;
      const cx = ORB.left + ORB.rim + r;
      const cy = screen.height - ORB.bottom - ORB.rim - r;
      const seconds = nowMs / 1000;
      const inCombat = isInCombat(world);
      const regenerating = isRegenerating(world);

      graphics.clear();
      graphics
        .rect(0, screen.height - STRIP.height, screen.width, STRIP.height)
        .fill({ color: STRIP.colour, alpha: STRIP.alpha });
      graphics
        .rect(0, screen.height - STRIP.height, screen.width, STRIP.edge)
        .fill(STRIP.edgeColour);
      graphics
        .circle(cx, cy, r + ORB.rim)
        .fill(ORB.rimColour)
        .stroke({ width: 2, color: ORB.rimLine });
      graphics.circle(cx, cy, r).fill(ORB.empty);

      // One 1 px row at a time, so the surface can ripple.
      const fraction = world.hero.life / maxLife(world);
      const surface = cy + r - fraction * r * 2;
      const ripple = inCombat ? RIPPLE.combat : RIPPLE.calm;
      for (let y = Math.floor(surface); y < cy + r; y++) {
        const half = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
        const wave =
          y < surface + RIPPLE.depth
            ? Math.sin(seconds * RIPPLE.speed + y) * ripple
            : 0;
        const height = (cy + r - y) / (r * 2);
        const red = Math.min(ORB.lighten, Math.floor(height * ORB.lighten));
        graphics
          .rect(cx - half + wave, y, half * 2, 1)
          .fill(ORB.life + red * 0x10000);
      }

      if (regenerating) {
        for (let i = 0; i < BUBBLES.count; i++) {
          const rise = (seconds * BUBBLES.rate + i / BUBBLES.count) % 1;
          const x = cx + Math.sin(i * 2.3 + seconds * 2) * r * 0.5;
          const y = cy + r - rise * fraction * r * 2;
          graphics
            .circle(x, y, BUBBLES.radius)
            .fill({ color: BUBBLES.colour, alpha: BUBBLES.alpha * (1 - rise) });
        }
      }

      // The glass: a highlight and its rim.
      graphics
        .ellipse(cx - r * 0.3, cy - r * 0.45, r * 0.35, r * 0.18)
        .fill({ color: 0xffffff, alpha: 0.12 });
      graphics.circle(cx, cy, r).stroke({ width: 3, color: ORB.glassLine });

      badge.visible = inCombat || regenerating;
      badge.text = inCombat
        ? "⚔ In Combat"
        : `+${heroTuning.regenPerSecond} Life/s`;
      badge.style.fill = inCombat ? BADGE.combat : BADGE.regen;
      badge.position.set(cx, cy - r - ORB.rim - BADGE.gap);
    },
  };
}

/**
 * The thin Experience bar along the strip, right of the Life orb, with
 * `Lv N` before it and `current / next` Experience after it.
 */
function experienceBarView() {
  const layer = new Container();
  const graphics = new Graphics();
  const style = {
    fill: EXPERIENCE_BAR.textColour,
    fontSize: EXPERIENCE_BAR.textSize,
    fontFamily: SERIF,
  };
  const level = new Text({ text: "", style });
  level.anchor.set(0, 0.5);
  const amount = new Text({ text: "", style });
  amount.anchor.set(1, 0.5);
  layer.addChild(graphics, level, amount);

  return {
    layer,
    draw(screen: { width: number; height: number }, world: World) {
      const bar = experienceBar(
        world.hero.progress.level,
        world.hero.progress.experience,
      );
      const y = screen.height - (STRIP.height - STRIP.edge) / 2;
      const left = ORB.left + 2 * (ORB.rim + ORB.radius) + EXPERIENCE_BAR.gap;
      const right = screen.width - EXPERIENCE_BAR.right;
      level.text = bar.level;
      level.position.set(left, y);
      amount.text = bar.experience;
      amount.position.set(right, y);

      const from = left + level.width + EXPERIENCE_BAR.textGap;
      const width = Math.max(
        0,
        right - amount.width - EXPERIENCE_BAR.textGap - from,
      );
      const top = y - EXPERIENCE_BAR.height / 2;
      graphics.clear();
      graphics
        .rect(from, top, width, EXPERIENCE_BAR.height)
        .fill(EXPERIENCE_BAR.back)
        .stroke({ width: 1, color: EXPERIENCE_BAR.edge });
      if (bar.fill > 0) {
        graphics
          .rect(from, top, width * bar.fill, EXPERIENCE_BAR.height)
          .fill(EXPERIENCE_BAR.fill);
      }
    },
  };
}

/**
 * The Level Up button by the Life orb, shown while Attribute Points are
 * unspent, its edge pulsing to catch the eye.
 */
function levelUpButtonView() {
  const layer = new Container();
  const graphics = new Graphics();
  const label = new Text({
    text: "Level Up",
    style: {
      fill: HUD_BUTTON.text,
      fontSize: HUD_BUTTON.textSize,
      fontFamily: SERIF,
    },
  });
  label.anchor.set(0.5);
  layer.addChild(graphics, label);
  layer.visible = false;

  return {
    layer,
    draw(
      screen: { width: number; height: number },
      world: World,
      nowMs: number,
    ) {
      layer.visible = world.hero.progress.attributePoints > 0;
      if (!layer.visible) return;
      const rect = heroPanelLayout(screen).levelUp;
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
 * The Hero panel: Level and Experience, each Attribute with a + button while
 * a point can be spent, the unspent points, and what the Attributes add up
 * to.
 */
function heroPanelView() {
  const style = HERO_PANEL_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.visible = false;
  const text = (fill: number, size = style.textSize) => {
    const t = new Text({
      text: "",
      style: { fill, fontSize: size, fontFamily: SERIF },
    });
    layer.addChild(t);
    return t;
  };

  const title = text(style.title, style.titleSize);
  title.text = "Hero";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.text = "Press C to close";
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
    return { ...row(), plus };
  });
  const points = row();
  /** Made as the sheet first lists them. */
  const derived: Row[] = [];

  return {
    layer,
    draw(
      screen: { width: number; height: number },
      world: World,
      open: boolean,
    ) {
      layer.visible = open;
      if (!open) return;
      const sheet = heroSheet(world);
      const layout = heroPanelLayout(screen);
      const { panel } = layout;
      const left = panel.x + HERO_PANEL.padding;
      const right = panel.x + panel.w - HERO_PANEL.padding;
      // Attribute values leave room for their + buttons.
      const beforePlus = right - HERO_PANEL.plus - style.plusGap;

      graphics.clear();
      graphics
        .rect(panel.x, panel.y, panel.w, panel.h)
        .fill({ color: style.fill, alpha: style.alpha })
        .stroke({ color: style.edge, width: 2 });
      title.position.set(panel.x + panel.w / 2, panel.y + HERO_PANEL.padding);
      hint.position.set(
        panel.x + panel.w / 2,
        panel.y + panel.h - HERO_PANEL.padding,
      );

      const place = (
        shown: Row,
        at: number,
        name: string,
        value: string,
        valueRight = right,
      ) => {
        const y = rowTop(at) + HERO_PANEL.rowHeight / 2;
        shown.name.text = name;
        shown.name.position.set(left, y);
        shown.value.text = value;
        shown.value.position.set(valueRight, y);
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
          beforePlus,
        );
        const rect = layout.raise[attribute.attribute];
        shown.plus.visible = sheet.canRaise;
        if (sheet.canRaise) {
          button(graphics, rect);
          shown.plus.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
        }
      });
      place(
        points,
        PANEL_ROWS.attributePoints,
        "Attribute Points",
        sheet.attributePoints,
        beforePlus,
      );
      points.value.style.fill = sheet.canRaise ? style.title : style.value;
      sheet.derived.forEach((value, i) => {
        derived[i] ??= row();
        place(derived[i], PANEL_ROWS.derived + i, value.name, value.value);
      });
      for (const at of [PANEL_ROWS.attributes, PANEL_ROWS.derived]) {
        const y = rowTop(at) - style.ruleGap;
        graphics.rect(left, y, right - left, 1).fill(style.edge);
      }
    },
  };
}

/**
 * The Inventory panel: the Equipment slots over the 10×4 grid, each Item
 * drawn at its size, and the tooltip of the Item under the cursor.
 */
function inventoryPanelView() {
  const style = HERO_PANEL_STYLE;
  const look = INVENTORY_STYLE;
  const layer = new Container();
  const graphics = new Graphics();
  layer.addChild(graphics);
  layer.visible = false;
  const text = (fill: number, size: number) => {
    const t = new Text({
      text: "",
      style: { fill, fontSize: size, fontFamily: SERIF },
    });
    layer.addChild(t);
    return t;
  };

  const title = text(style.title, style.titleSize);
  title.text = "Inventory";
  title.anchor.set(0.5, 0);
  const hint = text(style.hint, style.hintSize);
  hint.text = "Press I to close";
  hint.anchor.set(0.5, 1);
  const slotLabels = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => {
      const label = text(look.slotLabel, look.slotLabelSize);
      label.text = SLOT_NAMES[slot];
      label.anchor.set(0.5);
      return [slot, label];
    }),
  ) as Record<EquipmentSlot, Text>;
  /** Item names, one per Item drawn, made as more are needed. */
  const names: Text[] = [];
  const tooltipBox = new Graphics();
  layer.addChild(tooltipBox);
  /** Tooltip lines, made as more are needed, over its box. */
  const tooltipLines: Text[] = [];
  /** The held Item, over everything else on the panel. */
  const heldBox = new Graphics();
  layer.addChild(heldBox);
  const heldName = text(look.itemText, look.itemTextSize);

  /** Draws an Item's box, tinted by its kind, with its name in `name`. */
  const drawItem = (
    to: Graphics,
    name: Text,
    rect: Rect,
    type: ItemType,
    alpha = look.itemAlpha,
  ) => {
    const tuning = itemOf(type);
    to.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
      .fill({ color: ITEM_COLOUR[tuning.kind], alpha })
      .stroke({ color: look.itemEdge, width: 1 });
    name.visible = true;
    name.text = tuning.name;
    name.style.wordWrap = true;
    name.style.wordWrapWidth = rect.w - 4;
    name.style.align = "center";
    name.anchor.set(0.5);
    name.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
  };

  return {
    layer,
    /**
     * `hovered` is the spot under `pointer`, the cursor on the canvas (CSS
     * px), if it's on the panel.
     */
    draw(
      screen: { width: number; height: number },
      world: World,
      open: boolean,
      hovered: ItemSpot | null,
      pointer: Vec | null,
    ) {
      layer.visible = open;
      if (!open) return;
      const layout = inventoryPanelLayout(screen);
      const { panel, grid, cell, slots } = layout;

      graphics.clear();
      graphics
        .rect(panel.x, panel.y, panel.w, panel.h)
        .fill({ color: style.fill, alpha: style.alpha })
        .stroke({ color: style.edge, width: 2 });
      title.position.set(
        panel.x + panel.w / 2,
        panel.y + INVENTORY_PANEL.padding,
      );
      hint.position.set(
        panel.x + panel.w / 2,
        panel.y + panel.h - INVENTORY_PANEL.padding,
      );

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
      items.forEach(({ rect, type }, i) => {
        names[i] ??= text(look.itemText, look.itemTextSize);
        drawItem(graphics, names[i], rect, type);
      });
      for (const name of names.slice(items.length)) name.visible = false;

      tooltipBox.clear();
      for (const line of tooltipLines) line.visible = false;
      heldBox.clear();
      heldName.visible = false;
      const held = cursorItemOf(world);
      if (held && pointer) {
        const { type } = held.item;
        if (hovered && !isSlot(hovered)) {
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
        const { columns, rows } = itemOf(type).size;
        const rect = {
          x: pointer.x - (columns * cell) / 2,
          y: pointer.y - (rows * cell) / 2,
          w: columns * cell,
          h: rows * cell,
        };
        layer.setChildIndex(heldBox, layer.children.length - 1);
        layer.setChildIndex(heldName, layer.children.length - 1);
        drawItem(heldBox, heldName, rect, type, look.heldAlpha);
        // No tooltip while holding an Item, as in Diablo 2.
        return;
      }
      const item = hovered && itemUnder(world, hovered);
      if (!hovered || !item) return;
      const under = isSlot(hovered)
        ? slots[hovered]
        : itemRect(
            layout,
            inventoryOf(world).find((placed) => placed.item.id === item.id)
              ?.cell ?? hovered,
            item.type,
          );
      const lines = itemTooltip(item.type);
      lines.forEach((line, i) => {
        tooltipLines[i] ??= text(look.tooltipLine, look.tooltipSize);
        const shown = tooltipLines[i];
        // Over the box, which is made before any line.
        layer.setChildIndex(shown, layer.children.length - 1);
        shown.visible = true;
        shown.text = line;
        shown.style.fill = i === 0 ? look.tooltipName : look.tooltipLine;
        shown.anchor.set(0.5, 0);
      });
      const shown = tooltipLines.slice(0, lines.length);
      const pad = look.tooltipPadding;
      const w = Math.max(...shown.map((line) => line.width)) + 2 * pad;
      const h = lines.length * look.tooltipLineHeight + 2 * pad;
      // Over the Item, or under it where there's no room above, and kept on
      // the screen.
      const above = under.y - look.tooltipGap - h;
      const y = above >= 0 ? above : under.y + under.h + look.tooltipGap;
      const x = Math.min(
        screen.width - w,
        Math.max(0, under.x + under.w / 2 - w / 2),
      );
      tooltipBox
        .rect(x, y, w, h)
        .fill({ color: look.tooltip, alpha: look.tooltipAlpha })
        .stroke({ color: style.edge, width: 1 });
      shown.forEach((line, i) => {
        line.position.set(x + w / 2, y + pad + i * look.tooltipLineHeight);
      });
    },
  };
}

/**
 * The screen over a dead Hero: darkening while they lie still, then "You
 * died" with a pulsing hint to click.
 */
function deathScreenView() {
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
    text: "Click to return to Town",
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
function pauseMenuView() {
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
  heading.position.set(width / 2, title.top);
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
  credits.position.set(width / 2, credit.top);
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
  confirm.position.set(width / 2, question.top);
  const resume = new Text({
    text: "",
    style: { fill: hint.colour, fontSize: hint.size, fontFamily: SERIF },
  });
  resume.anchor.set(0.5, 1);
  resume.position.set(width / 2, height - hint.bottom);
  const content = new Container();
  content.addChild(box, heading, credits, confirm, resume);
  // On the screen, where `pauseMenuLayout` puts them.
  const buttons = new Graphics();
  /** Made as the layout first lists them. */
  const labels: Text[] = [];
  layer.addChild(dark, content, buttons);
  layer.visible = false;

  return {
    layer,
    /**
     * While confirming, asks whether to give up the Level `level` Hero for a
     * New Hero.
     */
    draw(
      screen: { width: number; height: number },
      pause: Pause,
      level: number,
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
      // Esc goes back from the question rather than resuming.
      resume.text = confirming
        ? "Click elsewhere to resume"
        : "Click elsewhere or press Esc to resume";
      dark.scale.set(screen.width, screen.height);
      const layout = pauseMenuLayout(screen, confirming);
      content.position.set(layout.panel.x, layout.panel.y);

      buttons.clear();
      for (const label of labels) label.visible = false;
      layout.buttons.forEach(({ label: name, rect }, i) => {
        button(buttons, rect);
        labels[i] ??= menuLabel(layer);
        const label = labels[i];
        label.text = name;
        label.visible = true;
        label.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
      });
    },
  };
}

/** A pause-menu button's label, centred where it's put, added to `layer`. */
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
