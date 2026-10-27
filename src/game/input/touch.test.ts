import { describe, expect, it } from "vitest";
import { createMenus } from "../menus";
import { touchControlsLayout } from "../render/touchControls";
import type { Rect } from "../sim/rect";
import { SKILL_BAR_SLOTS, type SkillBarSlot } from "../sim/skillBar";
import type { Vec } from "../sim/vec";
import type { World } from "../sim/world";
import { viewportOf } from "../viewport";
import { createPadInput, type PadButton, pollPad } from "./pad";
import { arenaWith } from "./testArena";
import {
  createTouchControls,
  readTouch,
  touchDown,
  touchMove,
  touchUp,
} from "./touch";

const layout = touchControlsLayout(viewportOf({ width: 1280, height: 720 }));
const { reach } = layout.stick;

const centre = (rect: Rect): Vec => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

/** A point in the Virtual Stick zone, well inside it. */
const inZone = centre(layout.stickZone);
const offBy = (from: Vec, x: number, y: number): Vec => ({
  x: from.x + x,
  y: from.y + y,
});

describe("the Virtual Stick", () => {
  it("rests where a touch first lands in its zone", () => {
    const touch = createTouchControls();

    expect(touchDown(touch, 1, inZone, layout)).toBe(true);

    expect(readTouch(touch).stick).toEqual({ x: 0, y: 0 });
  });

  it("points the stick the way the thumb drags from where it landed", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);

    touchMove(touch, 1, offBy(inZone, reach / 2, -reach / 2));

    expect(readTouch(touch).stick).toEqual({ x: 0.5, y: -0.5 });
  });

  it("pushes the stick all the way at its reach and no further", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);

    touchMove(touch, 1, offBy(inZone, 0, 3 * reach));

    expect(readTouch(touch).stick).toEqual({ x: 0, y: 1 });
  });

  it("comes back to rest when the thumb lifts", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);
    touchMove(touch, 1, offBy(inZone, reach, 0));
    readTouch(touch);

    touchUp(touch, 1);

    expect(readTouch(touch).stick).toEqual({ x: 0, y: 0 });
  });

  it("follows only the touch that started it", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);

    touchMove(touch, 2, offBy(inZone, reach, 0));

    expect(readTouch(touch).stick).toEqual({ x: 0, y: 0 });
  });

  it("leaves a touch off the touch controls to the pointer", () => {
    const touch = createTouchControls();
    const inTheWorld = { x: 640, y: 100 };

    expect(touchDown(touch, 1, inTheWorld, layout)).toBe(false);
    touchMove(touch, 1, offBy(inTheWorld, reach, 0));

    expect(readTouch(touch)).toEqual({
      stick: { x: 0, y: 0 },
      pressed: [],
      held: [],
      released: [],
    });
  });
});

describe("the touch buttons", () => {
  it.each<[string, Rect, PadButton]>([
    ["the attack button", layout.attack, "a"],
    ...SKILL_BAR_SLOTS.map((slot): [string, Rect, PadButton] => [
      `the ${slot} Skill button`,
      layout.skills[slot],
      CONTROLLER_BUTTON[slot],
    ]),
  ])("press %s as the controller's button", (_, rect, button) => {
    const touch = createTouchControls();

    expect(touchDown(touch, 1, centre(rect), layout)).toBe(true);

    expect(readTouch(touch)).toMatchObject({
      pressed: [button],
      held: [button],
      released: [],
    });
  });

  it("press Menu with the pause button, so it pauses as Menu does", () => {
    const touch = createTouchControls();

    expect(touchDown(touch, 1, centre(layout.pause), layout)).toBe(true);

    expect(readTouch(touch)).toMatchObject({ pressed: ["menu"] });
  });

  it("hold the button while the finger stays down, even sliding off", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, centre(layout.attack), layout);
    readTouch(touch);

    touchMove(touch, 1, { x: 640, y: 100 });

    expect(readTouch(touch)).toMatchObject({ pressed: [], held: ["a"] });
  });

  it("let the button go when the finger lifts", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, centre(layout.attack), layout);
    readTouch(touch);

    touchUp(touch, 1);

    expect(readTouch(touch)).toMatchObject({ held: [], released: ["a"] });
  });

  it("count a tap lifted before the frame read it as one held frame", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, centre(layout.attack), layout);
    touchUp(touch, 1);

    expect(readTouch(touch)).toMatchObject({ pressed: ["a"], held: ["a"] });
    expect(readTouch(touch)).toMatchObject({ held: [], released: ["a"] });
  });
});

describe("two touches at once", () => {
  it("give both the stick and the button", () => {
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);
    touchDown(touch, 2, centre(layout.skills.key2), layout);

    touchMove(touch, 1, offBy(inZone, -reach, 0));

    expect(readTouch(touch)).toEqual({
      stick: { x: -1, y: 0 },
      pressed: ["y"],
      held: ["y"],
      released: [],
    });
  });

  it("aim the attack with the stick through the pad poll", () => {
    // One Skeleton right of the Hero, one left; the Hero faces right.
    const world = arenaWith([
      { x: 12, y: 10 },
      { x: 8, y: 10 },
    ]);
    world.hero.facing = 0;
    const view = { ...asTiles(world), focusSpots: [] };
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);
    touchMove(touch, 1, offBy(inZone, -reach, 0));
    touchDown(touch, 2, centre(layout.attack), layout);

    const { orders } = pollPad(createPadInput(), readTouch(touch), 0, view);

    expect(orders).toEqual([{ type: "Attack", monster: world.monsters[1].id }]);
  });

  it("walk with the stick while the other thumb holds an empty Skill slot", () => {
    const world = arenaWith([]);
    const view = { ...asTiles(world), focusSpots: [] };
    const touch = createTouchControls();
    touchDown(touch, 1, inZone, layout);
    touchMove(touch, 1, offBy(inZone, 0, -reach));
    touchDown(touch, 2, centre(layout.skills.key1), layout);

    const { orders } = pollPad(createPadInput(), readTouch(touch), 0, view);

    expect(orders).toEqual([{ type: "Walk", direction: { x: 0, y: -1 } }]);
  });
});

/** How the pad sees `world`, canvas points as tiles, with no panel open. */
function asTiles(world: World) {
  return { toTile: (at: Vec) => at, world, menus: createMenus() };
}

/** The controller button that casts each Skill Bar slot. */
const CONTROLLER_BUTTON: Record<SkillBarSlot, PadButton> = {
  key1: "x",
  key2: "y",
  key3: "b",
  key4: "rb",
  right: "rt",
};
