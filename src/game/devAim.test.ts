import { describe, expect, it } from "vitest";
import { screenOf, walkToOrders } from "./devAim";
import { devStateOf } from "./devState";
import { createPointerInput, poll, press } from "./input/pointer";
import { arenaWith } from "./input/testArena";
import type { Vec } from "./sim/vec";
import { screenToTile, type WorldCamera } from "./world3d/camera";
import { pickablesOf } from "./world3d/pickables";
import { characterUnder3d } from "./world3d/picking";

/** An 800×600 canvas at World zoom 1, looking at `focus`. */
const cameraOn = (focus: Vec): WorldCamera => ({
  focus,
  width: 800,
  height: 600,
  zoom: 1,
});

/** `screenOf`, failing the test where it is off the canvas. */
function onCanvas(camera: WorldCamera, pos: Vec): Vec {
  const at = screenOf(camera, pos);
  if (at === null) throw new Error(`(${pos.x}, ${pos.y}) is off the canvas`);
  return at;
}

describe("screenOf", () => {
  it("puts the tile the camera looks at in the middle of the canvas", () => {
    expect(screenOf(cameraOn({ x: 10, y: 10 }), { x: 10, y: 10 })).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("is null for a tile drawn off the canvas", () => {
    const camera = cameraOn({ x: 10, y: 10 });

    expect(screenOf(camera, { x: 40, y: 10 })).toBeNull();
    expect(screenOf(camera, { x: -20, y: -20 })).toBeNull();
  });

  it("lands on a living Monster at its state() pos", () => {
    const world = arenaWith([{ x: 13, y: 10 }], { combat: true });
    const camera = cameraOn(world.hero.pos);
    const [monster] = devStateOf(world, null).monsters;

    const at = onCanvas(camera, monster.pos);

    expect(characterUnder3d(camera, pickablesOf(world, 1), at)).toBe(
      monster.id,
    );
  });
});

describe("walkToOrders", () => {
  it("orders what a click drawn on that tile does", () => {
    const camera = cameraOn({ x: 10, y: 10 });
    const pos = { x: 12.3, y: 8.8 };
    const input = createPointerInput();
    press(input, onCanvas(camera, pos));
    const clicked = poll(input, 0, {
      toTile: (at) => screenToTile(camera, at),
      monsterAt: () => null,
      npcAt: () => null,
      groundLabelAt: () => null,
      groundItemAt: () => null,
      panelAt: () => null,
    });

    expect(walkToOrders(pos, { paused: false, heroDead: false })).toEqual(
      clicked.orders,
    );
    expect(clicked.orders).toEqual([
      { type: "MoveTo", target: { x: 12.5, y: 8.5 } },
    ]);
  });

  it("orders nothing while paused, as a click doesn't", () => {
    const pos = { x: 12.3, y: 8.8 };
    expect(walkToOrders(pos, { paused: true, heroDead: false })).toEqual([]);
  });

  it("orders nothing in the Hero's Death, where a click only goes on", () => {
    const pos = { x: 12.3, y: 8.8 };
    expect(walkToOrders(pos, { paused: false, heroDead: true })).toEqual([]);
  });
});
