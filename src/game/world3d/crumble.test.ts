import { describe, expect, it } from "vitest";
import { CRUMBLE_SECONDS, crumbleOf, crumblesAfter } from "./crumble";

describe("crumbleOf", () => {
  it("starts whole and standing", () => {
    expect(crumbleOf(0)).toEqual({ scale: 1, sink: 0 });
  });

  it("shrinks and sinks as it goes", () => {
    const early = crumbleOf(CRUMBLE_SECONDS * 0.25);
    const late = crumbleOf(CRUMBLE_SECONDS * 0.75);
    expect(late.scale).toBeLessThan(early.scale);
    expect(late.sink).toBeGreaterThan(early.sink);
  });

  it("is gone at the end", () => {
    expect(crumbleOf(CRUMBLE_SECONDS).scale).toBe(0);
  });
});

describe("crumblesAfter", () => {
  it("starts a crumble for a character that left, and ages it", () => {
    const first = crumblesAfter(new Map(), new Set([1, 2]), new Set([1]), 0.1);
    expect([...first]).toEqual([[2, 0]]);
    const next = crumblesAfter(first, new Set([1]), new Set([1]), 0.1);
    expect(next.get(2)).toBeCloseTo(0.1);
  });

  it("drops a crumble once it has run its course", () => {
    const next = crumblesAfter(
      new Map([[2, 0]]),
      new Set([1]),
      new Set([1]),
      CRUMBLE_SECONDS + 0.01,
    );
    expect(next.size).toBe(0);
  });
});
