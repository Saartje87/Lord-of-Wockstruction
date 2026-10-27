import { describe, expect, it } from "vitest";
import { middleOf } from "../sim/rect";
import { viewportOf } from "../viewport";
import {
  rotateNoticeChoiceAt,
  rotateNoticeLayout,
  rotateNoticeText,
} from "./rotateNotice";

describe("the Rotate Notice's text", () => {
  it("asks to turn a phone held upright sideways", () => {
    const { rotateNotice } = viewportOf({ width: 390, height: 844 });

    const text = rotateNoticeText(rotateNotice ?? "tooSmall", "touch");

    expect(text.title).toMatch(/turn/i);
    expect(text.body).toMatch(/sideways/i);
    expect(`${text.title} ${text.body}`).not.toMatch(/enlarge/i);
  });

  it.each([
    "mouseAndKeyboard",
    "controller",
  ] as const)("asks to enlarge a window too small to play in, with %s", (way) => {
    const { rotateNotice } = viewportOf({ width: 500, height: 300 });

    const text = rotateNoticeText(rotateNotice ?? "turn", way);

    expect(text.title).toMatch(/enlarge/i);
    expect(text.body).toMatch(/640×320/);
    expect(`${text.title} ${text.body}`).not.toMatch(/sideways/i);
  });

  it("says a touch screen is too small, never to enlarge it", () => {
    const { rotateNotice } = viewportOf({ width: 915, height: 300 });

    const text = rotateNoticeText(rotateNotice ?? "turn", "touch");

    expect(`${text.title} ${text.body}`).toMatch(/too small/i);
    expect(`${text.title} ${text.body}`).not.toMatch(/enlarge|window/i);
  });
});

describe("the Rotate Notice's Fullscreen button", () => {
  const available = { available: true, on: false };
  const unavailable = { available: false, on: false };
  /** A phone held sideways with the browser bars showing, too short. */
  const phone = viewportOf({ width: 915, height: 300 });

  it("shows for touch on a screen too small, where fullscreen is allowed", () => {
    const { button } = rotateNoticeLayout(phone, "touch", available);

    expect(button?.choice).toBe("fullscreen");
    expect(button?.label).toBe("Fullscreen");
  });

  it("isn't shown where the browser doesn't allow fullscreen", () => {
    expect(rotateNoticeLayout(phone, "touch", unavailable).button).toBeNull();
  });

  it.each([
    "mouseAndKeyboard",
    "controller",
  ] as const)("isn't shown with %s, which only touch sees", (way) => {
    expect(rotateNoticeLayout(phone, way, available).button).toBeNull();
  });

  it("isn't shown on a screen held upright, nor without the notice", () => {
    const upright = viewportOf({ width: 412, height: 915 });
    const playing = viewportOf({ width: 915, height: 412 });

    expect(rotateNoticeLayout(upright, "touch", available).button).toBeNull();
    expect(rotateNoticeLayout(playing, "touch", available).button).toBeNull();
  });

  it.each([
    [639, 320],
    [640, 319],
    [915, 300],
    [568, 260],
  ])("fits a %i×%i screen, below the text", (width, height) => {
    const screen = viewportOf({ width, height });
    const { button, body } = rotateNoticeLayout(screen, "touch", available);
    if (!button) throw new Error("no Fullscreen button");
    const { rect } = button;

    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.w).toBeLessThanOrEqual(width);
    expect(rect.y + rect.h).toBeLessThanOrEqual(height);
    expect(rect.y).toBeGreaterThanOrEqual(body.bottom);
  });

  it("is found under a tap, and nothing elsewhere", () => {
    const { button } = rotateNoticeLayout(phone, "touch", available);
    if (!button) throw new Error("no Fullscreen button");
    const at = middleOf(button.rect);

    expect(rotateNoticeChoiceAt(phone, at, "touch", available)).toBe(
      "fullscreen",
    );
    expect(
      rotateNoticeChoiceAt(phone, { x: 5, y: 5 }, "touch", available),
    ).toBeNull();
    expect(rotateNoticeChoiceAt(phone, at, "touch", unavailable)).toBeNull();
    expect(
      rotateNoticeChoiceAt(phone, at, "mouseAndKeyboard", available),
    ).toBeNull();
  });
});
