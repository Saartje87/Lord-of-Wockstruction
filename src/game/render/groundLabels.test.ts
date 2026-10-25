import { describe, expect, it } from "vitest";
import { GROUND_LABEL, groundLabelAt, groundLabels } from "./groundLabels";

const { height, gap, above } = GROUND_LABEL;

describe("groundLabels", () => {
  it("centres a label over its Ground Item", () => {
    const [label] = groundLabels([
      { id: 1, at: { x: 100, y: 200 }, width: 60 },
    ]);

    expect(label).toEqual({
      id: 1,
      rect: { x: 70, y: 200 - above - height, w: 60, h: height },
    });
  });

  it("stacks labels that would overlap, the nearest lowest", () => {
    const labels = groundLabels([
      { id: 1, at: { x: 100, y: 200 }, width: 60 },
      { id: 2, at: { x: 110, y: 204 }, width: 60 },
      { id: 3, at: { x: 400, y: 200 }, width: 60 },
    ]);
    const top = (id: number) => labels.find((l) => l.id === id)?.rect.y;

    expect(top(2)).toBe(204 - above - height);
    expect(top(1)).toBe(204 - above - height - gap - height);
    expect(top(3)).toBe(200 - above - height);
  });
});

describe("groundLabelAt", () => {
  it("is the Ground Item whose label is under the point, or null", () => {
    const labels = groundLabels([{ id: 1, at: { x: 100, y: 200 }, width: 60 }]);

    expect(groundLabelAt(labels, { x: 100, y: 200 - above - 1 })).toBe(1);
    expect(groundLabelAt(labels, { x: 100, y: 200 })).toBeNull();
    expect(groundLabelAt(labels, { x: 20, y: 190 })).toBeNull();
  });
});
