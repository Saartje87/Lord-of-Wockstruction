import { describe, expect, it } from "vitest";
import { overlaps } from "../sim/rect";
import { emptySkillBar, SKILL_BAR_SLOTS } from "../sim/skillBar";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  type World,
} from "../sim/world";
import {
  skillBarHitAt,
  skillBarLayout,
  skillBarSheet,
  skillDropOrder,
} from "./skillBar";

const town = {
  orientation: "orthogonal",
  width: 2,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 2, height: 1, data: [1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [{ name: "start", type: "entry", x: 16, y: 16 }],
    },
  ],
};

/** A Level 2 Hero with the Golem learned and in keyed slot 2. */
const GOLEM_IN_KEY2: Progress = {
  ...FRESH_PROGRESS,
  level: 2,
  experience: 500,
  attributePoints: 5,
  skillLevels: { golem: 1 },
  skillBar: { ...emptySkillBar(), key2: "golem" },
};

function world(progress?: Progress): World {
  return createWorld({ areas: { town }, seed: 1, progress });
}

const screen = { width: 1280, height: 720 };

describe("the Skill Bar's layout", () => {
  it("sits centred between the orbs, keyed slots 1–4 then the right-click slot", () => {
    const { slots } = skillBarLayout(screen);
    const order = ["key1", "key2", "key3", "key4", "right"] as const;

    for (let i = 1; i < order.length; i++) {
      expect(slots[order[i]].x).toBeGreaterThan(slots[order[i - 1]].x);
      expect(overlaps(slots[order[i]], slots[order[i - 1]])).toBe(false);
    }
    const left = slots.key1.x;
    const right = slots.right.x + slots.right.w;
    expect((left + right) / 2).toBeCloseTo(screen.width / 2);
    // Above the stone strip, clear of the orbs' 144 px at each side.
    expect(left).toBeGreaterThan(144);
    expect(slots.key1.y + slots.key1.h).toBeLessThan(screen.height - 34);
  });
});

describe("the Skill Bar's sheet", () => {
  it("shows each slot's key and Skill, empty slots without one", () => {
    expect(skillBarSheet(world(GOLEM_IN_KEY2))).toEqual([
      { slot: "key1", key: "1", name: null, dimmed: false },
      { slot: "key2", key: "2", name: "Golem", dimmed: false },
      { slot: "key3", key: "3", name: null, dimmed: false },
      { slot: "key4", key: "4", name: null, dimmed: false },
      { slot: "right", key: "RMB", name: null, dimmed: false },
    ]);
  });

  it("dims a Skill the Hero lacks the Mana for", () => {
    const w = world(GOLEM_IN_KEY2);

    w.hero.mana = 15;
    expect(skillBarSheet(w)[1].dimmed).toBe(false);
    w.hero.mana = 14.9;
    expect(skillBarSheet(w)[1].dimmed).toBe(true);
  });
});

describe("a click on the Skill Bar", () => {
  it("hits the slot under it, so it's not for the World", () => {
    const { slots } = skillBarLayout(screen);
    for (const slot of SKILL_BAR_SLOTS) {
      const centre = {
        x: slots[slot].x + slots[slot].w / 2,
        y: slots[slot].y + slots[slot].h / 2,
      };
      expect(skillBarHitAt(screen, centre)).toEqual({
        button: { type: "skillBarSlot", slot },
      });
    }
  });

  it("is for the World off the slots", () => {
    expect(skillBarHitAt(screen, { x: 640, y: 300 })).toBeNull();
  });
});

describe("dropping a dragged Skill", () => {
  it("onto a slot puts it there", () => {
    const { slots } = skillBarLayout(screen);
    const at = { x: slots.key4.x + 2, y: slots.key4.y + slots.key4.h - 2 };

    expect(skillDropOrder(screen, at, "golem")).toEqual({
      type: "PutSkillOnBar",
      skill: "golem",
      slot: "key4",
    });
  });

  it("anywhere else, or off the canvas, does nothing", () => {
    expect(skillDropOrder(screen, { x: 640, y: 300 }, "golem")).toBeNull();
    expect(skillDropOrder(screen, null, "golem")).toBeNull();
  });
});
