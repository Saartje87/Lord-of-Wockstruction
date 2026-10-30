import { describe, expect, it } from "vitest";
import { CRUMBLE_SECONDS, crumbleOf } from "./crumble";

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
