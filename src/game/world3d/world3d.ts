import {
  Color,
  OrthographicCamera,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";

/**
 * The 3D World's three.js side. Its renderer owns the canvas and the WebGL
 * context, which Pixi shares to draw the HUD on top (ADR 0004).
 */
export type World3d = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
};

/** The dark the 3D World is drawn on. */
const BACKGROUND = 0x07060b;

/** Creates the 3D World's renderer, its canvas and an empty scene. */
export function createWorld3d(): World3d {
  // Pixi needs the stencil buffer for its masks.
  const renderer = new WebGLRenderer({ antialias: true, stencil: true });
  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  return { renderer, scene, camera };
}

/** The size three.js last drew at, reused each frame. */
const drawnSize = new Vector2();

/**
 * Draws the 3D World into the shared canvas, `width` × `height` CSS px at
 * `resolution`, as Pixi sized it. Pixi then draws the HUD over it.
 */
export function drawWorld3d(
  world3d: World3d,
  width: number,
  height: number,
  resolution: number,
) {
  const { renderer, scene, camera } = world3d;
  if (renderer.getPixelRatio() !== resolution) {
    renderer.setPixelRatio(resolution);
  }
  // Pixi owns the canvas's size and style, so three.js only follows it.
  const size = renderer.getSize(drawnSize);
  if (size.x !== width || size.y !== height) {
    renderer.setSize(width, height, false);
  }
  renderer.resetState();
  renderer.render(scene, camera);
}

/** The WebGL context Pixi shares to draw the HUD over the 3D World. */
export function contextOf(world3d: World3d): WebGL2RenderingContext {
  // three.js only creates WebGL2 contexts, though its type allows WebGL1.
  return world3d.renderer.getContext() as WebGL2RenderingContext;
}

/** What the 3D World drew last frame, for the stats panel. */
export function drawnBy(world3d: World3d) {
  const { calls, triangles } = world3d.renderer.info.render;
  return { calls, triangles };
}

/**
 * Frees the 3D World's renderer and its WebGL context, once Pixi is done
 * with it, so remounts don't pile up contexts.
 */
export function disposeOf(world3d: World3d) {
  world3d.renderer.dispose();
  world3d.renderer.forceContextLoss();
}
