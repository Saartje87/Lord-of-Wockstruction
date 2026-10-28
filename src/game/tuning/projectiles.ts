/** The Projectiles Monsters and Skills loose, each with its own art. */
export const PROJECTILE_KINDS = ["arrow", "boneSpear"] as const;

/** One kind of Projectile. */
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number];
