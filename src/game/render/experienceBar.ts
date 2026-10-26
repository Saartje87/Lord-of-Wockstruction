import type { Rect } from "../sim/rect";
import { levelExperience, nextLevelExperience } from "../sim/world";
import type { Viewport } from "../viewport";
import { orbsLayout } from "./orbs";

/**
 * The Experience bar along the strip between the orbs (CSS px at native
 * scale, drawn at the UI Scale): `gap` from each orb's rim, with `Lv N`
 * before the bar and `current / next` after it, each `textGap` from it.
 */
export const EXPERIENCE_BAR = { gap: 14, height: 6, textGap: 8, textSize: 13 };

/**
 * Where the Experience bar and its words go: along the strip under its
 * edge, between the orbs' rims.
 */
export function experienceBarLayout(screen: Viewport): Rect {
  const { strip, edge, life, mana } = orbsLayout(screen);
  const gap = EXPERIENCE_BAR.gap * screen.uiScale;
  const left = life.x + life.radius + life.rim + gap;
  const right = mana.x - mana.radius - mana.rim - gap;
  const top = strip.y + edge;
  return { x: left, y: top, w: right - left, h: screen.height - top };
}

/**
 * What the Experience bar shows: `Lv N` at its left, the Hero's Experience
 * against what the next Level needs, and how far through the Level they are
 * (0..1). At the last Level it shows full.
 */
export function experienceBar(
  level: number,
  experience: number,
): { level: string; experience: string; fill: number } {
  const from = levelExperience(level);
  // The last Level has no next, so it shows what it needs itself.
  const next = nextLevelExperience(level) ?? from;
  const fill = next > from ? (experience - from) / (next - from) : 1;

  return {
    level: `Lv ${level}`,
    experience: `${thousands(experience)} / ${thousands(next)}`,
    fill: Math.min(1, Math.max(0, fill)),
  };
}

/** A whole number with commas between its thousands, as `1,234,567`. */
function thousands(n: number): string {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
