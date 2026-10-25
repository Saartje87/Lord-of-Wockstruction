import { type Application, Container, Graphics } from "pixi.js";
import { toScreen, toTile } from "../iso";
import { type Area, isFloor, isWalkable } from "../sim/area";
import { tileOf, type Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { inputTuning } from "../tuning/input";

const FLOOR_FILL = 0x3a3428;
const FLOOR_LINE = 0x241f17;
const WALL_FILL = 0x6b5e48;
const WALL_LINE = 0x8a7a5c;
const HOVER_LINE = 0xd8c48a;
const MARKER_LINE = 0xe8d27a;
const HERO_FILL = 0xc9a24a;
const FACING_FILL = 0xe8d27a;

/** Draws an Area and the World in it into a Pixi stage, following the Hero. */
export function createRenderer(app: Application, area: Area) {
  const camera = new Container();
  app.stage.addChild(camera);

  camera.addChild(drawFloor(area));
  const hover = new Graphics();
  camera.addChild(hover);
  const marker = drawMarker();
  marker.visible = false;
  camera.addChild(marker);
  const facing = drawFacing();
  camera.addChild(facing);
  const hero = drawHero();
  camera.addChild(hero);

  let hoveredTile: Vec | null = null;
  let markedAtMs: number | null = null;

  /** Maps a point on the canvas (CSS px) to tile units, as last drawn. */
  const screenToTile = (screen: Vec): Vec =>
    toTile({
      x: screen.x - camera.position.x,
      y: screen.y - camera.position.y,
    });

  return {
    screenToTile,

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
      const at = toScreen({
        x: prevPos.x + (pos.x - prevPos.x) * alpha,
        y: prevPos.y + (pos.y - prevPos.y) * alpha,
      });

      // Snap the camera to device pixels so the floor stays crisp, and put
      // the Hero exactly at the centre of the screen.
      const centre = { x: app.screen.width / 2, y: app.screen.height / 2 };
      const snap = (v: number) =>
        Math.round(v * app.renderer.resolution) / app.renderer.resolution;
      camera.position.set(snap(centre.x - at.x), snap(centre.y - at.y));
      hero.position.set(
        centre.x - camera.position.x,
        centre.y - camera.position.y,
      );
      facing.position.copyFrom(hero.position);
      const ahead = toScreen({
        x: Math.cos(world.hero.facing),
        y: Math.sin(world.hero.facing),
      });
      facing.rotation = Math.atan2(ahead.y, ahead.x);

      // After moving the camera, so the highlight matches this frame.
      const cursor = pointer && screenToTile(pointer);
      const tile = cursor && isFloor(area, cursor) ? tileOf(cursor) : null;
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

/** The corners of tile (i, j) on screen: top, right, bottom, left. */
function diamond(i: number, j: number): number[] {
  return [
    toScreen({ x: i, y: j }),
    toScreen({ x: i + 1, y: j }),
    toScreen({ x: i + 1, y: j + 1 }),
    toScreen({ x: i, y: j + 1 }),
  ].flatMap(({ x, y }) => [x, y]);
}

function drawFloor(area: Area) {
  const floor = new Graphics();
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (!isFloor(area, { x, y })) continue;
      // Placeholder walls: flat, lighter diamonds until wall art lands.
      const wall = !isWalkable(area, { x, y });
      floor
        .poly(diamond(x, y))
        .fill(wall ? WALL_FILL : FLOOR_FILL)
        .stroke({ color: wall ? WALL_LINE : FLOOR_LINE, width: 1 });
    }
  }
  return floor;
}

/** A diamond centred on its origin, the size of one tile. */
function drawMarker() {
  return new Graphics()
    .poly(diamond(-0.5, -0.5))
    .stroke({ color: MARKER_LINE, width: 2 });
}

/**
 * A placeholder direction indicator on the ground, pointing along +x from
 * its origin; rotate it to the facing as seen on screen.
 */
function drawFacing() {
  return new Graphics().poly([14, -4, 22, 0, 14, 4]).fill(FACING_FILL);
}

/** A placeholder Hero standing on its origin. */
function drawHero() {
  return new Graphics()
    .ellipse(0, 0, 12, 6)
    .fill({ color: 0x000000, alpha: 0.4 })
    .roundRect(-8, -36, 16, 36, 6)
    .fill(HERO_FILL);
}
