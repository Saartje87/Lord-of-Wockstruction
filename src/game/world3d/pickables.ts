import type { CharacterId } from "../render/hover";
import type { Vec } from "../sim/vec";
import { npcsIn, type World } from "../sim/world";
import { BONE_ALTAR_HEIGHT } from "./boneAltarMeshes";
import { MINION_LOOKS } from "./minionLook";
import { MONSTER_LOOKS } from "./monsterLook";
import { NPC_LOOKS } from "./npcLook";
import type { Pickable3d } from "./picking";

function between(from: Vec, to: Vec, alpha: number): Vec {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  };
}

/**
 * The living Monsters, Bone Altars and Minions of `world`, `alpha` of the way
 * between steps, each with the height of its model, for picking. A Bone Altar
 * is picked by its id, which an `Attack` order takes like a Monster's.
 */
export function pickablesOf(
  world: World,
  alpha: number,
): Pickable3d<CharacterId>[] {
  return [
    ...world.monsters.map((monster) => ({
      id: monster.id,
      pos: between(monster.prevPos, monster.pos, alpha),
      height: MONSTER_LOOKS[monster.type].height,
    })),
    ...world.boneAltars.map((altar) => ({
      id: altar.id,
      pos: altar.pos,
      height: BONE_ALTAR_HEIGHT,
    })),
    ...world.minions.map((minion) => ({
      id: { minion: minion.id },
      pos: between(minion.prevPos, minion.pos, alpha),
      height: MINION_LOOKS[minion.type].height,
    })),
  ];
}

/**
 * The NPCs of the active Area of `world`, by their index in the Area's
 * `npcs`, each with the height of its model, for picking.
 */
export function npcPickablesOf(world: World): Pickable3d<number>[] {
  return npcsIn(world).map(({ id, name, pos }) => ({
    id,
    pos,
    height: NPC_LOOKS[name].height,
  }));
}
