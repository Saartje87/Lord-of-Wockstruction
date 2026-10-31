import { describe, expect, it } from "vitest";
import { emptyBelt } from "../sim/belt";
import { emptySkillBar } from "../sim/skillBar";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  skillManaCost,
  type World,
} from "../sim/world";
import { viewportOf } from "../viewport";
import { skillTooltip } from "./hints";
import { itemTooltip } from "./inventoryPanel";
import { skillBarSheet } from "./skillBar";
import { skillTreeFocusSpots, skillTreeSheet } from "./skillTreePanel";

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

const screen = viewportOf({ width: 1280, height: 720 });

/** A Level 3 Hero with the Golem learned to `golem`, a Wand in the Off-hand raising it by 1. */
function wanded(golem: number, wand = true, bar = emptySkillBar()): World {
  const progress: Progress = {
    ...FRESH_PROGRESS,
    level: 3,
    experience: 1_500,
    attributePoints: 10,
    skillPoints: 2 - golem,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, raiseSkeleton: 1, golem },
    skillBar: bar,
  };
  return createWorld({
    areas: { town },
    seed: 1,
    progress,
    belongings: {
      inventory: [],
      equipment: wand
        ? {
            offHand: {
              type: "boneWand",
              rarity: "magic",
              affixes: [{ kind: "skillGolem", grade: 0, value: 1 }],
            },
          }
        : {},
      belt: emptyBelt(),
    },
  });
}

const golemRow = (w: World) => {
  const row = skillTreeSheet(w).skills.find((r) => r.skill === "golem");
  if (!row) throw new Error("No Golem row");
  return row;
};

describe("a Skill Level Affix's tooltip line", () => {
  it('reads "+N to <Skill>"', () => {
    expect(
      itemTooltip({
        type: "boneWand",
        affixes: [{ kind: "skillBoneSpear", grade: 1, value: 2 }],
      }),
    ).toContain("+2 to Bone Spear");
  });
});

describe("a Wand's raise on the Skill Tree and in Skill tooltips", () => {
  it("shows the Skill Level with the raise included, and the raise apart", () => {
    expect(golemRow(wanded(2))).toMatchObject({ skillLevel: "3", raised: "1" });
    expect(golemRow(wanded(2, false))).toMatchObject({
      skillLevel: "2",
      raised: "",
    });
    expect(skillTooltip(golemRow(wanded(2)), "mouseAndKeyboard")).toContain(
      "Skill Level 3 (+1)",
    );
    expect(
      skillTooltip(golemRow(wanded(2, false)), "mouseAndKeyboard"),
    ).toContain("Skill Level 2");
  });

  it("prices the next Skill Point by the Skill Level it would make", () => {
    expect(golemRow(wanded(1)).manaCost).toBe(
      String(skillManaCost("golem", 3)),
    );
  });

  it("lets a Skill only a Wand raised be picked up", () => {
    const picksUpGolem = (w: World) =>
      skillTreeFocusSpots(w, screen).some(
        (spot) =>
          spot.secondHit?.button?.type === "pickUpSkill" &&
          spot.secondHit.button.skill === "golem",
      );
    expect(picksUpGolem(wanded(0))).toBe(true);
    expect(picksUpGolem(wanded(0, false))).toBe(false);
  });
});

describe("a Skill at Skill Level 0 on the Skill Bar", () => {
  const key2 = (w: World) => {
    const found = skillBarSheet(w).find((s) => s.slot === "key2");
    if (!found) throw new Error("No key2");
    return found;
  };
  const bar = { ...emptySkillBar(), key2: "golem" } as const;

  it("stays, drawn as not castable, and works again once raised", () => {
    const bare = wanded(0, false, bar);
    bare.hero.mana = 100;
    expect(key2(bare)).toMatchObject({ name: "Golem", dimmed: true });
    const raised = wanded(0, true, bar);
    raised.hero.mana = 100;
    expect(key2(raised)).toMatchObject({ name: "Golem", dimmed: false });
  });
});
