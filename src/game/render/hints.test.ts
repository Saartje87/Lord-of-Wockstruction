import { describe, expect, it } from "vitest";
import {
  beltColumnButton,
  deathHint,
  menuChoiceLabel,
  panelCloseHint,
  resumeHint,
  skillBarSlotButton,
} from "./hints";

describe("the hints and labels that name buttons", () => {
  it.each([
    ["mouseAndKeyboard", ["Q", "W", "E", "R", "RMB"]],
    ["controller", ["X", "Y", "B", "RB", "RT"]],
    ["touch", ["", "", "", "", ""]],
  ] as const)("name the Skill Bar slots with %s as %j", (way, names) => {
    const slots = ["key1", "key2", "key3", "key4", "right"] as const;
    expect(slots.map((slot) => skillBarSlotButton(slot, way))).toEqual(names);
  });

  it.each([
    ["mouseAndKeyboard", ["1", "2", "3", "4"]],
    ["controller", ["←", "↑", "→", "↓"]],
    ["touch", ["", "", "", ""]],
  ] as const)("name the Belt strip's columns with %s as %j", (way, names) => {
    expect([0, 1, 2, 3].map((column) => beltColumnButton(column, way))).toEqual(
      names,
    );
  });

  it.each([
    ["hero", "mouseAndKeyboard", "Press C to close"],
    ["inventory", "mouseAndKeyboard", "Press I to close"],
    ["skillTree", "mouseAndKeyboard", "Press T to close"],
    ["hero", "controller", "Press B to close"],
    ["inventory", "controller", "Press B to close"],
    ["skillTree", "controller", "Press B to close"],
    ["inventory", "touch", ""],
  ] as const)("hint how to close the %s panel with %s: %j", (panel, way, hint) => {
    expect(panelCloseHint(panel, way)).toBe(hint);
  });

  it.each([
    ["mouseAndKeyboard", "Click to return to Town"],
    ["controller", "Press A to return to Town"],
    ["touch", "Tap to return to Town"],
  ] as const)("hint how to go on from Death with %s: %j", (way, hint) => {
    expect(deathHint(way)).toBe(hint);
  });

  it.each([
    [false, "mouseAndKeyboard", "Click elsewhere or press Esc to resume"],
    [true, "mouseAndKeyboard", "Click elsewhere to resume"],
    [false, "controller", "Press Menu or B to resume"],
    [true, "controller", "Press B to go back"],
    [false, "touch", "Tap elsewhere to resume"],
    [true, "touch", "Tap elsewhere to resume"],
  ] as const)("hint, confirming %s, how to leave the pause menu with %s: %j", (confirming, way, hint) => {
    expect(resumeHint(confirming, way)).toBe(hint);
  });

  it.each([
    ["newHero", "mouseAndKeyboard", "New Hero (N)"],
    ["confirm", "mouseAndKeyboard", "Yes (Y)"],
    ["goBack", "mouseAndKeyboard", "No (N)"],
    ["newHero", "controller", "New Hero"],
    ["confirm", "controller", "Yes"],
    ["goBack", "controller", "No (B)"],
    ["newHero", "touch", "New Hero"],
    ["goBack", "touch", "No"],
  ] as const)("label the pause menu's %s button with %s as %j", (choice, way, label) => {
    expect(menuChoiceLabel(choice, way)).toBe(label);
  });
});
