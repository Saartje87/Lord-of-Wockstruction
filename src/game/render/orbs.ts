import type { Rect } from "../sim/rect";
import { maxLife, maxMana, type SimEvent, type World } from "../sim/world";
import { atUiScale, type Viewport } from "../viewport";

/** The Hero's two orbs: Life at the bottom left, Mana at the bottom right. */
export type Orb = "life" | "mana";

/**
 * The stone strip along the bottom of the screen and the orbs on it (CSS px
 * at native scale, drawn at the UI Scale): the strip `strip` tall with an
 * `edge` along its top, and each orb `radius` across inside a stone rim
 * `rim` wide, `side` from the screen's side and `bottom` from its bottom
 * to the rim.
 */
export const ORBS = {
  strip: 34,
  edge: 2,
  radius: 52,
  rim: 8,
  side: 24,
  bottom: 10,
};

/** Where an orb is drawn: its centre, its radius and its rim's width. */
export type OrbCircle = { x: number; y: number; radius: number; rim: number };

/**
 * Where the stone strip and the orbs are drawn: the strip across the
 * bottom, the Life orb on it at the left and the Mana orb mirroring it at
 * the right.
 */
export function orbsLayout(screen: Viewport): {
  strip: Rect;
  edge: number;
  life: OrbCircle;
  mana: OrbCircle;
} {
  const { strip, edge, radius, rim, side, bottom } = atUiScale(
    ORBS,
    screen.uiScale,
  );
  const y = screen.height - bottom - rim - radius;
  const lifeX = side + rim + radius;
  return {
    strip: { x: 0, y: screen.height - strip, w: screen.width, h: strip },
    edge,
    life: { x: lifeX, y, radius, rim },
    mana: { x: screen.width - lifeX, y, radius, rim },
  };
}

/** How full an orb shows (0..1): the Hero's current over max Life or Mana. */
export function orbFill(world: World, orb: Orb): number {
  const [current, max] =
    orb === "life"
      ? [world.hero.life, maxLife(world)]
      : [world.hero.mana, maxMana(world)];
  return Math.min(1, Math.max(0, current / max));
}

/**
 * How far round the Life orb its Bone Ward ring goes (0..1): what is left of
 * the Hero's Bone Ward over what it held when filled, or null without one.
 */
export function wardFill(world: World): number | null {
  const { boneWard } = world.hero;
  if (!boneWard) return null;
  return Math.min(1, Math.max(0, boneWard.left / boneWard.full));
}

/** How long the Bone Ward ring's pulse lasts (ms). */
export const WARD_PULSE = { ms: 250 };

/**
 * What a step's events show of the Hero being hit: the red hurt flash if some
 * damage reached Life, and a pulse on the Bone Ward ring if it soaked any.
 * A Miss shows neither.
 */
export function heroHitShows(events: readonly SimEvent[]): {
  hurt: boolean;
  pulses: boolean;
} {
  let hurt = false;
  let pulses = false;
  for (const event of events) {
    if (event.type !== "HeroHit") continue;
    if (event.damage > 0) hurt = true;
    if (event.warded > 0) pulses = true;
  }
  return { hurt, pulses };
}

/** How bright a Bone Ward pulse is (1..0) `sinceMs` after it began. */
export function wardPulseBrightness(sinceMs: number): number {
  return Math.min(1, Math.max(0, 1 - sinceMs / WARD_PULSE.ms));
}
