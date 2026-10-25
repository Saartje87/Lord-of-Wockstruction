import {
  type Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
} from "pixi.js";
import { toScreen, toTile } from "../iso";
import { type Area, isFloor } from "../sim/area";
import { windUpProgress } from "../sim/monsters";
import { STEP_MS } from "../sim/units";
import { tileOf, type Vec } from "../sim/vec";
import {
  areaFade,
  DEATH_STEPS,
  FLINCH_STEPS,
  HERO_FLINCH_STEPS,
  HIT_STEP,
  isInCombat,
  isRegenerating,
  type MonsterId,
  type SimEvent,
  SWING_STEPS,
  type World,
} from "../sim/world";
import { heroTuning } from "../tuning/hero";
import { inputTuning } from "../tuning/input";
import { type MonsterType, monsterTuning } from "../tuning/monsters";
import { type Compass, compassOf, frameAt, swingFrame } from "./animation";
import { type Animation, type Art, type CharacterArt, frameOf } from "./art";
import { type DamageNumber, damageNumbers, floatAt } from "./damageNumbers";

const HOVER_LINE = 0xd8c48a;
const MARKER_LINE = 0xe8d27a;

/** How long a hit Monster flashes white (ms), fading out. */
const FLASH_MS = 120;
/** How white a hit Monster turns at the start of its flash (0..1). */
const FLASH_STRENGTH = 0.8;

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
 * The pause menu: a dark panel in the middle of a darkened screen, with the
 * art's credit and a hint to resume.
 */
const PAUSE_MENU = {
  darkness: 0.6,
  panel: { width: 460, height: 250, colour: 0x17130e, edge: 0x5a4a2e },
  title: { colour: 0xe8d27a, size: 40, top: 28 },
  credit: { colour: 0xd8d0b8, size: 15, top: 96, lineHeight: 22 },
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
 * and grey for a Miss.
 */
const NUMBER_COLOUR: Record<DamageNumber["kind"], number> = {
  hit: 0xffffff,
  kill: 0xffd04a,
  taken: 0xff4a4a,
  miss: 0x9a9a9a,
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
  // Walls, props, the Hero, Monsters and Corpses, nearest the viewer last.
  const scene = new Container();
  scene.sortableChildren = true;
  camera.addChild(scene);
  const hero = characterView(art.hero, heroTuning.walkSpeed);
  scene.addChild(hero.sprite);
  const outline = outlineView();
  scene.addChild(outline.layer);
  // Over the scene: Life bars over heads and damage numbers.
  const overheads = new Graphics();
  camera.addChild(overheads);
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

  return {
    screenToTile,
    monsterAt,

    /** Turns a step's events into effects. */
    react(events: readonly SimEvent[], nowMs: number) {
      for (const number of damageNumbers(events)) {
        const sprite =
          number.on === "hero" ? hero.sprite : monsters.get(number.on)?.sprite;
        if (!sprite) continue;
        const text = new Text({
          text: number.kind === "miss" ? "Miss" : String(number.damage),
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
     * current one; `pointer` is the cursor on the canvas (CSS px), if on it.
     * `paused` shows the pause menu over everything.
     */
    draw(
      world: World,
      alpha: number,
      pointer: Vec | null,
      nowMs: number,
      paused: boolean,
    ) {
      const active = world.areas[world.areaName];
      if (active !== area) showArea(active);
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

      // After moving the camera, so the highlight matches this frame.
      const cursor = pointer && screenToTile(pointer);
      const hoveredId = pointer && monsterAt(pointer);
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

      menu.draw(app.screen, paused);

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
    // Every colour to white, keeping alpha; `alpha` mixes it in.
    view.flash.matrix = [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
    ];
  }
  view.flash.alpha = FLASH_STRENGTH * left;
  if (!view.sprite.filters) view.sprite.filters = [view.flash];
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
      const fraction = world.hero.life / heroTuning.life;
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
 * `CREDITS.md` for the rest.
 */
function pauseMenuView() {
  const { darkness, panel, title, credit, hint } = PAUSE_MENU;
  const layer = new Container();
  const dark = new Graphics().rect(0, 0, 1, 1).fill(0x000000);
  dark.alpha = darkness;
  const box = new Graphics()
    .rect(-panel.width / 2, 0, panel.width, panel.height)
    .fill(panel.colour)
    .stroke({ color: panel.edge, width: 2 });
  const heading = new Text({
    text: "Paused",
    style: { fill: title.colour, fontSize: title.size, fontFamily: SERIF },
  });
  heading.anchor.set(0.5, 0);
  heading.position.set(0, title.top);
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
  credits.position.set(0, credit.top);
  const resume = new Text({
    text: "Click or press Esc to resume",
    style: { fill: hint.colour, fontSize: hint.size, fontFamily: SERIF },
  });
  resume.anchor.set(0.5, 1);
  resume.position.set(0, panel.height - hint.bottom);
  const content = new Container();
  content.addChild(box, heading, credits, resume);
  layer.addChild(dark, content);
  layer.visible = false;

  return {
    layer,
    draw(screen: { width: number; height: number }, paused: boolean) {
      layer.visible = paused;
      if (!paused) return;
      dark.scale.set(screen.width, screen.height);
      content.position.set(
        Math.round(screen.width / 2),
        Math.round((screen.height - panel.height) / 2),
      );
    },
  };
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
