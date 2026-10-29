import type { OrthographicCamera } from "three";
import { TILE_WIDTH } from "../iso";
import type { Vec } from "../sim/vec";
import type { Viewport } from "../viewport";

/**
 * Where the 3D World's camera looks: orthographic, 30° down the diagonal,
 * with `focus` (a point on the floor, in tile units) at the centre of the
 * screen. It has no rotation and no zoom control, only the World zoom.
 * Tile (x, y) is scene (x, 0, y), so tile +x runs down-right on screen and
 * +y down-left, as in 2D.
 */
export type WorldCamera = {
  focus: Vec;
  /** The screen's size, CSS px. */
  width: number;
  height: number;
  /** The World zoom. */
  zoom: number;
};

/** How far the camera looks down at the floor. */
export const ELEVATION = Math.PI / 6;

/** The camera on `focus` for `viewport`, at its World zoom. */
export function worldCameraOn(viewport: Viewport, focus: Vec): WorldCamera {
  return {
    focus,
    width: viewport.width,
    height: viewport.height,
    zoom: viewport.worldZoom,
  };
}

/**
 * How many CSS px one scene unit measures along the floor's diagonals. At
 * this scale the floor's diamonds are Flare's 2:1 diamonds at the World zoom.
 */
export function pixelsPerUnit(zoom: number): number {
  return (TILE_WIDTH * zoom) / Math.SQRT2;
}

/**
 * Where a point is drawn on the screen (CSS px): the point on the floor at
 * `tile`, lifted `height` scene units.
 */
export function tileToScreen(camera: WorldCamera, tile: Vec, height = 0): Vec {
  const scale = pixelsPerUnit(camera.zoom);
  const dx = tile.x - camera.focus.x;
  const dz = tile.y - camera.focus.y;
  return {
    x: camera.width / 2 + ((dx - dz) * scale) / Math.SQRT2,
    y:
      camera.height / 2 +
      (((dx + dz) * Math.sin(ELEVATION)) / Math.SQRT2) * scale -
      height * Math.cos(ELEVATION) * scale,
  };
}

/** The point on the floor, in tile units, drawn at a screen point (CSS px). */
export function screenToTile(camera: WorldCamera, screen: Vec): Vec {
  const scale = pixelsPerUnit(camera.zoom);
  const across = ((screen.x - camera.width / 2) * Math.SQRT2) / scale;
  const down =
    ((screen.y - camera.height / 2) * Math.SQRT2) /
    (scale * Math.sin(ELEVATION));
  return {
    x: camera.focus.x + (down + across) / 2,
    y: camera.focus.y + (down - across) / 2,
  };
}

/** Points three.js's camera as `camera` says, to draw what the maths draws. */
export function placeCamera(three: OrthographicCamera, camera: WorldCamera) {
  const scale = pixelsPerUnit(camera.zoom);
  three.left = -camera.width / 2 / scale;
  three.right = camera.width / 2 / scale;
  three.top = camera.height / 2 / scale;
  three.bottom = -camera.height / 2 / scale;
  three.updateProjectionMatrix();
  // Far enough back to see over the Walls, along the diagonal.
  const back = 30;
  const flat = (Math.cos(ELEVATION) / Math.SQRT2) * back;
  three.position.set(
    camera.focus.x + flat,
    Math.sin(ELEVATION) * back,
    camera.focus.y + flat,
  );
  three.lookAt(camera.focus.x, 0, camera.focus.y);
  three.updateMatrixWorld();
}
