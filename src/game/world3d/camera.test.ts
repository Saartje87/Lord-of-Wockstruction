import { OrthographicCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { TILE_HEIGHT, toScreen } from "../iso";
import { viewportOf } from "../viewport";
import {
  placeCamera,
  screenToTile,
  tileToScreen,
  worldCameraOn,
} from "./camera";

const SCREENS = [
  { screen: "a 640×360 phone", width: 640, height: 360 },
  { screen: "1280×720", width: 1280, height: 720 },
  { screen: "a 1180×820 tablet", width: 1180, height: 820 },
  { screen: "2560×1440", width: 2560, height: 1440 },
];

const HERO = { x: 12.25, y: 7.5 };

describe("the 3D World's camera", () => {
  it.each(SCREENS)("keeps the Hero at the centre of $screen", ({
    width,
    height,
  }) => {
    const camera = worldCameraOn(viewportOf({ width, height }), HERO);

    const at = tileToScreen(camera, HERO);

    expect(at.x).toBeCloseTo(width / 2);
    expect(at.y).toBeCloseTo(height / 2);
  });

  it.each(SCREENS)("draws the floor as the 2D World does on $screen", ({
    width,
    height,
  }) => {
    const viewport = viewportOf({ width, height });
    const camera = worldCameraOn(viewport, HERO);
    const tile = { x: 15, y: 4 };

    const at = tileToScreen(camera, tile);

    // The same diamonds, at the same World zoom, as Flare's tiles.
    const flat = toScreen(tile);
    const hero = toScreen(HERO);
    expect(at.x - width / 2).toBeCloseTo(
      (flat.x - hero.x) * viewport.worldZoom,
    );
    expect(at.y - height / 2).toBeCloseTo(
      (flat.y - hero.y) * viewport.worldZoom,
    );
  });

  it.each(SCREENS)("shows as many tiles top to bottom as 2D on $screen", ({
    width,
    height,
  }) => {
    const viewport = viewportOf({ width, height });
    const camera = worldCameraOn(viewport, HERO);

    const top = screenToTile(camera, { x: width / 2, y: 0 });
    const bottom = screenToTile(camera, { x: width / 2, y: height });

    // Straight down the screen runs along the tiles' diagonal, x + y.
    const tiles = (bottom.x + bottom.y - (top.x + top.y)) / 2;
    expect(tiles).toBeCloseTo(height / viewport.worldZoom / TILE_HEIGHT);
  });

  it.each([
    0.5, 1, 1.5, 2,
  ])("round-trips screen and tile at World zoom %d", (zoom) => {
    const viewport = {
      ...viewportOf({ width: 1280, height: 720 }),
      worldZoom: zoom,
    };
    const camera = worldCameraOn(viewport, HERO);

    for (const tile of [HERO, { x: 3, y: 20.5 }, { x: 30.1, y: 0.2 }]) {
      const back = screenToTile(camera, tileToScreen(camera, tile));
      expect(back.x).toBeCloseTo(tile.x);
      expect(back.y).toBeCloseTo(tile.y);
    }
  });

  it("draws a point above the floor higher on the screen", () => {
    const camera = worldCameraOn(
      viewportOf({ width: 1280, height: 720 }),
      HERO,
    );

    const floor = tileToScreen(camera, HERO);
    const head = tileToScreen(camera, HERO, 1);

    expect(head.x).toBeCloseTo(floor.x);
    // One scene unit up, seen from 30° down: cos 30° of a unit's length.
    const unit = 192 / Math.SQRT2;
    expect(floor.y - head.y).toBeCloseTo(unit * Math.cos(Math.PI / 6));
  });

  it("places three.js's camera so it draws where the maths says", () => {
    const viewport = viewportOf({ width: 1180, height: 820 });
    const world = worldCameraOn(viewport, HERO);
    const three = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    placeCamera(three, world);

    for (const [tile, height] of [
      [HERO, 0],
      [{ x: 14, y: 9 }, 0],
      [{ x: 10, y: 5 }, 1.7],
    ] as const) {
      const ndc = new Vector3(tile.x, height, tile.y).project(three);
      const expected = tileToScreen(world, tile, height);
      expect(((ndc.x + 1) / 2) * viewport.width).toBeCloseTo(expected.x, 1);
      expect(((1 - ndc.y) / 2) * viewport.height).toBeCloseTo(expected.y, 1);
    }
  });
});
