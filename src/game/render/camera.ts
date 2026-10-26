import type { Vec } from "../sim/vec";
import type { Viewport } from "../viewport";

/**
 * Where the World is drawn on the screen: the screen point (CSS px) the
 * World's origin lands on, and the World zoom it's drawn at. Points "on the
 * World" are in the World's own pixels, as `toScreen` gives them, before the
 * zoom.
 */
export type Camera = { x: number; y: number; zoom: number };

/**
 * The camera with `focus`, a point on the World, at the centre of the
 * screen, at the viewport's World zoom. It sits on whole device pixels for a
 * canvas of `resolution` device pixels per CSS px, so the art stays crisp.
 */
export function cameraOn(
  viewport: Viewport,
  focus: Vec,
  resolution: number,
): Camera {
  const zoom = viewport.worldZoom;
  const snap = (v: number) => Math.round(v * resolution) / resolution;
  return {
    x: snap(viewport.width / 2 - focus.x * zoom),
    y: snap(viewport.height / 2 - focus.y * zoom),
    zoom,
  };
}

/** Where a point on the World is drawn on the screen (CSS px). */
export function onScreen(camera: Camera, at: Vec): Vec {
  return { x: camera.x + at.x * camera.zoom, y: camera.y + at.y * camera.zoom };
}

/** The point on the World drawn at a point on the screen (CSS px). */
export function onWorld(camera: Camera, screen: Vec): Vec {
  return {
    x: (screen.x - camera.x) / camera.zoom,
    y: (screen.y - camera.y) / camera.zoom,
  };
}
