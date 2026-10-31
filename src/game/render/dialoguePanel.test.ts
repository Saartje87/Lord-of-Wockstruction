import { describe, expect, it } from "vitest";
import { type FocusSpot, moveFocus } from "../input/focus";
import { DIRECTIONS } from "../input/pad";
import { createMenus } from "../menus";
import type { QuestId, QuestState } from "../sim/quests";
import { inside, middleOf } from "../sim/rect";
import { createWorld, type World } from "../sim/world";
import { questTuning } from "../tuning/quests";
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

const SMITH = 0;
const ELDER = 1;
const TRADER = 2;
const WANDERER = 3;

/** A World whose Quests stand as `states` says, the rest Not given. */
function worldWith(states: Partial<Record<QuestId, QuestState>>): World {
  const w = world();
  for (const [id, state] of Object.entries(states)) {
    w.hero.progress.quests[id as QuestId].state = state as QuestState;
  }
  return w;
}

describe("the Dialogue panel's sheet", () => {
  it("gives each NPC's name", () => {
    const w = world();
    const names = ["Smith", "Elder", "Trader", "Wanderer"];

    names.forEach((name, npc) => {
      expect(dialogueSheet(w, npc)?.name).toBe(name);
    });
  });

  it("gives an NPC without a Quest a line of their own and only Goodbye", () => {
    const sheet = dialogueSheet(world(), WANDERER);

    expect(sheet?.lines).toEqual([NPC_LINES.Wanderer]);
    expect(sheet?.buttons).toEqual([
      { label: "Goodbye", button: { type: "goodbye" } },
    ]);
  });

  it("offers a Quest Not given to accept, ahead of Goodbye, with its line", () => {
    const sheet = dialogueSheet(world(), TRADER);

    expect(sheet?.lines).toEqual([questTuning["bog-off"].lines.notGiven]);
    expect(sheet?.buttons).toEqual([
      {
        label: 'Accept "Bog Off"',
        button: { type: "acceptQuest", quest: "bog-off" },
      },
      { label: "Goodbye", button: { type: "goodbye" } },
    ]);
  });

  it("says something else while the Quest is Given, with only Goodbye", () => {
    const sheet = dialogueSheet(worldWith({ "bog-off": "given" }), TRADER);

    expect(sheet?.lines).toEqual([questTuning["bog-off"].lines.given]);
    expect(sheet?.buttons.map(({ button }) => button.type)).toEqual([
      "goodbye",
    ]);
  });

  it("offers a Quest Ready to hand in, with its line", () => {
    const sheet = dialogueSheet(worldWith({ "bog-off": "ready" }), TRADER);

    expect(sheet?.lines).toEqual([questTuning["bog-off"].lines.ready]);
    expect(sheet?.buttons[0]).toEqual({
      label: 'Hand in "Bog Off"',
      button: { type: "handInQuest", quest: "bog-off" },
    });
  });

  it("says something else once the Quest is Done, with only Goodbye", () => {
    const sheet = dialogueSheet(worldWith({ "bog-off": "done" }), TRADER);

    expect(sheet?.lines).toEqual([questTuning["bog-off"].lines.done]);
    expect(sheet?.buttons.map(({ button }) => button.type)).toEqual([
      "goodbye",
    ]);
  });

  it("deals with one of an NPC's Quests at a time, the one to hand in first", () => {
    const first = dialogueSheet(world(), ELDER);
    expect(first?.buttons[0].button).toEqual({
      type: "acceptQuest",
      quest: "lost-wanderer",
    });

    const second = dialogueSheet(
      worldWith({ "lost-wanderer": "given" }),
      ELDER,
    );
    expect(second?.buttons[0].button).toEqual({
      type: "acceptQuest",
      quest: "act-boss",
    });

    const ready = dialogueSheet(
      worldWith({ "lost-wanderer": "ready", "act-boss": "given" }),
      ELDER,
    );
    expect(ready?.buttons[0].button).toEqual({
      type: "handInQuest",
      quest: "lost-wanderer",
    });
  });

  it("keeps the Smith's own Quest for him", () => {
    expect(dialogueSheet(world(), SMITH)?.buttons[0].button).toEqual({
      type: "acceptQuest",
      quest: "spa-day",
    });
  });

  it("is none for an NPC the Area doesn't have", () => {
    expect(dialogueSheet(world(), 9)).toBeNull();
  });
});

