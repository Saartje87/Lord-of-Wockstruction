import { describe, expect, it } from "vitest";
import { devOptionsOf } from "./devOptions";

describe("devOptionsOf", () => {
  it("shows the stats panel for ?stats in a dev build", () => {
    expect(devOptionsOf("?stats", true).stats).toBe(true);
    expect(devOptionsOf("?area=crypt&entry=start", true).stats).toBe(false);
  });

  it("shows no stats panel outside dev builds", () => {
    expect(devOptionsOf("?stats", false).stats).toBe(false);
  });
});
