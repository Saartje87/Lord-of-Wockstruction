import { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import {
  BRANCHES,
  branchSkills,
  type Skill,
  skillTuning,
} from "../tuning/skills";
import { BRANCH_COLOURS, drawSkillIcon, SKILL_ICONS } from "./skillIcons";

const box = { x: 10, y: 20, w: 40, h: 40 };

/** What drawing `skill`'s icon in `box` puts on a fresh Graphics. */
function drawn(skill: Skill) {
  const graphics = new Graphics();
  drawSkillIcon(graphics, skill, box, 1);
  return graphics;
}

describe("Skill icons", () => {
  const skills = BRANCHES.flatMap((branch) => branchSkills[branch]);

  it("covers every Skill", () => {
    expect(Object.keys(SKILL_ICONS).sort()).toEqual(
      Object.keys(skillTuning).sort(),
    );
    expect(skills).toHaveLength(16);
  });

  it("draws something for each Skill, inside its box", () => {
    for (const skill of skills) {
      const graphics = drawn(skill);
      expect(graphics.context.instructions.length, skill).toBeGreaterThan(0);
      const bounds = graphics.getLocalBounds();
      expect(bounds.width, skill).toBeGreaterThan(box.w * 0.3);
      expect(bounds.x, skill).toBeGreaterThanOrEqual(box.x - 2);
      expect(bounds.y, skill).toBeGreaterThanOrEqual(box.y - 2);
      expect(bounds.x + bounds.width, skill).toBeLessThanOrEqual(
        box.x + box.w + 2,
      );
      expect(bounds.y + bounds.height, skill).toBeLessThanOrEqual(
        box.y + box.h + 2,
      );
    }
  });

  it("tells the Skills of a Branch apart", () => {
    for (const branch of BRANCHES) {
      const shapes = branchSkills[branch].map((skill) =>
        JSON.stringify(drawn(skill).context.instructions, (key, value) =>
          key === "texture" ? undefined : value,
        ),
      );
      expect(new Set(shapes).size).toBe(shapes.length);
    }
  });

  it("colours each Branch differently", () => {
    const colours = BRANCHES.map((branch) => BRANCH_COLOURS[branch]);
    expect(new Set(colours).size).toBe(BRANCHES.length);
  });
});
