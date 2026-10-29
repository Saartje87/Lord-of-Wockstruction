import { describe, expect, it } from "vitest";
import { viewportOf } from "../viewport";
import { tileToScreen, worldCameraOn } from "./camera";
import { characterUnder3d } from "./picking";

const camera = worldCameraOn(viewportOf({ width: 1280, height: 720 }), {
  x: 10,
  y: 10,
});
const standing = (id: number, x: number, y: number) => ({
  id,
  pos: { x, y },
  height: 0.9,
});

describe("picking a character through the 3D World's camera", () => {
  it("hits a character by a point on its body, above its feet", () => {
    const feet = tileToScreen(camera, { x: 12, y: 10 });

    expect(
      characterUnder3d(camera, [standing(1, 12, 10)], {
        x: feet.x,
        y: feet.y - 40,
      }),
    ).toBe(1);
  });

  it("misses beside a character and far below its feet", () => {
    const feet = tileToScreen(camera, { x: 12, y: 10 });
    const one = [standing(1, 12, 10)];

    expect(characterUnder3d(camera, one, { x: feet.x + 200, y: feet.y })).toBe(
      null,
    );
    expect(characterUnder3d(camera, one, { x: feet.x, y: feet.y + 80 })).toBe(
      null,
    );
  });

  it("picks the lowest on screen where boxes overlap", () => {
    // One just behind the other, so their boxes overlap on screen.
    const behind = standing(1, 12, 10);
    const front = standing(2, 12.3, 10.3);
    const feet = tileToScreen(camera, front.pos);
    const point = { x: feet.x, y: feet.y - 30 };

    expect(characterUnder3d(camera, [behind, front], point)).toBe(2);
    expect(characterUnder3d(camera, [front, behind], point)).toBe(2);
  });
});
