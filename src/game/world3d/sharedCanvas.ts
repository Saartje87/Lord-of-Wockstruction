/** The canvas and WebGL context Pixi and the 3D World draw on together. */
export type SharedCanvas = {
  canvas: HTMLCanvasElement;
  context: WebGL2RenderingContext;
};

/**
 * Makes the canvas and context up front, so choosing the 3D World later
 * doesn't need them swapped: Pixi draws the HUD into them from the start
 * and three.js joins in when the 3D World is first chosen (ADR 0004). Null
 * where the browser has no WebGL 2, and then Pixi makes its own.
 */
export function createSharedCanvas(): SharedCanvas | null {
  const canvas = document.createElement("canvas");
  // Pixi needs the stencil buffer for its masks; the 3D World wants
  // antialiasing, which only a context's creation can ask for.
  const context = canvas.getContext("webgl2", {
    antialias: true,
    stencil: true,
    alpha: false,
  });
  return context && { canvas, context };
}
