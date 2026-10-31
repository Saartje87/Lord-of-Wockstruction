import type { Resistances } from "./damage";
import type { Rarity } from "./items";

/** How much tougher a Unique Monster is than its Monster type, and what it drops. */
export const uniqueTuning = {
  /**
   * Times its type's max Life at the same Monster Level; the Act Boss has his
   * own (`graveWockingtonTuning.life`). Tuned so a Hero just arrived at the
   * Spa kills Bruckle in 45–60 s of steady melee (T552).
   */
  life: 1.4,
  /** Times its type's damage range at the same Monster Level. */
  damage: 1.5,
  /** Times its type's Attack Rating at the same Monster Level. */
  attackRating: 1.25,
  /** Times its type's Experience at the same Monster Level. */
  experience: 5,
  /** Times its type's scale in the 3D World, on top of that scale. */
  scale: 1.2,
  /**
   * A Unique Monster's own Resistances by its name, instead of its Monster
   * type's; one missing here uses its type's.
   */
  resistances: {} as Record<string, Resistances>,
  /**
   * The Items it always drops on its death instead of an ordinary Monster's
   * single Item chance, in turn: each lists the Rarities it may roll, from
   * the same Items as an ordinary Monster's. Its Potion drop is as usual.
   */
  itemDrops: [["rare"], ["magic", "rare"]] as readonly (readonly Rarity[])[],
};
