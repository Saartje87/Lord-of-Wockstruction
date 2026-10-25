import { describe, expect, it } from "vitest";
import type { Vec } from "../sim/vec";
import { createPointerInput, move, poll, press, release } from "./pointer";

// Treat canvas pixels as tile units, so tests can speak in tiles.
const asTiles = (screen: Vec) => screen;

describe("pointer input", () => {
  it("orders a walk to the centre of the clicked tile", () => {
    const input = createPointerInput();

    press(input, { x: 3.2, y: 4.9 });
    const { orders, click } = poll(input, 0, asTiles);

    expect(orders).toEqual([{ type: "MoveTo", target: { x: 3.5, y: 4.5 } }]);
    expect(click).toEqual({ x: 3.5, y: 4.5 });
  });

  it("re-targets the cursor every 120 ms while held", () => {
    const input = createPointerInput();
    press(input, { x: 1, y: 1 });
    poll(input, 1000, asTiles);

    move(input, { x: 2, y: 1 });
    expect(poll(input, 1119, asTiles).orders).toEqual([]);
    const held = poll(input, 1120, asTiles);
    expect(held.orders).toEqual([
      { type: "MoveTo", target: { x: 2.5, y: 1.5 } },
    ]);
    expect(held.click).toBeNull();

    release(input);
    move(input, { x: 3, y: 1 });
    expect(poll(input, 1300, asTiles).orders).toEqual([]);
  });

  it("still orders a walk for a click released within one frame", () => {
    const input = createPointerInput();

    press(input, { x: 3, y: 4 });
    release(input);

    expect(poll(input, 0, asTiles).orders).toEqual([
      { type: "MoveTo", target: { x: 3.5, y: 4.5 } },
    ]);
    expect(poll(input, 500, asTiles).orders).toEqual([]);
  });

  // A touch fires down, up and leave before the next frame.
  it("orders a walk for a tap whose pointer has already left", () => {
    const input = createPointerInput();

    press(input, { x: 3, y: 4 });
    release(input);
    move(input, null);

    expect(poll(input, 0, asTiles).orders).toEqual([
      { type: "MoveTo", target: { x: 3.5, y: 4.5 } },
    ]);
  });
});
