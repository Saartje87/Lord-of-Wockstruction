import { describe, expect, it } from "vitest";
import {
  beltColumnButton,
  deathHint,
  mapTooltip,
  menuChoiceLabel,
  panelCloseHint,
  resumeHint,
  skillBarSlotButton,
  skillTooltip,
  townPortalTooltip,
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
    ["mouseAndKeyboard", "Town Portal (P)"],
    ["controller", "Town Portal (LB)"],
    ["touch", "Town Portal"],
  ] as const)("name the Town Portal button's key with %s: %j", (way, tooltip) => {
    expect(townPortalTooltip(way)).toBe(tooltip);
  });

  it.each([
    ["mouseAndKeyboard", "Map (Tab)"],
    ["controller", "Map (LT)"],
    ["touch", ""],
  ] as const)("name the Mini Map's way to open the Map Overlay with %s, none for touch: %j", (way, tooltip) => {
    expect(mapTooltip(way)).toBe(tooltip);
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
    expect(menuChoiceLabel(choice, way, false)).toBe(label);
  });

  const golem = {
    skill: "golem",
    name: "Golem",
    manaCost: "15",
    requiredLevel: null,
  } as const;
  it.each([
    [
      "learned, a point to spend",
      { ...golem, skillLevel: "1", canRaise: true },
      "controller",
      [
        "Golem",
        "Skill Level 1",
        "Press A to spend a Skill Point",
        "Press X to put on the Skill Bar",
      ],
    ],
    [
      "learned",
      { ...golem, skillLevel: "2", canRaise: false },
      "controller",
      ["Golem", "Skill Level 2", "Press X to put on the Skill Bar"],
    ],
    [
      "not learned",
      { ...golem, skillLevel: "0", canRaise: false },
      "controller",
      ["Golem", "Skill Level 0"],
    ],
    [
      "learned, a point to spend",
      { ...golem, skillLevel: "1", canRaise: true },
      "mouseAndKeyboard",
      [
        "Golem",
        "Skill Level 1",
        "Click + to spend a Skill Point",
        "Click to put on the Skill Bar",
      ],
    ],
    [
      "learned, a point to spend",
      { ...golem, skillLevel: "1", canRaise: true },
      "touch",
      ["Golem", "Skill Level 1"],
    ],
  ] as const)("give a Skill's tooltip, %s, with %s", (_, sheet, way, lines) => {
    expect(skillTooltip(sheet, way)).toEqual(lines);
  });
});
