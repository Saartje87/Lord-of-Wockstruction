import { itemColour } from "../render/itemArt";
import { ITEM_TYPES, type ItemType } from "../tuning/items";
import type { ProjectileKind } from "../tuning/projectiles";
import type { GroundItemView, ProjectileView } from "./view";

/** The stand-in for Item kinds KayKit has no model for: a small gem. */
export const GEM = "gem";

/** Rotations (radians, x then y then z) that lay a model's long side flat. */
type Lay = [number, number, number];

/**
 * How one kind of thing is drawn: the model to instance (a file under
 * `public/assets/models/`, or `GEM`), how big (scene units per model unit),
 * how it is laid, and the tint multiplied onto its texture if any.
 */
export type Look = {
  model: string;
  scale: number;
  lay: Lay;
  tint: number | null;
};

const FLAT: Lay = [-Math.PI / 2, 0, 0];

/** How each Item type lies on the floor. */
export const LOOT_LOOKS: Record<ItemType, Look> = {
  shortSword: {
    model: "loot/sword_1handed",
    scale: 0.4,
    lay: FLAT,
    tint: null,
  },
  axe: { model: "loot/axe_1handed", scale: 0.4, lay: FLAT, tint: null },
  // Armour is a shield for now: the kit has no armour to lay down.
  leatherArmour: {
    model: "loot/shield_round",
    scale: 0.45,
    lay: FLAT,
    tint: null,
  },
  chainMail: {
    model: "loot/shield_spikes",
    scale: 0.45,
    lay: FLAT,
    tint: null,
  },
  ring: { model: GEM, scale: 1, lay: [0, 0, 0], tint: null },
  amulet: { model: GEM, scale: 1.3, lay: [0, 0, 0], tint: null },
  sash: { model: GEM, scale: 1.1, lay: [0, 0, 0], tint: null },
  heavyBelt: { model: GEM, scale: 1.1, lay: [0, 0, 0], tint: null },
  platedBelt: { model: GEM, scale: 1.1, lay: [0, 0, 0], tint: null },
  lifePotion: {
    model: "loot/bottle_A_brown",
    scale: 0.5,
    lay: [0, 0, 0],
    tint: 0xff5a5a,
  },
  manaPotion: {
    model: "loot/bottle_C_brown",
    scale: 0.5,
    lay: [0, 0, 0],
    tint: 0x6a8cff,
  },
  rejuvenationPotion: {
    model: "loot/bottle_B_green",
    scale: 0.5,
    lay: [0, 0, 0],
    tint: 0xc070ff,
  },
};

/** How a Projectile flies: the model, and the pale glow and trail if any. */
export type ProjectileLook = Look & {
  /** How high above the floor it flies, in tiles. */
  height: number;
  /** The colour it glows, if it does. */
  glow: number | null;
  /** How many ghosts of it follow, each smaller and further back. */
  trail: number;
};

/**
 * The arrow's long side is its y axis, its point at -y (fletching at +y), so
 * it is laid with -y towards the flight. The bone's long side is its x axis.
 */
export const PROJECTILE_LOOKS: Record<ProjectileKind, ProjectileLook> = {
  arrow: {
    model: "loot/arrow",
    scale: 0.6,
    lay: [-Math.PI / 2, 0, 0],
    tint: null,
    height: 0.8,
    glow: null,
    trail: 0,
  },
  boneSpear: {
    model: "halloween/bone_A",
    scale: 1.1,
    lay: [0, -Math.PI / 2, 0],
    tint: null,
    height: 0.9,
    glow: 0x8fb4c8,
    trail: 3,
  },
};

/** The models the loot and Projectiles are drawn with, to load. */
export const LOOT_MODELS: string[] = [
  ...new Set(
    [
      ...ITEM_TYPES.map((type) => LOOT_LOOKS[type].model),
      ...Object.values(PROJECTILE_LOOKS).map((look) => look.model),
    ].filter((model) => model !== GEM),
  ),
];

/** One thing to draw: an instance of a model. */
export type Placement = {
  /** Which look: the model, and so the instanced mesh it joins. */
  model: string;
  /** Tile units. */
  x: number;
  y: number;
  /** Above the floor, in tiles. */
  height: number;
  /** Radians about the vertical. */
  yaw: number;
  /** Multiplied onto the look's scale. */
  scale: number;
  /** Multiplied onto the texture. */
  tint: number | null;
  /** The look's `lay`, so the mesh can lay the instance flat. */
  lay: Lay;
  /** The look's scale. */
  base: number;
};

/** How far apart a trail's ghosts are, in tiles. */
const TRAIL_GAP = 0.32;

/** How high a Ground Item's model sits on the floor, in tiles. */
const LYING_HEIGHT = 0.04;

/** A Ground Item as a model on the floor, turned a different way each. */
export function groundPlacement(item: GroundItemView): Placement {
  const look = LOOT_LOOKS[item.type];
  return {
    model: look.model,
    x: item.pos.x,
    y: item.pos.y,
    height: LYING_HEIGHT,
    yaw: item.id * 2.399,
    scale: 1,
    tint: look.model === GEM ? itemColour(item.type) : look.tint,
    lay: look.lay,
    base: look.scale,
  };
}

/**
 * A Projectile flying head first, and the ghosts of a trail behind it, each
 * smaller than the one before.
 */
export function projectilePlacements(projectile: ProjectileView): Placement[] {
  const look = PROJECTILE_LOOKS[projectile.kind];
  const along = {
    x: Math.cos(projectile.facing),
    y: Math.sin(projectile.facing),
  };
  const placements: Placement[] = [];
  for (let i = 0; i <= look.trail; i++) {
    placements.push({
      model: look.model,
      x: projectile.pos.x - along.x * TRAIL_GAP * i,
      y: projectile.pos.y - along.y * TRAIL_GAP * i,
      height: look.height,
      yaw: Math.PI / 2 - projectile.facing,
      scale: 1 - i / (look.trail + 1),
      tint: look.tint,
      lay: look.lay,
      base: look.scale,
    });
  }
  return placements;
}

/** The glow of a model drawn as a Projectile, if it is one that glows. */
export function glowOf(model: string): number | null {
  return (
    Object.values(PROJECTILE_LOOKS).find((look) => look.model === model)
      ?.glow ?? null
  );
}
