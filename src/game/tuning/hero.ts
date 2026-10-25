/** Hero tuning, in human units. The sim converts it to steps once. */
export type HeroTuning = {
  /** Life at full health at Level 1. */
  life: number;
  /** Max Life added by each new Level. */
  lifePerLevel: number;
  /**
   * The total Experience each Level needs, from Level 1 (always 0) up to the
   * last Level, the cap.
   */
  experienceTable: readonly number[];
  /** Tiles per second. */
  walkSpeed: number;
  /** How far the Hero keeps from walls when cutting corners (tiles). */
  radius: number;
  /** How long one swing takes (ms). */
  swingMs: number;
  /** How far into a swing its hit lands, as a fraction of `swingMs`. */
  hitAt: number;
  /** How near a Monster must be to swing at it (tiles, centre to centre). */
  reach: number;
  /**
   * How much further a Monster an `Attack` swings at may get before the hit
   * lands, and still be hit (tiles).
   */
  reachGrace: number;
  /** A `SwingAt` hits every Monster in reach within this of the facing. */
  arcDegrees: number;
  /** Damage per hit, rolled from `[min, max]` inclusive. */
  damage: [number, number];
  /** Dexterity a fresh Hero starts with. */
  dexterity: number;
  /** Attack Rating each point of Dexterity gives. */
  attackRatingPerDexterity: number;
  /** How long the whole simulation pauses when a swing lands a hit (ms). */
  hitstopMs: number;
  /** The chance a Monster's hit makes the Hero flinch. */
  flinchChance: number;
  /** How long a flinch roots the Hero (ms). */
  flinchMs: number;
  /** How long dealing or taking damage keeps the Hero In Combat (ms). */
  combatMs: number;
  /** Life regained per second outside In Combat. */
  regenPerSecond: number;
  /**
   * How long the Hero lies dead before `Continue` takes them back to Town
   * (ms). The death screen darkens over it.
   */
  deathMs: number;
};

export const heroTuning: HeroTuning = {
  life: 100,
  lifePerLevel: 2,
  experienceTable: [
    // Diablo 2's table, which takes 5 Skeletons to Level 2.
    0, 500, 1_500, 3_750, 7_875, 14_175, 22_680, 32_886, 44_396, 57_715, 72_144,
    90_180, 112_725, 140_906, 176_132, 220_165, 275_207, 344_008, 430_010,
    537_513, 671_891, 839_864, 1_049_830, 1_312_287, 1_640_359, 2_050_449,
    2_563_061, 3_203_826, 3_902_260, 4_663_553, 5_493_363, 6_397_855, 7_383_752,
    8_458_379, 9_629_723, 10_906_488, 12_298_162, 13_815_086, 15_468_534,
    17_270_791, 19_235_252, 21_376_515, 23_710_491, 26_254_525, 29_027_522,
    32_050_088, 35_344_686, 38_935_798, 42_850_109, 47_116_709, 51_767_302,
    56_836_449, 62_361_819, 68_384_473, 74_949_165, 82_104_680, 89_904_191,
    98_405_658, 107_672_256, 117_772_849, 128_782_495, 140_783_010, 153_863_570,
    168_121_381, 183_662_396, 200_602_101, 219_066_380, 239_192_444,
    261_129_853, 285_041_630, 311_105_466, 339_515_048, 370_481_492,
    404_234_916, 441_026_148, 481_128_591, 524_840_254, 572_485_967,
    624_419_793, 681_027_665, 742_730_244, 809_986_056, 883_294_891,
    963_201_521, 1_050_299_747, 1_145_236_814, 1_248_718_217, 1_361_512_946,
    1_484_459_201, 1_618_470_619, 1_764_543_065, 1_923_762_030, 2_097_310_703,
    2_286_478_756, 2_492_671_933, 2_717_422_497, 2_962_400_612, 3_229_426_756,
    3_520_485_254,
  ],
  walkSpeed: 5.5,
  radius: 0.3,
  swingMs: 350,
  hitAt: 0.4,
  reach: 1.0,
  reachGrace: 0.3,
  arcDegrees: 50,
  damage: [20, 30],
  dexterity: 20,
  attackRatingPerDexterity: 5,
  hitstopMs: 60,
  flinchChance: 0.25,
  flinchMs: 150,
  combatMs: 5000,
  regenPerSecond: 2,
  deathMs: 1000,
};
