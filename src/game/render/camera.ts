import type { Vec } from "../sim/vec";
import { viewportTuning } from "../tuning/viewport";
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
 * screen, at about the viewport's World zoom. It sits on whole device pixels
 * for a canvas of `resolution` device pixels per CSS px, and draws each of
 * the World's pixels over a whole number of them, so the art stays crisp.
 */
export function cameraOn(
  viewport: Viewport,
  focus: Vec,
  resolution: number,
): Camera {
  const zoom = crispZoom(viewport.worldZoom, resolution);
  const snap = (value: number) => Math.round(value * resolution) / resolution;
  return {
    x: snap(viewport.width / 2 - focus.x * zoom),
    y: snap(viewport.height / 2 - focus.y * zoom),
    zoom,
  };
}

/**
 * The zoom nearest `zoom` that draws each of the World's pixels over a whole
 * number of device pixels, at `resolution` device pixels per CSS px, within
 * the tuned World zoom limits. Where under one device pixel, or no whole
 * number fits the limits, `zoom` itself.
 */
function crispZoom(zoom: number, resolution: number): number {
  const { minWorldZoom, maxWorldZoom } = viewportTuning;
  if (zoom * resolution < 1) return zoom;
  const devicePixels = Math.min(
    Math.floor(maxWorldZoom * resolution),
    Math.max(
      Math.ceil(minWorldZoom * resolution),
      Math.round(zoom * resolution),
    ),
  );
  const crisp = devicePixels / resolution;
  return crisp >= minWorldZoom && crisp <= maxWorldZoom ? crisp : zoom;
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
