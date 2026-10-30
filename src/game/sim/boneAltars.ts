import { boneAltarTuning } from "../tuning/boneAltars";
import type { Vec } from "./vec";
import type { Monster, MonsterId, World } from "./world";

/**
 * A Prop with Life that raises Monsters beside it, until the Hero's side
 * destroys it. It shares the Monsters' ids, so an `Attack` order can name it,
 * and blocks the tile it stands on while it stands.
 */
export type BoneAltar = {
  kind: "boneAltar";
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

/** Every target of the Hero's side: the Monsters and the Bone Altars. */
export function targetsOf(world: World): (Monster | BoneAltar)[] {
  return [...world.monsters, ...world.boneAltars];
}

/** Whether a target of the Hero's side is a Bone Altar, not a Monster. */
export function isBoneAltar(target: Monster | BoneAltar): target is BoneAltar {
  return target.kind === "boneAltar";
}

/** How big a target is: a Bone Altar's radius, a Monster's none (tiles). */
export function altarRadiusOf(target: Monster | BoneAltar): number {
  return isBoneAltar(target) ? boneAltarTuning.radius : 0;
}
