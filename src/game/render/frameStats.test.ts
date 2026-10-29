import { describe, expect, it } from "vitest";
import { createFrameStats, recordFrame } from "./frameStats";

const drawn = { calls: 19, triangles: 8000 };

describe("recordFrame", () => {
  it("reads 60 fps and about 16.7 ms a frame at 60 frames a second", () => {
    const stats = createFrameStats(0);
    let reading = null;
    for (let frame = 1; frame <= 30; frame++) {
      reading = recordFrame(stats, (frame * 1000) / 60, drawn) ?? reading;
    }
    expect(reading?.fps).toBeCloseTo(60);
    expect(reading?.frameMs).toBeCloseTo(16.67, 1);
  });

  it("reads 20 fps when frames take 50 ms", () => {
    const stats = createFrameStats(0);
    let reading = null;
    for (let frame = 1; frame <= 10; frame++) {
      reading = recordFrame(stats, frame * 50, drawn) ?? reading;
    }
    expect(reading?.fps).toBeCloseTo(20);
    expect(reading?.frameMs).toBeCloseTo(50);
  });

  it("gives a reading twice a second, with the last frame's draw calls and triangles", () => {
    const stats = createFrameStats(0);
    expect(recordFrame(stats, 250, drawn)).toBeNull();
    expect(recordFrame(stats, 500, { calls: 3, triangles: 12 })).toEqual({
      fps: 4,
      frameMs: 250,
      drawn: { calls: 3, triangles: 12 },
    });
    expect(recordFrame(stats, 750, drawn)).toBeNull();
  });

  it("reads no draw calls for the 2D World, which doesn't count them", () => {
    const stats = createFrameStats(0);
    expect(recordFrame(stats, 500, null)?.drawn).toBeNull();
  });
});
