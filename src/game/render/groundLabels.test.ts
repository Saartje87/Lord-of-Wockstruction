import { describe, expect, it } from "vitest";
import {
  GROUND_LABEL,
  groundItemUnder,
  groundLabelAt,
  groundLabels,
} from "./groundLabels";

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

describe("groundItemUnder", () => {
  const lying = [
    { id: 1, at: { x: 100, y: 200 } },
    { id: 2, at: { x: 104, y: 206 } },
  ];

  it("is the Ground Item drawn under the point, the nearest one in front", () => {
    expect(groundItemUnder(lying, { x: 92, y: 194 }, 10)).toBe(1);
    expect(groundItemUnder(lying, { x: 112, y: 214 }, 10)).toBe(2);
    expect(groundItemUnder(lying, { x: 102, y: 203 }, 10)).toBe(2);
  });

  it("is null away from them all", () => {
    expect(groundItemUnder(lying, { x: 100, y: 180 }, 10)).toBeNull();
    expect(groundItemUnder([], { x: 100, y: 200 }, 10)).toBeNull();
  });
});