/** A World whose Spa Day is Done, with the Smith's service `service` and an Axe, a Chain Mail and a Ring carried. */
function smithWorld(service: "unlocked" | "used" | "locked" = "unlocked") {
  const w = worldWith({ "spa-day": "done" });
  w.hero.progress.smithService = service;
  const carried = (
    id: number,
    type: "axe" | "chainMail" | "ring",
    column: number,
  ) =>
    w.hero.inventory.push({
      item: { id, type, rarity: "normal", affixes: [] },
      cell: { column, row: 0 },
    });
  carried(101, "axe", 0);
  carried(102, "chainMail", 2);
  carried(103, "ring", 4);
  return w;
}

describe("the Smith's service on the Dialogue panel", () => {
  it("is offered once Spa Day is Done, ahead of Goodbye", () => {
    const sheet = dialogueSheet(smithWorld(), SMITH);

    expect(sheet?.lines).toEqual([questTuning["spa-day"].lines.done]);
    expect(sheet?.buttons).toEqual([
      { label: "Smith's service", button: { type: "smithService" } },
      { label: "Goodbye", button: { type: "goodbye" } },
    ]);
  });

  it.each(["locked", "used"] as const)("isn't offered while %s", (service) => {
    const sheet = dialogueSheet(smithWorld(service), SMITH);

    expect(sheet?.buttons.map(({ button }) => button.type)).toEqual([
      "goodbye",
    ]);
  });

  it("isn't offered by other NPCs", () => {
    const sheet = dialogueSheet(smithWorld(), ELDER);

    expect(sheet?.buttons.map(({ button }) => button.type)).not.toContain(
      "smithService",
    );
  });

  it("lists only the Weapons and Armour without a bonus, Equipped first", () => {
    const sheet = dialogueSheet(smithWorld(), SMITH, 1);

    expect(sheet?.buttons.map(({ label }) => label)).toEqual([
      "Short Sword (Equipped)",
      "Axe",
      "More gear",
      "Goodbye",
    ]);
    expect(
      dialogueSheet(smithWorld(), SMITH, 2)?.buttons.map(({ label }) => label),
    ).toEqual(["Chain Mail", "More gear", "Goodbye"]);
    expect(sheet?.buttons[1].button).toEqual({ type: "smithForge", item: 101 });
  });

  it("leaves out an Item that already has a bonus", () => {
    const w = smithWorld();
    w.hero.inventory[0].item.smithBonus = { bonus: "strength", amount: 3 };

    const labels = dialogueSheet(w, SMITH, 1)?.buttons.map((b) => b.label);

    expect(labels).not.toContain("Axe");
  });

  it("pages through more than two Items", () => {
    const w = smithWorld();
    w.hero.inventory.push(
      {
        item: { id: 104, type: "axe", rarity: "normal", affixes: [] },
        cell: { column: 0, row: 1 },
      },
      {
        item: { id: 105, type: "axe", rarity: "normal", affixes: [] },
        cell: { column: 2, row: 1 },
      },
    );

    const first = dialogueSheet(w, SMITH, 1)?.buttons;
    const last = dialogueSheet(w, SMITH, 3)?.buttons;
    const wrapped = dialogueSheet(w, SMITH, 4)?.buttons;

    expect(first?.map((b) => b.button.type)).toEqual([
      "smithForge",
      "smithForge",
      "smithMore",
      "goodbye",
    ]);
    expect(last?.map((b) => b.button.type)).toEqual([
      "smithForge",
      "smithMore",
      "goodbye",
    ]);
    expect(wrapped).toEqual(first);
  });

  it("says so when there is nothing to work on", () => {
    const w = smithWorld();
    w.hero.inventory.length = 0;
    w.hero.equipment.weapon = null;

    const sheet = dialogueSheet(w, SMITH, 1);

    expect(sheet?.buttons.map(({ button }) => button.type)).toEqual([
      "goodbye",
    ]);
  });

  it("goes back to talking when the service is used up", () => {
    const sheet = dialogueSheet(smithWorld("used"), SMITH, 1);

    expect(sheet?.lines).toEqual([questTuning["spa-day"].lines.done]);
  });

  it("is reachable by Focus and a click", () => {
    const w = smithWorld();
    const spots = panelFocusSpots("dialogue", w, WIDE, undefined, SMITH, 1);
    const hits = spots.map((spot) => spot.hit);

    expect(hits[1]).toEqual({ button: { type: "smithForge", item: 101 } });
    const compact = panelFocusSpots(
      "dialogue",
      w,
      COMPACT,
      undefined,
      SMITH,
      1,
    );
    expect(compact.map((spot) => spot.hit)).toEqual(hits);
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

  it("makes each button at least a fingertip tall at a UI Scale of 1", () => {
    expect(DIALOGUE.rowHeight).toBeGreaterThanOrEqual(44);
  });
});

describe("a click on the Dialogue panel", () => {
  const sheet = dialogueSheet(world(), WANDERER);
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
  const open = { ...createMenus(), dialogueOpen: true, dialogueNpc: WANDERER };

  it.each(SCREENS)("are each button and the × (%s)", (_, screen) => {
    const spots = panelFocusSpots("dialogue", w, screen, undefined, WANDERER);
    expect(spots.map((spot) => spot.hit)).toEqual([
      { button: { type: "goodbye" } },
      { button: { type: "close", panel: "dialogue" } },
    ]);
  });

  it.each(
    SCREENS,
  )("start with the Quest button for an NPC with one to give (%s)", (_, screen) => {
    const spots = panelFocusSpots("dialogue", w, screen, undefined, SMITH);
    expect(spots.map((spot) => spot.hit)).toEqual([
      { button: { type: "acceptQuest", quest: "spa-day" } },
      { button: { type: "goodbye" } },
      { button: { type: "close", panel: "dialogue" } },
    ]);
  });

  it.each(SCREENS)("each point where a click hits it (%s)", (_, screen) => {
    for (const spot of dialogueFocusSpots(w, screen, WANDERER)) {
      expect(cursorHitAt(screen, spot.at, w, open)).toEqual(spot.hit);
    }
  });

  it.each(SCREENS)("are each reachable from any other (%s)", (_, screen) => {
    const spots: FocusSpot[] = dialogueFocusSpots(w, screen, WANDERER);
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
  const open = { ...createMenus(), dialogueOpen: true, dialogueNpc: WANDERER };

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

describe("the Vendor's Dialogue panel", () => {
  const vendorWorld = () => {
    const w = world();
    w.areas.town.npcs[TRADER].vendor = true;
    return w;
  };

  it.each(SCREENS)("offers Trade just ahead of Goodbye (%s)", (_, screen) => {
    const w = vendorWorld();
    const types = dialogueSheet(w, TRADER)?.buttons.map((b) => b.button.type);
    expect(types?.slice(-2)).toEqual(["trade", "goodbye"]);
    const spots = panelFocusSpots("dialogue", w, screen, undefined, TRADER);
    expect(spots.map((spot) => spot.hit)).toContainEqual({
      button: { type: "trade" },
    });
  });

  it.each(SCREENS)("takes a click and a tap on Trade (%s)", (_, screen) => {
    const w = vendorWorld();
    const sheet = dialogueSheet(w, TRADER);
    const index = sheet?.buttons.findIndex((b) => b.button.type === "trade");
    const open = { ...createMenus(), dialogueOpen: true, dialogueNpc: TRADER };
    const { buttons } = dialogueLayout(screen, sheet?.buttons.length ?? 0);
    for (const touch of [false, true]) {
      expect(
        cursorHitAt(screen, middleOf(buttons[index ?? 0]), w, open, touch),
      ).toEqual({ button: { type: "trade" } });
    }
  });

  it("offers Trade after the Quest it has to give, never ahead of it", () => {
    const w = vendorWorld();
    const types = dialogueSheet(w, TRADER)?.buttons.map((b) => b.button.type);
    expect(types?.indexOf("trade")).toBeGreaterThan(0);
  });

  it("is offered by no one else", () => {
    const w = vendorWorld();
    for (const npc of [SMITH, ELDER, WANDERER]) {
      const types = dialogueSheet(w, npc)?.buttons.map((b) => b.button.type);
      expect(types).not.toContain("trade");
    }
  });
});
