import { describe, expect, it } from "vitest";
import { type FocusSpot, moveFocus } from "../input/focus";
import { DIRECTIONS } from "../input/pad";
import { createMenus } from "../menus";
import { inside, middleOf } from "../sim/rect";
import { createWorld, type World } from "../sim/world";
import { type Viewport, viewportOf } from "../viewport";
import { compactPanelRect } from "./compactLayout";
import { cursorHitAt } from "./cursorHit";
import {
  DIALOGUE,
  dialogueFocusSpots,
  dialogueHitAt,
  dialogueLayout,
  dialogueSheet,
  NPC_LINES,
} from "./dialoguePanel";
import { panelFocusSpots } from "./panelFocus";

/** A one-row Town with the Hero's `start` and the four NPCs on its tiles. */
function world(): World {
  const point = (name: string, type: string, x: number) => ({
    name,
    type,
    point: true,
    x: x * 32 + 16,
    y: 16,
  });
  const town = {
    orientation: "orthogonal",
    width: 6,
    height: 1,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 6,
        height: 1,
        data: [1, 1, 1, 1, 1, 1],
      },
      {
        type: "objectgroup",
        name: "objects",
        objects: [
          point("start", "entry", 0),
          point("Smith", "npc", 1),
          point("Elder", "npc", 2),
          point("Trader", "npc", 3),
          point("Wanderer", "npc", 4),
        ],
      },
    ],
  };
  return createWorld({ areas: { town }, seed: 1 });
}

const WIDE = viewportOf({ width: 1280, height: 800 });
const COMPACT = viewportOf({ width: 800, height: 400 });
const SCREENS: [string, Viewport][] = [
  ["wide", WIDE],
  ["compact", COMPACT],
];

describe("the Dialogue panel's sheet", () => {
  it("gives the NPC's name and a line of their own", () => {
    const w = world();
    const names = ["Smith", "Elder", "Trader", "Wanderer"];

    names.forEach((name, npc) => {
      const sheet = dialogueSheet(w, npc);
      expect(sheet?.name).toBe(name);
      expect(sheet?.lines).toEqual([NPC_LINES[name]]);
    });
    expect(new Set(Object.values(NPC_LINES)).size).toBe(4);
  });

  it("ends in a Goodbye button", () => {
    expect(dialogueSheet(world(), 0)?.buttons).toEqual([
      { label: "Goodbye", button: { type: "goodbye" } },
    ]);
  });

  it("is none for an NPC the Area doesn't have", () => {
    expect(dialogueSheet(world(), 9)).toBeNull();
  });
});

describe("the Dialogue panel's layout", () => {
  it("centres the panel on a wide screen and fills a compact one", () => {
    const wide = dialogueLayout(WIDE, 1).panel;
    expect(wide.x + wide.w / 2).toBeCloseTo(WIDE.width / 2);
    expect(wide.y + wide.h / 2).toBeCloseTo(WIDE.height / 2);
    expect(dialogueLayout(COMPACT, 1).panel).toEqual(compactPanelRect(COMPACT));
  });

  it.each(
    SCREENS,
  )("keeps the words and every button inside the panel and apart (%s)", (_, screen) => {
    const { panel, body, buttons, closeButton } = dialogueLayout(screen, 3);
    for (const rect of [body, ...buttons]) {
      expect(rect.x).toBeGreaterThanOrEqual(panel.x);
      expect(rect.x + rect.w).toBeLessThanOrEqual(panel.x + panel.w);
    }
    expect(buttons[0].y).toBeGreaterThanOrEqual(body.y + body.h);
    expect(buttons[1].y).toBeGreaterThanOrEqual(buttons[0].y + buttons[0].h);
    expect(closeButton.y + closeButton.h).toBeLessThan(body.y);
  });

  it("fits the panel on a wide screen however many buttons, up to three", () => {
    const { panel, buttons } = dialogueLayout(WIDE, 3);
    expect(buttons[2].y + buttons[2].h).toBeLessThanOrEqual(panel.y + panel.h);
  });

  it("makes each button at least a fingertip tall at a UI Scale of 1", () => {
    expect(DIALOGUE.rowHeight).toBeGreaterThanOrEqual(44);
  });
});

