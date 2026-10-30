import { boneAltarTuning } from "../tuning/boneAltars";
import type { Vec } from "./vec";
import type { MonsterId } from "./world";

/**
 * A Prop with Life that raises Monsters beside it, until the Hero's side
 * destroys it. It shares the Monsters' ids, so an `Attack` order can name it,
 * and blocks the tile it stands on while it stands.
 */
export type BoneAltar = {
  /** Unique within the World, apart from Monsters' ids, and never reused. */
  id: MonsterId;
  /** The middle of its tile. */
  pos: Vec;
  life: number;
  /** The Monsters it raised, living or not yet found dead. */
  raised: MonsterId[];
  /** Steps left before it raises the next Monster. */
  cooldown: number;
};

/** Whether a target of the Hero's side is a Bone Altar, not a Monster. */
export function isBoneAltar(target: { id: MonsterId }): target is BoneAltar {
  return "raised" in target;
}

/** How big a target is: a Bone Altar's radius, a Monster's none (tiles). */
export function altarRadiusOf(target: { id: MonsterId }): number {
  return isBoneAltar(target) ? boneAltarTuning.radius : 0;
}
