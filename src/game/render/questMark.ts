/**
 * The mark over the head of an NPC with a Quest to give or take back: a
 * golden exclamation mark (CSS px), its bar `barWidth` wide and `barHeight`
 * tall over a dot `dot` across, `gap` apart, its foot `lift` above the NPC's
 * head, bobbing `bob` up and down every `bobMs`, edged `outlineWidth` wide.
 */
export const QUEST_MARK = {
  colour: 0xf2c94c,
  outline: 0x2a1c05,
  outlineWidth: 1.5,
  barWidth: 5,
  barHeight: 12,
  dot: 5,
  gap: 3,
  lift: 8,
  bob: 3,
  bobMs: 1400,
};

/** How far the mark is lifted `ms` into its bobbing (CSS px, up is positive). */
export function questMarkBob(ms: number): number {
  const { bob, bobMs } = QUEST_MARK;
  return (bob * (1 + Math.sin((2 * Math.PI * ms) / bobMs))) / 2;
}
