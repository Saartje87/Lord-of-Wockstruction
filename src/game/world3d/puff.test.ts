import { describe, expect, it } from "vitest";
import { inputTuning } from "../tuning/input";
import { puffOf } from "./puff";

const { clickPuff } = inputTuning;
const PROGRESSES = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
const reachOf = (m: { offset: { x: number; y: number } }) =>
  Math.hypot(m.offset.x, m.offset.y);

describe("the click marker's puff of bone-ash", () => {
  const at = { x: 12.3, y: 40.7 };

  it("has the tuned number of motes", () => {
    for (const p of PROGRESSES) {
      expect(puffOf(at, p)).toHaveLength(clickPuff.motes);
    }
  });

  it("keeps every mote within the tuned reach of the point and low", () => {
    for (const p of PROGRESSES) {
      for (const m of puffOf(at, p)) {
        expect(reachOf(m)).toBeLessThanOrEqual(clickPuff.reach + 1e-9);
        expect(m.height).toBeGreaterThanOrEqual(0);
        expect(m.height).toBeLessThanOrEqual(clickPuff.rise + 1e-9);
      }
    }
  });

  it("starts on the point and spreads further out later", () => {
    const start = puffOf(at, 0);
    for (const m of start) expect(reachOf(m)).toBeCloseTo(0);
    const early = puffOf(at, 0.2);
    const late = puffOf(at, 0.8);
    early.forEach((m, i) => {
      expect(reachOf(late[i])).toBeGreaterThan(reachOf(m));
    });
  });

  it("spreads most of the way early", () => {
    const half = puffOf(at, 0.5);
    const end = puffOf(at, 1);
    half.forEach((m, i) => {
      expect(reachOf(m)).toBeGreaterThan(0.6 * reachOf(end[i]));
    });
  });

  it("is fully transparent at the end and visible at the start", () => {
    for (const m of puffOf(at, 1)) expect(m.opacity).toBe(0);
    for (const m of puffOf(at, 0)) expect(m.opacity).toBeGreaterThan(0);
  });

  it("gives the same puff for the same point", () => {
    expect(puffOf({ ...at }, 0.4)).toEqual(puffOf(at, 0.4));
  });

  it("scatters differently for different points", () => {
    const a = puffOf(at, 0.6).map((m) => m.offset);
    const b = puffOf({ x: 3.1, y: 8.9 }, 0.6).map((m) => m.offset);
    expect(a).not.toEqual(b);
  });

  it("scatters its motes apart from each other", () => {
    const offsets = puffOf(at, 1).map((m) => `${m.offset.x},${m.offset.y}`);
    expect(new Set(offsets).size).toBe(clickPuff.motes);
  });
});
