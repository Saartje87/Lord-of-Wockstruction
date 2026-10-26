import { inside, type Rect } from "../sim/rect";
import {
  KEYED_SLOTS,
  SKILL_BAR_SLOTS,
  type SkillBarSlot,
  slotKey,
} from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import { skillManaCost, type World } from "../sim/world";
import { beltTuning } from "../tuning/items";
import { skillTuning } from "../tuning/skills";
import { atUiScale, type Viewport } from "../viewport";

/**
 * The Skill Bar, centred along the bottom between the orbs (CSS px at
 * native scale, drawn at the UI Scale): square
 * slots `slot` wide and `gap` apart, the right-click slot `rightGap` past
 * the keyed ones, and the bar's bottom `bottom` over the screen's, clear of
 * the stone strip.
 */
export const SKILL_BAR = { slot: 44, gap: 6, rightGap: 16, bottom: 42 };

/**
 * The HUD's Belt strip (CSS px at native scale, drawn at the UI Scale): one
 * square per Belt Column, as big and as far apart as the Skill Bar's
 * slots, ending `toSkillBar` left of it.
 */
export const BELT_STRIP = { toSkillBar: 16 };

/** The Skill Bar's slots from left to right: keys Q/W/E/R, then right-click. */
const SHOWN_ORDER: readonly SkillBarSlot[] = [...KEYED_SLOTS, "right"];

/** The key shown on a slot. */
function keyLabel(slot: SkillBarSlot): string {
  return slot === "right" ? "RMB" : slotKey(slot);
}

/**
 * Where each slot of the Skill Bar is drawn: centred on the screen, or in
 * the Compact Layout, where the Panel buttons leave the bottom, centred
 * together with the Belt strip, so both fit between the orbs.
 */
export function skillBarLayout(screen: Viewport): {
  slots: Record<SkillBarSlot, Rect>;
} {
  const { slot, gap, rightGap, bottom } = atUiScale(SKILL_BAR, screen.uiScale);
  const keyed = SHOWN_ORDER.length - 1;
  const width = SHOWN_ORDER.length * slot + (keyed - 1) * gap + rightGap;
  const beltStrip = screen.compact
    ? beltTuning.columns * (slot + gap) -
      gap +
      BELT_STRIP.toSkillBar * screen.uiScale
    : 0;
  const left = (screen.width - width - beltStrip) / 2 + beltStrip;
  const y = screen.height - bottom - slot;
  const xOf = (index: number) =>
    left + index * (slot + gap) + (index === keyed ? rightGap - gap : 0);
  return {
    slots: Object.fromEntries(
      SHOWN_ORDER.map((name, index) => [
        name,
        { x: xOf(index), y, w: slot, h: slot },
      ]),
    ) as Record<SkillBarSlot, Rect>,
  };
}

/**
 * What a Skill Bar slot shows: its key, its Skill's name or null when
 * empty, and whether it's dimmed because the Hero lacks the Mana for it or
 * its Skill is the Held Skill.
 */
export type SkillBarSlotSheet = {
  slot: SkillBarSlot;
  key: string;
  name: string | null;
  dimmed: boolean;
};

/**
 * What the Skill Bar shows, slot by slot from left to right. `heldFrom` is
 * the slot the Held Skill was picked up from, if any: it stays filled, as
 * the Skill Bar doesn't change until the Skill lands, but shows dimmed.
 */
export function skillBarSheet(
  world: World,
  heldFrom: SkillBarSlot | null = null,
): SkillBarSlotSheet[] {
  const { progress, mana } = world.hero;
  return SHOWN_ORDER.map((slot) => {
    const skill = progress.skillBar[slot];
    const cost = skill && skillManaCost(skill, progress.skillLevels[skill]);
    return {
      slot,
      key: keyLabel(slot),
      name: skill && skillTuning[skill].name,
      dimmed: (cost !== null && mana < cost) || slot === heldFrom,
    };
  });
}

/** A click on a Skill Bar slot, so not for the World. */
export type SkillBarHit = {
  button: { type: "skillBarSlot"; slot: SkillBarSlot };
};

/** What a click at `point` hits of the Skill Bar, or null off its slots. */
export function skillBarHitAt(
  screen: Viewport,
  point: Vec,
): SkillBarHit | null {
  const { slots } = skillBarLayout(screen);
  const slot = SKILL_BAR_SLOTS.find((name) => inside(slots[name], point));
  return slot ? { button: { type: "skillBarSlot", slot } } : null;
}
