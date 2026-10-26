import { describe, expect, it } from "vitest";
import { viewportOf } from "../viewport";
import { rotateNoticeText } from "./rotateNotice";

describe("the Rotate Notice's text", () => {
  it("asks to turn a phone held upright sideways", () => {
    const { rotateNotice } = viewportOf({ width: 390, height: 844 });

    const text = rotateNoticeText(rotateNotice ?? "enlarge");

    expect(text.title).toMatch(/turn/i);
    expect(text.body).toMatch(/sideways/i);
    expect(`${text.title} ${text.body}`).not.toMatch(/enlarge/i);
  });

  it("asks to enlarge a window too small to play in", () => {
    const { rotateNotice } = viewportOf({ width: 500, height: 300 });

    const text = rotateNoticeText(rotateNotice ?? "turn");

    expect(text.title).toMatch(/enlarge/i);
    expect(text.body).toMatch(/640×360/);
    expect(`${text.title} ${text.body}`).not.toMatch(/sideways/i);
  });
});
