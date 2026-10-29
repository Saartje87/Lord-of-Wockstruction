import { afterEach, describe, expect, it } from "vitest";
import { townPortalLook } from "../tuning/townPortalLook";
import {
  shownTownPortals,
  townPortalCloseScale,
  townPortalOpenScale,
} from "./townPortalLook";

describe("shownTownPortals", () => {
  const at = { x: 3, y: 4 };

  it("shows the open end bursting open, then standing", () => {
    const opening = shownTownPortals({
      end: at,
      openedAtMs: 1000,
      closing: [],
      area: "town",
      nowMs: 1100,
    });
    expect(opening).toEqual([
      { pos: at, scale: townPortalOpenScale(100), msOpen: 100 },
    ]);

    const standing = shownTownPortals({
      end: at,
      openedAtMs: null,
      closing: [],
      area: "town",
      nowMs: 5000,
    });
    expect(standing[0].scale).toBe(1);
  });

  it("shows a closing end of the Area shrinking, and none of other Areas", () => {
    const closing = [
      { area: "town", pos: at, atMs: 1000 },
      { area: "catacombs", pos: { x: 9, y: 9 }, atMs: 1000 },
    ];

    const shown = shownTownPortals({
      end: null,
      openedAtMs: null,
      closing,
      area: "town",
      nowMs: 1100,
    });

    expect(shown).toHaveLength(1);
    expect(shown[0].pos).toEqual(at);
    expect(shown[0].scale).toBe(townPortalCloseScale(100));
  });

  it("drops a closing end that has shrunk away", () => {
    const shown = shownTownPortals({
      end: null,
      openedAtMs: null,
      closing: [{ area: "town", pos: at, atMs: 0 }],
      area: "town",
      nowMs: 1_000_000,
    });

    expect(shown).toEqual([]);
  });
});

const { openMs, closeMs, overshoot } = townPortalLook;
afterEach(() => {
  Object.assign(townPortalLook, { openMs, closeMs, overshoot });
});

describe("townPortalOpenScale", () => {
  it("bursts open from a point, springing past full size, over 400 ms", () => {
    Object.assign(townPortalLook, { openMs: 400, overshoot: 0.25 });
    const scales = [0, 50, 100, 150, 200, 250, 300, 350, 400].map(
      townPortalOpenScale,
    );

    expect(scales[0]).toBe(0);
    expect(scales[1]).toBeGreaterThan(0.3);
    expect(Math.max(...scales)).toBeGreaterThan(1.1);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.25);
    expect(scales[8]).toBe(1);
  });

  it("stays at full size once open", () => {
    expect(townPortalOpenScale(openMs + 1)).toBe(1);
    expect(townPortalOpenScale(60_000)).toBe(1);
  });

  it("only grows without an overshoot", () => {
    Object.assign(townPortalLook, { openMs: 400, overshoot: 0 });
    const scales = [0, 100, 200, 300, 400].map(townPortalOpenScale);

    expect(scales).toEqual([...scales].sort());
    expect(Math.max(...scales)).toBe(1);
  });
});

describe("townPortalCloseScale", () => {
  it("shrinks away from full size to nothing over 300 ms", () => {
    Object.assign(townPortalLook, { closeMs: 300 });
    const scales = [0, 75, 150, 225, 300].map(townPortalCloseScale);

    expect(scales[0]).toBe(1);
    expect(scales).toEqual([...scales].sort().reverse());
    expect(scales[2]).toBeGreaterThan(0);
    expect(scales[2]).toBeLessThan(1);
    expect(scales[4]).toBe(0);
  });

  it("stays at nothing once closed", () => {
    expect(townPortalCloseScale(closeMs + 1)).toBe(0);
  });
});
