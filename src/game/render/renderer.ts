import {
  type Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
} from "pixi.js";
import { toScreen, toTile } from "../iso";
import { type Area, isFloor } from "../sim/area";
import { STEP_MS } from "../sim/units";
import { tileOf, type Vec } from "../sim/vec";
import {
  FLINCH_STEPS,
  HIT_STEP,
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

const HOVER_LINE = 0xd8c48a;
const MARKER_LINE = 0xe8d27a;

/** How long a hit Monster flashes white (ms), fading out. */
const FLASH_MS = 120;
/** How white a hit Monster turns at the start of its flash (0..1). */
const FLASH_STRENGTH = 0.8;

/**
 * Each Monster type's size against Flare's native scale. The Skeleton is
 * drawn as Flare made it; this is the one number to change if it looks off.
 */
const MONSTER_SCALE: Record<MonsterType, number> = { skeleton: 1 };
/** A Monster's clickable box around its feet at native scale (CSS px). */
const MONSTER_BOX = { left: -35, right: 35, top: -135, bottom: 15 };
/**
 * How far behind the living a Corpse sorts (CSS px of screen y): one row of
 * tiles, so anyone standing on or just behind a Corpse is drawn over it.
 */
const CORPSE_DEPTH = toScreen({ x: 1, y: 0 }).y;

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
  /** Which way it last walked (radians in tile space); the sim has no facing. */
  facing: number;
  diedAtMs: number | null;
  flashUntilMs: number;
  flash: ColorMatrixFilter | null;
};

/** Draws an Area and the World in it into a Pixi stage, following the Hero. */
export function createRenderer(app: Application, area: Area, art: Art) {
  const camera = new Container();
  app.stage.addChild(camera);

  camera.addChild(drawTiles(area, area.floorTiles, art));
  const hover = new Graphics();
  camera.addChild(hover);
  const marker = drawMarker();
  marker.visible = false;
  camera.addChild(marker);
  // Walls, props, the Hero, Monsters and Corpses, nearest the viewer last.
  const scene = drawTiles(area, area.propTiles, art);
  scene.sortableChildren = true;
  camera.addChild(scene);
  const hero = characterView(art.hero, heroTuning.walkSpeed);
  scene.addChild(hero.sprite);

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
      for (const event of events) {
        if (event.type === "HitLanded") {
          const view = monsters.get(event.target);
          if (view) view.flashUntilMs = nowMs + FLASH_MS;
        }
        if (event.type === "MonsterDied") {
          const view = monsters.get(event.id);
          if (view) view.diedAtMs = nowMs;
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
     * current one; `pointer` is the cursor on the canvas (CSS px), if on it.
     */
    draw(world: World, alpha: number, pointer: Vec | null, nowMs: number) {
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
      const { swing } = world.hero;
      const heroCompass = compassOf(world.hero.facing);
      if (swing) {
        const frame = swingFrame(
          {
            ...HERO_SWING,
            frames: art.hero.timing.swing.frames,
            strikeFrame: HERO_STRIKE_FRAME,
          },
          swing.elapsed * STEP_MS,
        );
        show(hero, "swing", heroCompass, frame);
      } else {
        walkOrStand(hero, world.hero, heroAt, heroCompass, nowMs);
      }

      const seen = new Set<MonsterId>();
      for (const monster of world.monsters) {
        seen.add(monster.id);
        const view = viewOf(monster.id, monster.type);
        const { pos, prevPos } = monster;
        const monsterAt = lerp(prevPos, pos, alpha);
        place(view, monsterAt);
        if (pos.x !== prevPos.x || pos.y !== prevPos.y) {
          view.facing = Math.atan2(pos.y - prevPos.y, pos.x - prevPos.x);
        }
        const compass = compassOf(view.facing);
        if (monster.flinch > 0) {
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

      // After moving the camera, so the highlight matches this frame.
      const cursor = pointer && screenToTile(pointer);
      const onMonster = pointer !== null && monsterAt(pointer) !== null;
      const tile =
        cursor && !onMonster && isFloor(area, cursor) ? tileOf(cursor) : null;
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
  const layer = new Container();
  tiles.forEach((id, i) => {
    if (id === null) return;
    const texture = art.tiles.get(id);
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
    layer.addChild(sprite);
  });
  return layer;
}

/** A diamond centred on its origin, the size of one tile. */
function drawMarker() {
  return new Graphics()
    .poly(diamond(-0.5, -0.5))
    .stroke({ color: MARKER_LINE, width: 2 });
}
