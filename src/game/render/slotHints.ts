import type { EquipmentSlot } from "../sim/inventory";
import type { Rect } from "../sim/rect";

/** A point in a slot's own box: 0 to 1 across and down. */
type Unit = [number, number];

/** A band: the hint of both Ring slots. */
const RING: readonly Unit[][] = [
  [
    [0.3, 0.4],
    [0.4, 0.3],
    [0.6, 0.3],
    [0.7, 0.4],
    [0.7, 0.6],
    [0.6, 0.7],
    [0.4, 0.7],
    [0.3, 0.6],
  ],
];

/**
 * The faint outline an empty Equipment slot draws to hint at its kind, as
 * closed polygons in the slot's own box (0 to 1 across and down), drawn
 * centred and kept in proportion by `slotHintPolygons`.
 */
export const SLOT_HINTS: Record<EquipmentSlot, readonly Unit[][]> = {
  // A rounded dome over a brim.
  helm: [
    [
      [0.2, 0.7],
      [0.2, 0.4],
      [0.3, 0.22],
      [0.5, 0.15],
      [0.7, 0.22],
      [0.8, 0.4],
      [0.8, 0.7],
      [0.65, 0.7],
      [0.65, 0.55],
      [0.35, 0.55],
      [0.35, 0.7],
    ],
  ],
  // A blade over a crossguard.
  weapon: [
    [
      [0.47, 0.1],
      [0.53, 0.1],
      [0.53, 0.68],
      [0.65, 0.68],
      [0.65, 0.74],
      [0.53, 0.74],
      [0.53, 0.9],
      [0.47, 0.9],
      [0.47, 0.74],
      [0.35, 0.74],
      [0.35, 0.68],
      [0.47, 0.68],
    ],
  ],
  // A heater shield.
  offHand: [
    [
      [0.22, 0.15],
      [0.78, 0.15],
      [0.78, 0.5],
      [0.65, 0.72],
      [0.5, 0.85],
      [0.35, 0.72],
      [0.22, 0.5],
    ],
  ],
  // A tunic with sleeves.
  armour: [
    [
      [0.3, 0.12],
      [0.7, 0.12],
      [0.9, 0.25],
      [0.8, 0.45],
      [0.7, 0.4],
      [0.7, 0.88],
      [0.3, 0.88],
      [0.3, 0.4],
      [0.2, 0.45],
      [0.1, 0.25],
    ],
  ],
  // A mitten with a thumb.
  gloves: [
    [
      [0.3, 0.85],
      [0.3, 0.45],
      [0.18, 0.4],
      [0.2, 0.28],
      [0.34, 0.34],
      [0.34, 0.15],
      [0.66, 0.15],
      [0.66, 0.85],
    ],
  ],
  // A boot in profile.
  boots: [
    [
      [0.3, 0.12],
      [0.62, 0.12],
      [0.62, 0.55],
      [0.85, 0.65],
      [0.85, 0.85],
      [0.3, 0.85],
    ],
  ],
  // A flat strap with a buckle.
  belt: [
    [
      [0.08, 0.35],
      [0.92, 0.35],
      [0.92, 0.65],
      [0.08, 0.65],
    ],
    [
      [0.42, 0.28],
      [0.58, 0.28],
      [0.58, 0.72],
      [0.42, 0.72],
    ],
  ],
  // A pendant on a chain.
  amulet: [
    [
      [0.5, 0.5],
      [0.62, 0.62],
      [0.5, 0.82],
      [0.38, 0.62],
    ],
    [
      [0.3, 0.15],
      [0.5, 0.45],
      [0.7, 0.15],
      [0.66, 0.12],
      [0.5, 0.36],
      [0.34, 0.12],
    ],
  ],
  ring1: RING,
  ring2: RING,
};

/**
 * The hint polygons of `slot` placed in `rect`, as flat `[x, y, x, y, …]`
 * point lists in screen px. The hints are drawn square, centred in the slot,
 * so they keep their proportions in tall slots.
 */
export function slotHintPolygons(slot: EquipmentSlot, rect: Rect): number[][] {
  const side = Math.min(rect.w, rect.h);
  const left = rect.x + (rect.w - side) / 2;
  const top = rect.y + (rect.h - side) / 2;
  return SLOT_HINTS[slot].map((polygon) =>
    polygon.flatMap(([x, y]) => [left + x * side, top + y * side]),
  );
}
