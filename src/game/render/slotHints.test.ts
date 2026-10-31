import { describe, expect, it } from "vitest";
import { EQUIPMENT_SLOTS } from "../sim/inventory";
import { inside } from "../sim/rect";
import { inventoryPanelLayout } from "./inventoryPanel";
import { slotHintPolygons } from "./slotHints";

const WIDE = {
  width: 1280,
  height: 800,
  uiScale: 1,
  worldZoom: 1,
  compact: false,
  rotateNotice: null,
};

describe("the outlines hinting at what an empty slot takes", () => {
  it("are drawn for every Equipment slot, inside it", () => {
    const { slots } = inventoryPanelLayout(WIDE, 1);

    for (const slot of EQUIPMENT_SLOTS) {
      const polygons = slotHintPolygons(slot, slots[slot]);
      expect(polygons.length, slot).toBeGreaterThan(0);
      for (const flat of polygons) {
        expect(flat.length, slot).toBeGreaterThanOrEqual(6);
        for (let i = 0; i < flat.length; i += 2) {
          expect(
            inside(slots[slot], { x: flat[i], y: flat[i + 1] }),
            slot,
          ).toBe(true);
        }
      }
    }
  });

  it("differ between slots of different kinds", () => {
    const rect = { x: 0, y: 0, w: 40, h: 40 };
    const shapes = EQUIPMENT_SLOTS.filter((slot) => slot !== "ring2").map(
      (slot) => JSON.stringify(slotHintPolygons(slot, rect)),
    );

    expect(new Set(shapes).size).toBe(shapes.length);
  });
});