describe("a click on the Dialogue panel", () => {
  const sheet = dialogueSheet(world(), 0);
  const { buttons, closeButton } = dialogueLayout(WIDE, 1);

  it("presses Goodbye", () => {
    expect(dialogueHitAt(WIDE, middleOf(buttons[0]), sheet, true)).toEqual({
      button: { type: "goodbye" },
    });
  });

  it("shuts with the ×", () => {
    expect(dialogueHitAt(WIDE, middleOf(closeButton), sheet, true)).toEqual({
      button: { type: "close", panel: "dialogue" },
    });
  });

  it("does nothing on the words, but is not for the World", () => {
    const { body } = dialogueLayout(WIDE, 1);
    expect(dialogueHitAt(WIDE, middleOf(body), sheet, true)).toEqual({
      button: null,
    });
  });

  it("is for the World off the panel, or while shut", () => {
    expect(dialogueHitAt(WIDE, { x: 1, y: 1 }, sheet, true)).toBeNull();
    expect(dialogueHitAt(WIDE, middleOf(buttons[0]), sheet, false)).toBeNull();
  });
});

describe("the Dialogue panel's Focus spots", () => {
  const w = world();
  const open = { ...createMenus(), dialogueOpen: true, dialogueNpc: 0 };

  it.each(SCREENS)("are each button and the × (%s)", (_, screen) => {
    const spots = panelFocusSpots("dialogue", w, screen, undefined, 0);
    expect(spots.map((spot) => spot.hit)).toEqual([
      { button: { type: "goodbye" } },
      { button: { type: "close", panel: "dialogue" } },
    ]);
  });

  it.each(SCREENS)("each point where a click hits it (%s)", (_, screen) => {
    for (const spot of dialogueFocusSpots(w, screen, 0)) {
      expect(cursorHitAt(screen, spot.at, w, open)).toEqual(spot.hit);
    }
  });

  it.each(SCREENS)("are each reachable from any other (%s)", (_, screen) => {
    const spots: FocusSpot[] = dialogueFocusSpots(w, screen, 0);
    for (const from of spots) {
      const reached = new Set<FocusSpot>([from]);
      const next: FocusSpot[] = [from];
      while (next.length > 0) {
        const at = next.pop() as FocusSpot;
        for (const direction of DIRECTIONS) {
          const to = moveFocus(spots, at, direction);
          if (reached.has(to)) continue;
          reached.add(to);
          next.push(to);
        }
      }
      expect(reached.size).toBe(spots.length);
    }
  });
});

describe("the Dialogue panel on touch", () => {
  const w = world();
  const open = { ...createMenus(), dialogueOpen: true, dialogueNpc: 1 };

  it.each(SCREENS)("takes a tap on Goodbye as a click (%s)", (_, screen) => {
    const { buttons } = dialogueLayout(screen, 1);
    expect(cursorHitAt(screen, middleOf(buttons[0]), w, open, true)).toEqual({
      button: { type: "goodbye" },
    });
  });

  it.each(
    SCREENS,
  )("closes from a near miss on the × without reaching a button (%s)", (_, screen) => {
    const { closeButton, buttons } = dialogueLayout(screen, 1);
    const near = { x: closeButton.x - 5, y: middleOf(closeButton).y };
    expect(cursorHitAt(screen, near, w, open, true)).toEqual({
      button: { type: "close", panel: "dialogue" },
    });
    for (let y = closeButton.y; y < buttons[0].y + buttons[0].h; y += 1) {
      const point = { x: middleOf(closeButton).x, y };
      if (inside(buttons[0], point)) {
        expect(cursorHitAt(screen, point, w, open, true)).toEqual({
          button: { type: "goodbye" },
        });
      }
    }
  });
});
