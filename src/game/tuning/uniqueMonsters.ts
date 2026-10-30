/** How much tougher a Unique Monster is than its Monster type, and what it drops. */
export const uniqueTuning = {
  /** Times its type's max Life at the same Monster Level. */
  life: 3,
  /** Times its type's damage range at the same Monster Level. */
  damage: 1.5,
  /** Times its type's Attack Rating at the same Monster Level. */
  attackRating: 1.25,
  /** Times its type's Experience at the same Monster Level. */
  experience: 6,
  /**
   * Item drops on its death, each rolled with its chance in turn from the
   * same Items as an ordinary Monster's; its Potion drop is as usual.
   */
  itemDropChances: [1, 0.5],
};
