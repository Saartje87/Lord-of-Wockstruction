import { TILE_WIDTH, toScreen } from "../iso";
import type { Vec } from "../sim/vec";
import { townPortalLook } from "../tuning/townPortalLook";

/** One square pixel of a Town Portal, from its foot (CSS px at native scale). */
export type PortalPixel = { x: number; y: number; colour: number };

/** A spark in flight, from the Town Portal's foot (CSS px at native scale). */
export type PortalSpark = { x: number; y: number; alpha: number };

/** One ring of the glow on the floor round a Town Portal's foot (CSS px). */
export type PortalGlowRing = {
  radiusX: number;
  radiusY: number;
  alpha: number;
};

/**
 * How big a Town Portal is `ms` after it opened, as a share of its full size:
 * bursting out of a point, springing past full size by up to about
 * `overshoot`, and settling at full size once `openMs` have passed.
 */
export function townPortalOpenScale(ms: number): number {
  const { openMs, overshoot } = townPortalLook;
  if (ms >= openMs) return 1;
  const t = Math.max(0, ms) / openMs;
  return 1 - (1 - t) ** 3 + overshoot * Math.sin(Math.PI * t);
}

/**
 * How big a Town Portal is `ms` after it closed, as a share of its full
 * size: shrinking slowly at first, then faster, to nothing once `closeMs`
 * have passed.
 */
export function townPortalCloseScale(ms: number): number {
  const { closeMs } = townPortalLook;
  if (ms >= closeMs) return 0;
  return (1 - Math.max(0, ms) / closeMs) ** 2;
}

/** How wide and tall a Town Portal's oval is at full size (CSS px). */
function ovalSize(): { width: number; height: number } {
  const width = townPortalLook.width * TILE_WIDTH;
  return { width, height: width * townPortalLook.tallness };
}

/**
 * The square pixels of a Town Portal's oval at `scale` of its full size and
 * `nowMs`, standing on its foot: a dark rim round a spiral swirl of dark and
 * bright bands turning inwards, a lighter core, all pulsing gently.
 */
export function townPortalPixels(scale: number, nowMs: number): PortalPixel[] {
  const look = townPortalLook;
  const seconds = nowMs / 1000;
  const pulse =
    1 + look.pulse * Math.sin(2 * Math.PI * look.pulsesPerSecond * seconds);
  const { width, height } = ovalSize();
  const halfWidth = (width / 2) * scale * pulse;
  const halfHeight = (height / 2) * scale * pulse;
  const size = look.pixel;
  const pixels: PortalPixel[] = [];
  if (halfWidth < size / 2) return pixels;
  const middleY = -height / 2;
  const turn = 2 * Math.PI * look.swirlTurnsPerSecond * seconds;
  const columns = Math.ceil(halfWidth / size);
  const rows = Math.ceil(halfHeight / size);
  for (let row = -rows; row < rows; row++) {
    for (let column = -columns; column < columns; column++) {
      const x = (column + 0.5) * size;
      const y = (row + 0.5) * size;
      const radius = Math.hypot(x / halfWidth, y / halfHeight);
      if (radius > 1) continue;
      const angle = Math.atan2(y / halfHeight, x / halfWidth);
      pixels.push({
        x: column * size,
        y: middleY * scale + row * size,
        colour: swirlColour(radius, angle, turn),
      });
    }
  }
  return pixels;
}

/**
 * The colour of the swirl `radius` out from the middle (0..1) at `angle`,
 * the swirl having turned `turn` radians.
 */
function swirlColour(radius: number, angle: number, turn: number): number {
  const { colours, arms, twist, coreSize } = townPortalLook;
  if (radius > 0.88) return colours.rim;
  if (radius < coreSize * 0.6) return colours.core;
  const spiral = Math.sin(
    arms * (angle + 2 * Math.PI * twist * radius) - turn * arms,
  );
  if (radius < coreSize) return spiral > -0.3 ? colours.core : colours.bright;
  return spiral > 0.2 ? colours.bright : colours.dark;
}

/**
 * The sparks flung outward from a Town Portal's rim at `nowMs`, at `scale`
 * of its full size: `sparks` always in the air, each fading as it flies, and
 * while it bursts open, `msOpen` after it opened, a splash of
 * `splashSparks` more flung out all round at once.
 */
export function townPortalSparks(
  scale: number,
  nowMs: number,
  msOpen: number,
): PortalSpark[] {
  const look = townPortalLook;
  const { width, height } = ovalSize();
  const reach = look.sparkReach * TILE_WIDTH;
  const middle: Vec = { x: 0, y: (-height / 2) * scale };
  const sparks: PortalSpark[] = [];
  const fling = (angle: number, flown: number) => {
    const rim = {
      x: middle.x + Math.cos(angle) * (width / 2) * scale,
      y: middle.y + Math.sin(angle) * (height / 2) * scale,
    };
    sparks.push({
      x: rim.x + Math.cos(angle) * reach * flown,
      // Falling a little as it flies.
      y: rim.y + Math.sin(angle) * reach * flown + reach * 0.5 * flown ** 2,
      alpha: 1 - flown,
    });
  };
  for (let i = 0; i < look.sparks; i++) {
    // Each spark's own start in its flight, and a new angle every flight.
    const at = nowMs / look.sparkMs + i / look.sparks;
    const flight = Math.floor(at);
    fling(scatter(i, flight) * 2 * Math.PI, at - flight);
  }
  if (msOpen < look.openMs) {
    const flown = Math.max(0, msOpen) / look.openMs;
    for (let i = 0; i < look.splashSparks; i++) {
      fling(
        ((i + scatter(i, -1) * 0.5) / look.splashSparks) * 2 * Math.PI,
        flown,
      );
    }
  }
  return sparks;
}

/** A stable scatter of spark `i`'s `flight`, 0..1, the same every frame. */
function scatter(i: number, flight: number): number {
  const hash = Math.sin(i * 127.1 + flight * 311.7) * 43758.5453;
  return hash - Math.floor(hash);
}

/**
 * The green glow on the floor round a Town Portal's foot at `scale` of its
 * full size: rings flat on the floor, the outermost `glowRadius` tiles out,
 * each drawn over the last so it is brightest at the foot.
 */
export function townPortalGlow(scale: number): PortalGlowRing[] {
  const { glowRadius, glowAlpha } = townPortalLook;
  // A tile-space circle's widest point across the screen.
  const edge = toScreen({
    x: glowRadius * Math.SQRT1_2,
    y: -glowRadius * Math.SQRT1_2,
  });
  const rings = 4;
  return Array.from({ length: rings }, (_, i) => {
    const share = (rings - i) / rings;
    return {
      radiusX: edge.x * share * scale,
      radiusY: (edge.x / 2) * share * scale,
      alpha: (glowAlpha / rings) * scale,
    };
  });
}
