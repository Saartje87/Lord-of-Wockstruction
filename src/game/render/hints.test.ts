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
    ["waypoints", "mouseAndKeyboard", "Press Esc to close"],
    ["waypoints", "controller", "Press B to close"],
    ["waypoints", "touch", ""],
    ["dialogue", "mouseAndKeyboard", "Press Esc to close"],
    ["dialogue", "controller", "Press B to close"],
    ["dialogue", "touch", ""],
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
    ["mouseAndKeyboard", "Click elsewhere or press Esc to resume"],
    ["controller", "Press Menu or B to resume"],
    ["touch", "Tap elsewhere to resume"],
  ] as const)("hint how to leave the pause menu with %s: %j", (way, hint) => {
    expect(resumeHint(way)).toBe(hint);
  });

  it.each([
    ["newHero", "mouseAndKeyboard", "New Hero (N)"],
    ["quit", "mouseAndKeyboard", "Quit to Start Screen (Q)"],
    ["quit", "controller", "Quit to Start Screen"],
    ["quit", "touch", "Quit to Start Screen"],
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
    branch: "summoning",
    prerequisites: [],
    stats: [],
    nextStats: [],
    synergies: [],
    synergyTotal: "0",
    grid: { column: 0, row: 1 },
    arrows: [],
    raised: "",
    requiredLevel: null,
    passive: null,
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
    [
      "with Synergies",
      {
        ...golem,
        skillLevel: "1",
        canRaise: false,
        synergies: [
          { giver: "Bone Ward", percentPerSkillLevel: "8", total: "16" },
          { giver: "Amplify Damage", percentPerSkillLevel: "5", total: "5" },
        ],
        synergyTotal: "21",
      },
      "touch",
      [
        "Golem",
        "Skill Level 1",
        "Synergy: Bone Ward +8% per Skill Level, +16% now",
        "Synergy: Amplify Damage +5% per Skill Level, +5% now",
        "Synergies add +21% now",
      ],
    ],
    [
      "stat lines, a Next Skill Level block, then Synergies, Prerequisites and hints in order",
      {
        ...golem,
        skillLevel: "2",
        raised: "1",
        canRaise: true,
        stats: ["Minion Life: 100", "Mana: 19"],
        nextStats: ["Minion Life: 120", "Mana: 21"],
        synergies: [
          { giver: "Bone Ward", percentPerSkillLevel: "8", total: "16" },
        ],
        synergyTotal: "16",
        prerequisites: ["Raise Archer"],
        requiredLevel: "9",
      },
      "controller",
      [
        "Golem",
        "Skill Level 2 (+1)",
        "Minion Life: 100",
        "Mana: 19",
        "Next Skill Level",
        "Minion Life: 120",
        "Mana: 21",
        "Synergy: Bone Ward +8% per Skill Level, +16% now",
        "Synergies add +16% now",
        "Needs Raise Archer first",
        "Needs Level 9",
        "Press A to spend a Skill Point",
        "Press X to put on the Skill Bar",
      ],
    ],
    [
      "a learned Passive Skill",
      {
        ...golem,
        name: "Grave Command",
        skillLevel: "2",
        canRaise: true,
        passive: {
          percentPerSkillLevel: "5",
          total: "10",
          boosts: "Golem, Raise Skeleton",
          extras: [],
        },
      },
      "controller",
      [
        "Grave Command",
        "Skill Level 2",
        "Passive: +5% per Skill Level to Golem, Raise Skeleton",
        "Passive adds +10% now",
        "Press A to spend a Skill Point",
      ],
    ],
    [
      "a learned Passive Skill that raises Attack Rating and damage",
      {
        ...golem,
        name: "Bonebinding",
        skillLevel: "2",
        canRaise: true,
        nextStats: ["Attack Rating: +30%", "Damage: +24%"],
        passive: {
          percentPerSkillLevel: "0",
          total: "0",
          boosts: "Golem, Raise Skeleton",
          extras: [
            { label: "Attack Rating", percentPerSkillLevel: "10", total: "20" },
            { label: "Damage", percentPerSkillLevel: "8", total: "16" },
          ],
        },
      },
      "controller",
      [
        "Bonebinding",
        "Skill Level 2",
        "Next Skill Level",
        "Attack Rating: +30%",
        "Damage: +24%",
        "Passive: +10% Attack Rating per Skill Level to Golem, Raise Skeleton",
        "Passive adds +20% Attack Rating now",
        "Passive: +8% Damage per Skill Level to Golem, Raise Skeleton",
        "Passive adds +16% Damage now",
        "Press A to spend a Skill Point",
      ],
    ],
    [
      "held back by its Prerequisite",
      {
        ...golem,
        skillLevel: "0",
        canRaise: false,
        prerequisites: ["Raise Skeleton"],
      },
      "touch",
      ["Golem", "Skill Level 0", "Needs Raise Skeleton first"],
    ],
    [
      "held back by two Prerequisites",
      {
        ...golem,
        skillLevel: "0",
        canRaise: false,
        prerequisites: ["Golem", "Raise Archer"],
      },
      "touch",
      ["Golem", "Skill Level 0", "Needs Golem and Raise Archer first"],
    ],
    [
      "held back by its Level",
      { ...golem, skillLevel: "0", canRaise: false, requiredLevel: "6" },
      "touch",
      ["Golem", "Skill Level 0", "Needs Level 6"],
    ],
    [
      "held back by both",
      {
        ...golem,
        skillLevel: "0",
        canRaise: false,
        prerequisites: ["Raise Skeleton"],
        requiredLevel: "6",
      },
      "controller",
      ["Golem", "Skill Level 0", "Needs Raise Skeleton first", "Needs Level 6"],
    ],
  ] as const)("give a Skill's tooltip, %s, with %s", (_, sheet, way, lines) => {
    expect(skillTooltip(sheet, way)).toEqual(lines);
  });

  it.each([
    "mouseAndKeyboard",
    "controller",
    "touch",
  ] as const)("give a Skill Bar slot's Skill tooltip without the Skill Tree's lines, with %s", (way) => {
    const sheet = {
      ...golem,
      skillLevel: "2",
      canRaise: true,
      stats: ["Minion Life: 100"],
      nextStats: ["Minion Life: 120"],
      requiredLevel: "9",
    };
    expect(skillTooltip(sheet, way, { onSkillBar: true })).toEqual([
      "Golem",
      "Skill Level 2",
      "Minion Life: 100",
      "Next Skill Level",
      "Minion Life: 120",
      "Needs Level 9",
    ]);
  });
});
