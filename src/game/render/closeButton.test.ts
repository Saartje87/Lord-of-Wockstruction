import { describe, expect, it } from "vitest";
import { closeButtonRect, closeHitAt } from "./closeButton";

const panel = { x: 100, y: 50, w: 300, h: 400 };

describe("closeButtonRect", () => {
  it("puts the × in the panel's top-right corner, inside its edges", () => {
    expect(closeButtonRect(panel)).toEqual({ x: 368, y: 60, w: 22, h: 22 });
  });
});

describe("closeHitAt", () => {
  const closeButton = closeButtonRect(panel);

  it("finds the × of the named panel at a point on it", () => {
    expect(closeHitAt({ closeButton }, { x: 379, y: 71 }, "skillTree")).toEqual(
      { button: { type: "close", panel: "skillTree" } },
    );
  });

  it("is nothing at a point off the ×", () => {
    expect(closeHitAt({ closeButton }, { x: 360, y: 71 }, "hero")).toBeNull();
  });
});
