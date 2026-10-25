import { describe, expect, it } from "vitest";
import { compassOf, frameAt, swingFrame } from "./animation";

/** The facing of a direction in tile units, as the sim measures it. */
const facing = (x: number, y: number) => Math.atan2(y, x);

describe("compassOf", () => {
  it("names the screen direction of each of the 8 tile directions", () => {
    expect(compassOf(facing(1, 1))).toBe("s");
    expect(compassOf(facing(-1, -1))).toBe("n");
    expect(compassOf(facing(1, -1))).toBe("e");
    expect(compassOf(facing(-1, 1))).toBe("w");
    expect(compassOf(facing(1, 0))).toBe("se");
    expect(compassOf(facing(0, 1))).toBe("sw");
    expect(compassOf(facing(-1, 0))).toBe("nw");
    expect(compassOf(facing(0, -1))).toBe("ne");
  });

  it("snaps an exact facing to the nearest of the 8", () => {
    expect(compassOf(facing(1, 0.3))).toBe("se");
    expect(compassOf(facing(1, 0.6))).toBe("s");
    expect(compassOf(facing(-1, -0.1))).toBe("nw");
    expect(compassOf(facing(0.2, -1))).toBe("ne");
  });
});

describe("frameAt", () => {
  it("wraps a looped animation", () => {
    const stance = { frames: 4, frameMs: 100, loop: true };

    expect(frameAt(stance, 0)).toBe(0);
    expect(frameAt(stance, 99)).toBe(0);
    expect(frameAt(stance, 100)).toBe(1);
    expect(frameAt(stance, 450)).toBe(0);
  });

  it("holds the last frame of an animation that plays once", () => {
    const die = { frames: 6, frameMs: 100, loop: false };

    expect(frameAt(die, 550)).toBe(5);
    expect(frameAt(die, 60_000)).toBe(5);
  });
});

describe("swingFrame", () => {
  // A 0.35 s swing whose hit lands at 140 ms, on its third of four frames.
  const swing = { frames: 4, strikeFrame: 2, swingMs: 350, hitMs: 140 };

  it("shows the strike frame from the moment the hit lands", () => {
    expect(swingFrame(swing, 139)).toBe(1);
    expect(swingFrame(swing, 140)).toBe(2);
  });

  it("spreads the wind-up and the follow-through over their own time", () => {
    expect(swingFrame(swing, 0)).toBe(0);
    expect(swingFrame(swing, 70)).toBe(1);
    expect(swingFrame(swing, 244)).toBe(2);
    expect(swingFrame(swing, 245)).toBe(3);
  });

  it("holds the last frame once the swing is over", () => {
    expect(swingFrame(swing, 350)).toBe(3);
    expect(swingFrame(swing, 400)).toBe(3);
  });
});
