import { type Application, Container, Graphics, Sprite } from "pixi.js";
import { toScreen, toTile } from "../iso";
import { type Area, isFloor } from "../sim/area";
import { tileOf, type Vec } from "../sim/vec";
import type { MonsterId, SimEvent, World } from "../sim/world";
import { heroTuning } from "../tuning/hero";
import { inputTuning } from "../tuning/input";
import { compassOf, frameAt } from "./animation";
import { type Art, frameOf } from "./art";

const HOVER_LINE = 0xd8c48a;
const MARKER_LINE = 0xe8d27a;
const BONE_FILL = 0xd9d2bf;
const CORPSE_FILL = 0x8f8775;
const SWING_FILL = 0x8899ff;
const SWING_LANDED_FILL = 0xffd04a;

/** How long a hit Monster flashes white (ms). */
const FLASH_MS = 120;
/** How far a flinching Monster leans back (radians). */
const FLINCH_LEAN = 0.25;
/** A placeholder Monster's clickable box around its feet (CSS px). */
const MONSTER_BOX = { left: -10, right: 10, top: -34, bottom: 6 };

/**
 * The Hero's walking speed (tiles/s) at which `run` plays at Flare's own
 * rate; it plays faster or slower with the speed actually walked.
 */
const HERO_RUN_SPEED = heroTuning.walkSpeed;

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
  const corpses = new Container();
  camera.addChild(corpses);
  const swing = new Graphics();
  camera.addChild(swing);
  // Walls, props, the Hero and Monsters, drawn nearest the viewer last.
  const characters = drawTiles(area, area.propTiles, art);
  characters.sortableChildren = true;
  camera.addChild(characters);
  const hero = new Sprite(frameOf(art.hero, "stance", "s", 0));
  characters.addChild(hero);

  const monsters = new Map<MonsterId, Graphics>();
  const drawnCorpses = new Set<MonsterId>();
  const flashUntilMs = new Map<MonsterId, number>();
  let hoveredTile: Vec | null = null;
  let markedAtMs: number | null = null;
  /** How far into `run` the Hero's feet are, as ms at `HERO_RUN_SPEED`. */
  let heroRunMs = 0;
  let heroDrawnAt: Vec | null = null;

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
      const dx = x - view.position.x;
      const dy = y - view.position.y;
      const inside =
        dx >= MONSTER_BOX.left &&
        dx <= MONSTER_BOX.right &&
        dy >= MONSTER_BOX.top &&
        dy <= MONSTER_BOX.bottom;
      // The one in front wins where they overlap.
      if (inside && (!nearest || view.position.y > nearest.y)) {
        nearest = { id, y: view.position.y };
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
          flashUntilMs.set(event.target, nowMs + FLASH_MS);
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
      const { pos, prevPos } = world.hero;
      const heroAt = lerp(prevPos, pos, alpha);
      const at = toScreen(heroAt);

      // Snap the camera and sprites to device pixels so the art stays
      // crisp, with the Hero at the centre of the screen.
      const centre = { x: app.screen.width / 2, y: app.screen.height / 2 };
      const snap = (v: number) =>
        Math.round(v * app.renderer.resolution) / app.renderer.resolution;
      camera.position.set(snap(centre.x - at.x), snap(centre.y - at.y));
      hero.position.set(snap(at.x), snap(at.y));
      hero.zIndex = at.y;

      // The feet follow the ground actually covered, so they never slide.
      const walking = pos.x !== prevPos.x || pos.y !== prevPos.y;
      if (walking && heroDrawnAt) {
        const covered = Math.hypot(
          heroAt.x - heroDrawnAt.x,
          heroAt.y - heroDrawnAt.y,
        );
        heroRunMs += (covered / HERO_RUN_SPEED) * 1000;
      }
      heroDrawnAt = heroAt;
      const compass = compassOf(world.hero.facing);
      hero.texture = walking
        ? frameOf(
            art.hero,
            "run",
            compass,
            frameAt(art.hero.timing.run, heroRunMs),
          )
        : frameOf(
            art.hero,
            "stance",
            compass,
            frameAt(art.hero.timing.stance, nowMs),
          );
      drawSwing(swing, world);

      for (const corpse of world.corpses) {
        if (drawnCorpses.has(corpse.id)) continue;
        drawnCorpses.add(corpse.id);
        const view = drawCorpse();
        const at = toScreen(corpse.pos);
        view.position.set(at.x, at.y);
        corpses.addChild(view);
      }

      const alive = new Set<MonsterId>();
      for (const monster of world.monsters) {
        alive.add(monster.id);
        let view = monsters.get(monster.id);
        if (!view) {
          view = drawMonster();
          monsters.set(monster.id, view);
          characters.addChild(view);
        }
        const at = toScreen(lerp(monster.prevPos, monster.pos, alpha));
        view.position.set(at.x, at.y);
        view.zIndex = at.y;
        view.rotation = monster.flinch > 0 ? -FLINCH_LEAN : 0;
        const flashing = (flashUntilMs.get(monster.id) ?? 0) > nowMs;
        view.tint = flashing ? 0xffffff : BONE_FILL;
      }
      for (const [id, view] of monsters) {
        if (alive.has(id)) continue;
        view.destroy();
        monsters.delete(id);
        flashUntilMs.delete(id);
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

/**
 * A placeholder Skeleton standing on its origin, drawn white so its tint
 * sets its colour.
 */
function drawMonster() {
  return new Graphics()
    .ellipse(0, 0, 11, 5)
    .fill({ color: 0x000000, alpha: 0.4 })
    .roundRect(-6, -32, 12, 32, 5)
    .fill(0xffffff)
    .circle(0, -36, 5)
    .fill(0xffffff);
}

/** A placeholder Corpse: bones lying on the ground around its origin. */
function drawCorpse() {
  return new Graphics()
    .ellipse(0, 0, 14, 5)
    .fill(CORPSE_FILL)
    .circle(12, -2, 4)
    .fill(CORPSE_FILL);
}

/** The arc a swing covers on the ground, brighter once its hit has landed. */
function drawSwing(graphics: Graphics, world: World) {
  graphics.clear();
  const { swing, pos, facing } = world.hero;
  if (!swing) return;
  const half = (heroTuning.arcDegrees * Math.PI) / 180;
  const points: Vec[] = [pos];
  for (let i = 0; i <= 10; i++) {
    const angle = facing - half + (2 * half * i) / 10;
    points.push({
      x: pos.x + heroTuning.reach * Math.cos(angle),
      y: pos.y + heroTuning.reach * Math.sin(angle),
    });
  }
  graphics
    .poly(
      points.flatMap((point) => {
        const at = toScreen(point);
        return [at.x, at.y];
      }),
    )
    .fill({
      color: swing.landed ? SWING_LANDED_FILL : SWING_FILL,
      alpha: swing.landed ? 0.35 : 0.2,
    });
}
