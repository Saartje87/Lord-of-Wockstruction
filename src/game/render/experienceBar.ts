import { levelExperience, nextLevelExperience } from "../sim/world";

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
