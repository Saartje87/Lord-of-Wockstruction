import { describe, expect, it } from "vitest";
import { devOptionsOf } from "./devOptions";

describe("devOptionsOf", () => {
  it("draws the 3D World for ?renderer=3d in a dev build", () => {
    expect(devOptionsOf("?renderer=3d", true).world).toBe("3d");
  });

  it("draws the 2D World without the switch", () => {
    expect(devOptionsOf("", true).world).toBe("2d");
    expect(devOptionsOf("?renderer=2d", true).world).toBe("2d");
    expect(devOptionsOf("?renderer=webgpu", true).world).toBe("2d");
  });

  it("shows the stats panel for ?stats in a dev build", () => {
    expect(devOptionsOf("?stats", true).stats).toBe(true);
    expect(devOptionsOf("?area=crypt&entry=start", true).stats).toBe(false);
  });

  it("ignores both outside dev builds", () => {
    expect(devOptionsOf("?renderer=3d&stats", false)).toEqual({
      world: "2d",
      stats: false,
    });
  });
});
