import { describe, expect, it } from "vitest";
import { TILE_HEIGHT, toScreen, toTile } from "../iso";
import { viewportOf } from "../viewport";
import { cameraOn, onScreen, onWorld } from "./camera";

const SCREENS = [
  { screen: "a 640×360 phone", width: 640, height: 360 },
  { screen: "1280×720", width: 1280, height: 720 },
  { screen: "a 1180×820 tablet", width: 1180, height: 820 },
  { screen: "2560×1440", width: 2560, height: 1440 },
];

const HERO = { x: 12.25, y: 7.5 };

describe("the camera", () => {
  it.each(SCREENS)("shows 7.5 tiles top to bottom on $screen", ({
    width,
    height,
  }) => {
    const camera = cameraOn(viewportOf({ width, height }), toScreen(HERO), 2);

    const top = onWorld(camera, { x: width / 2, y: 0 });
    const bottom = onWorld(camera, { x: width / 2, y: height });

    // 720 CSS px of World at native size, half-tiles 96 px tall.
    expect((bottom.y - top.y) / TILE_HEIGHT).toBeCloseTo(7.5, 1);
  });

  it.each(SCREENS)("keeps the Hero at the centre of $screen", ({
    width,
    height,
  }) => {
    const camera = cameraOn(viewportOf({ width, height }), toScreen(HERO), 2);

    const tile = toTile(onWorld(camera, { x: width / 2, y: height / 2 }));

    expect(tile.x).toBeCloseTo(HERO.x, 2);
    expect(tile.y).toBeCloseTo(HERO.y, 2);
  });

  it.each(SCREENS)("maps a point drawn on $screen back to its tile", ({
    width,
    height,
  }) => {
    const camera = cameraOn(viewportOf({ width, height }), toScreen(HERO), 2);
    const tile = { x: 14, y: 6 };

    const tileAt = toTile(onWorld(camera, onScreen(camera, toScreen(tile))));

    expect(tileAt.x).toBeCloseTo(tile.x);
    expect(tileAt.y).toBeCloseTo(tile.y);
  });

  it("draws a tile further off the centre the more it's zoomed", () => {
    const phone = cameraOn(
      viewportOf({ width: 640, height: 360 }),
      toScreen(HERO),
      2,
    );
    const desktop = cameraOn(
      viewportOf({ width: 2560, height: 1440 }),
      toScreen(HERO),
      2,
    );
    const nextTile = toScreen({ x: HERO.x + 1, y: HERO.y + 1 });

    // One tile down-screen is 96 px at native size.
    expect(onScreen(phone, nextTile).y - 180).toBeCloseTo(48, 0);
    expect(onScreen(desktop, nextTile).y - 720).toBeCloseTo(192, 0);
  });

  it("sits on whole device pixels, so the art stays crisp", () => {
    const camera = cameraOn(
      viewportOf({ width: 1181, height: 820 }),
      { x: 101.3, y: 47.77 },
      2,
    );

    expect(Number.isInteger(camera.x * 2)).toBe(true);
    expect(Number.isInteger(camera.y * 2)).toBe(true);
  });
});
