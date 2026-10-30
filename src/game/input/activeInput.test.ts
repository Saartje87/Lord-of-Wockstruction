import { describe, expect, it } from "vitest";
import {
  createActiveInput,
  type InputEvent,
  padTouched,
  pointerWay,
  reportInput,
} from "./activeInput";
import { restingPad } from "./pad";

/** The Active Input after `events`, from a fresh start. */
function after(events: readonly InputEvent[]) {
  const active = createActiveInput(false);
  for (const event of events) reportInput(active, event);
  return active.way;
}

describe("the Active Input", () => {
  it("starts as mouse and keyboard where the main pointer is fine", () => {
    expect(createActiveInput(false).way).toBe("mouseAndKeyboard");
  });

  it("starts as touch where the main pointer is coarse", () => {
    expect(createActiveInput(true).way).toBe("touch");
  });

  it.each([
    "mouseAndKeyboard",
    "controller",
  ] as const)("switches from a touch start to %s once used", (way) => {
    const active = createActiveInput(true);
    reportInput(active, { type: "used", way });

    expect(active.way).toBe(way);
  });

  it.each([
    [[{ type: "used", way: "controller" }], "controller"],
    [[{ type: "used", way: "touch" }], "touch"],
    [
      [
        { type: "used", way: "touch" },
        { type: "used", way: "mouseAndKeyboard" },
      ],
      "mouseAndKeyboard",
    ],
    [
      [
        { type: "used", way: "controller" },
        { type: "used", way: "touch" },
        { type: "used", way: "controller" },
      ],
      "controller",
    ],
    [
      [{ type: "used", way: "touch" }, { type: "controllerConnected" }],
      "touch",
    ],
    [
      [{ type: "used", way: "controller" }, { type: "controllerDisconnected" }],
      "controller",
    ],
  ] as const)("after %j is %s, the way last used", (events, way) => {
    expect(after(events)).toBe(way);
  });

  it("opens the pause menu when the controller disconnects while it is active", () => {
    const active = createActiveInput(false);
    reportInput(active, { type: "used", way: "controller" });
    expect(reportInput(active, { type: "controllerDisconnected" })).toEqual({
      pause: true,
    });
  });

  it.each([
    "mouseAndKeyboard",
    "touch",
  ] as const)("changes nothing when the controller disconnects while %s is active", (way) => {
    const active = createActiveInput(false);
    reportInput(active, { type: "used", way });
    expect(reportInput(active, { type: "controllerDisconnected" })).toEqual({
      pause: false,
    });
    expect(active.way).toBe(way);
  });

  it("changes nothing when a controller is plugged in", () => {
    const active = createActiveInput(false);
    expect(reportInput(active, { type: "controllerConnected" })).toEqual({
      pause: false,
    });
    expect(active.way).toBe("mouseAndKeyboard");
  });

  it("does not pause for using a way", () => {
    const active = createActiveInput(false);
    expect(reportInput(active, { type: "used", way: "controller" })).toEqual({
      pause: false,
    });
  });
});

describe("whether the pad was touched", () => {
  it("is not, left alone", () => {
    expect(padTouched(restingPad)).toBe(false);
  });

  it("is not, with the stick inside its dead zone or a button let go", () => {
    expect(
      padTouched({ ...restingPad, stick: { x: 0.1, y: 0.1 }, released: ["a"] }),
    ).toBe(false);
  });

  it("is, with the stick pushed past its dead zone", () => {
    expect(padTouched({ ...restingPad, stick: { x: 0, y: -0.5 } })).toBe(true);
  });

  it("is, with a button pressed", () => {
    expect(padTouched({ ...restingPad, pressed: ["x"], held: ["x"] })).toBe(
      true,
    );
  });
});

describe("the way a pointer plays", () => {
  it.each([
    ["mouse", "mouseAndKeyboard"],
    ["pen", "mouseAndKeyboard"],
    ["touch", "touch"],
  ] as const)("is, for a %s, %s", (pointerType, way) => {
    expect(pointerWay(pointerType)).toBe(way);
  });
});
