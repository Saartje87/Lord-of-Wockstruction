import { describe, expect, it } from "vitest";
import { overlaps, type Rect } from "../sim/rect";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  step,
  type World,
} from "../sim/world";
import {
  BRANCHES,
  type Branch,
  branchSkills,
  type Skill,
  skillTuning,
} from "../tuning/skills";
import { viewportOf } from "../viewport";
import { inventoryPanelLayout } from "./inventoryPanel";
import {
  SKILL_TREE_PANEL,
  skillTreeFocusSpots,
  skillTreeHitAt,
  skillTreePanelLayout,
  skillTreeSheet,
} from "./skillTreePanel";

/**
 * A Town of three tiles in a row, the Hero's `start` on the first and a
 * Skeleton on the last.
 */
const town = {
  orientation: "orthogonal",
  width: 3,
  height: 1,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { type: "tilelayer", name: "floor", width: 3, height: 1, data: [1, 1, 1] },
    {
      type: "objectgroup",
      name: "objects",
      objects: [
        { name: "start", type: "entry", point: true, x: 16, y: 16 },
        {
          name: "",
          type: "monsterSpawn",
          point: true,
          x: 80,
          y: 16,
          properties: [
            { name: "monster", type: "string", value: "skeleton" },
            { name: "count", type: "int", value: 1 },
          ],
        },
      ],
    },
  ],
};

function world(progress?: Progress): World {
  return createWorld({ areas: { town }, seed: 1, progress });
}

/** A Level 3 Hero with the Golem at `golem` and the rest of their 2 Skill Points unspent. */
function withGolem(golem: number): World {
  return world({
    ...FRESH_PROGRESS,
    level: 3,
    experience: 1_500,
    attributePoints: 10,
    skillPoints: 2 - golem,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, raiseSkeleton: 1, golem },
  });
}

/** Stands still by the Skeleton until it kills the Hero. */
function kill(w: World) {
  for (let i = 0; !w.death; i++) {
    if (i > 60 * 60) throw new Error("The Hero didn't die");
    step(w, []);
  }
}

/** The rows of a Belt Column with no Belt Equipped. */
const ONE_ROW = 1;

/** The sheet's row of `skill`. */
const rowOf = (w: World, skill: Skill) => {
  const found = skillTreeSheet(w).skills.find((row) => row.skill === skill);
  if (!found) throw new Error(`No row for ${skill}`);
  return found;
};

describe("skillTreeSheet", () => {
  it("shows a New Hero's Skills unlearned, with what Skill Level 1 costs", () => {
    const sheet = skillTreeSheet(world());
    const order: Skill[] = [
      "boneWard",
      "corpseExplosion",
      "boneSpear",
      "boneWall",
      "splinterVolley",
      "ossifiedWill",
      "raiseSkeleton",
      "golem",
      "raiseArcher",
      "graveCommand",
      "amplifyDamage",
      "weaken",
      "leadenLimbs",
      "dread",
      "lingeringMalice",
    ];

    expect(sheet.skillPoints).toBe("0");
    expect(sheet.skills.map((row) => row.skill)).toEqual(order);
    expect(sheet.skills.map((row) => row.canRaise)).toEqual(
      order.map(() => false),
    );
    expect(rowOf(world(), "golem")).toMatchObject({
      name: "Golem",
      skillLevel: "0",
      requiredLevel: null,
    });
    expect(rowOf(world(), "boneSpear")).toMatchObject({
      name: "Bone Spear",
      skillLevel: "0",
      requiredLevel: "6",
    });
  });

  it("groups the Skills in Bone, Summoning and Curses, each in Prerequisite order", () => {
    const sheet = skillTreeSheet(world());

    expect(sheet.branches.map((b) => b.name)).toEqual([
      "Bone",
      "Summoning",
      "Curses",
    ]);
    expect(sheet.skills.map((row) => [row.branch, row.skill])).toEqual(
      BRANCHES.flatMap((branch) =>
        branchSkills[branch].map((skill) => [branch, skill]),
      ),
    );
  });

  it("names the Prerequisite holding a Skill back until it has a Skill Level", () => {
    const bare = world({
      ...FRESH_PROGRESS,
      level: 3,
      experience: 1_500,
      skillPoints: 2,
    });

    expect(rowOf(bare, "golem")).toMatchObject({
      prerequisites: [skillTuning.raiseSkeleton.name],
      canRaise: false,
    });
    expect(rowOf(withGolem(0), "golem")).toMatchObject({
      prerequisites: [],
      canRaise: true,
    });
    // The first of a Branch has none.
    expect(rowOf(bare, "boneWard")).toMatchObject({
      prerequisites: [],
      canRaise: true,
    });
  });

  it("names every Prerequisite still without a Skill Level, and drops each once learned", () => {
    const progress = {
      ...FRESH_PROGRESS,
      level: 12,
      experience: 100_000,
      skillPoints: 2,
    };

    expect(rowOf(world(progress), "graveCommand").prerequisites).toEqual([
      skillTuning.golem.name,
      skillTuning.raiseArcher.name,
    ]);
    const learned = {
      ...progress,
      skillLevels: { ...progress.skillLevels, golem: 1 },
    };
    expect(rowOf(world(learned), "graveCommand")).toMatchObject({
      prerequisites: [skillTuning.raiseArcher.name],
      canRaise: false,
    });
  });

  it("lists a Skill's Synergies with what they add now, from the givers' Skill Levels", () => {
    const [synergy] = skillTuning.corpseExplosion.synergies;
    if (!synergy) throw new Error("No Synergy");
    const giver = skillTuning[synergy.skill].name;
    const percent = String(synergy.percentPerSkillLevel);
    const w = world({
      ...FRESH_PROGRESS,
      level: 10,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, [synergy.skill]: 3 },
    });

    expect(rowOf(w, "corpseExplosion")).toMatchObject({
      synergies: [
        {
          giver,
          percentPerSkillLevel: percent,
          total: String(synergy.percentPerSkillLevel * 3),
        },
      ],
      synergyTotal: String(synergy.percentPerSkillLevel * 3),
    });
    expect(rowOf(w, "boneWall")).toMatchObject({
      synergies: [],
      synergyTotal: "0",
    });
  });

  it("marks Passive Skills, with no Mana cost, and what they add now", () => {
    const { percentPerSkillLevel } = skillTuning.graveCommand.passive;
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, graveCommand: 3 },
    });

    expect(rowOf(w, "graveCommand")).toMatchObject({
      passive: {
        percentPerSkillLevel: String(percentPerSkillLevel),
        total: String(percentPerSkillLevel * 3),
      },
      synergies: [],
    });
    expect(rowOf(w, "golem").passive).toBeNull();
  });

  it("shows a + while a point is unspent", () => {
    const w = withGolem(0);
    const golemRow = () => rowOf(w, "golem");

    expect(skillTreeSheet(w).skillPoints).toBe("2");
    expect(golemRow()).toMatchObject({
      skillLevel: "0",
      canRaise: true,
    });

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(skillTreeSheet(w).skillPoints).toBe("1");
    expect(golemRow()).toMatchObject({
      skillLevel: "1",
      canRaise: true,
    });

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(skillTreeSheet(w).skillPoints).toBe("0");
    expect(golemRow()).toMatchObject({
      skillLevel: "2",
      canRaise: false,
    });
  });

  it("carries a cast Skill's stat lines, Skill Level 1's while unlearned, and the next Skill Level's only while a point can be spent", () => {
    const w = withGolem(0);
    const mana = (lines: readonly string[]) =>
      lines.find((one) => one.startsWith("Mana: "));

    // Unlearned with a point to spend: Skill Level 1's lines, no next block.
    expect(mana(rowOf(w, "golem").stats)).toBe("Mana: 15");
    expect(rowOf(w, "golem").nextStats).toEqual([]);

    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(mana(rowOf(w, "golem").stats)).toBe("Mana: 15");
    expect(mana(rowOf(w, "golem").nextStats)).toBe("Mana: 17");

    // No point left: only the current lines.
    step(w, [{ type: "SpendSkillPoint", skill: "golem" }]);
    expect(mana(rowOf(w, "golem").stats)).toBe("Mana: 17");
    expect(rowOf(w, "golem").nextStats).toEqual([]);
  });

  it("carries no stat lines for a Passive Skill", () => {
    expect(rowOf(world(), "graveCommand").stats).toEqual([]);
    expect(rowOf(world(), "graveCommand").nextStats).toEqual([]);
  });

  it("shows the required Level, and no +, until the Hero reaches it", () => {
    skillTuning.golem.requiredLevel = 6;

    expect(rowOf(withGolem(0), "golem")).toMatchObject({
      requiredLevel: "6",
      canRaise: false,
    });

    skillTuning.golem.requiredLevel = 3;
    expect(rowOf(withGolem(0), "golem")).toMatchObject({
      requiredLevel: null,
      canRaise: true,
    });
  });

  it("shows no + while the Hero is dead", () => {
    const w = withGolem(0);
    kill(w);

    expect(rowOf(w, "golem").canRaise).toBe(false);
  });
});

describe("skillTreeSheet's Branch tabs and arrows", () => {
  it("gives the Skill Points spent in each Branch, not the Wand's raises", () => {
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: {
        ...FRESH_PROGRESS.skillLevels,
        boneWard: 2,
        corpseExplosion: 1,
        raiseSkeleton: 3,
      },
    });

    expect(skillTreeSheet(w).branches.map((b) => b.spent)).toEqual([
      "3",
      "3",
      "0",
    ]);
  });

  it("gives each Skill its grid place and an arrow to each Prerequisite, lit once that has a Skill Level", () => {
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, boneSpear: 1 },
    });

    expect(rowOf(w, "splinterVolley").grid).toEqual(
      skillTuning.splinterVolley.grid,
    );
    expect(rowOf(w, "splinterVolley").arrows).toEqual([
      { from: "boneSpear", lit: true },
      { from: "boneWall", lit: false },
    ]);
    expect(rowOf(w, "boneWard").arrows).toEqual([]);
  });
});

describe("skillTreePanelLayout", () => {
  const screen = viewportOf({ width: 1280, height: 720 });
  const centre = (rect: Rect) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });
  const tileOf = (branch: Branch, skill: Skill) => {
    const found = skillTreePanelLayout(screen, branch).skills.find(
      (shown) => shown.skill === skill,
    );
    if (!found) throw new Error(`No tile for ${skill}`);
    return found;
  };

  it("sits where the Inventory panel does, at the right", () => {
    const inventory = inventoryPanelLayout(screen, ONE_ROW).panel;
    const { panel } = skillTreePanelLayout(screen);

    expect(panel.x + panel.w).toBe(inventory.x + inventory.w);
    expect(panel.y).toBe(inventory.y);
  });

  it.each(
    BRANCHES,
  )("draws only the %s Branch's Skills, each at its grid place and clear of the others", (branch) => {
    const { skills, panel } = skillTreePanelLayout(screen, branch);

    expect(skills.map((shown) => shown.skill)).toEqual(branchSkills[branch]);
    for (const { skill, tile, raise } of skills) {
      expectInside(tile, panel);
      expectInside(raise, tile);
      for (const other of skills) {
        if (other.skill === skill) continue;
        expect(overlaps(tile, other.tile), `${skill} and ${other.skill}`).toBe(
          false,
        );
      }
    }
    // Rows go down and columns across, as the tuning places them.
    for (const a of skills) {
      for (const b of skills) {
        const [pa, pb] = [skillTuning[a.skill].grid, skillTuning[b.skill].grid];
        if (pa.row < pb.row) expect(a.tile.y).toBeLessThan(b.tile.y);
        if (pa.column < pb.column) expect(a.tile.x).toBeLessThan(b.tile.x);
      }
    }
  });

  it("draws an arrow from each Prerequisite's tile down into its Skill's", () => {
    const { arrows } = skillTreePanelLayout(screen, "bone");
    const volley = arrows.filter((arrow) => arrow.to === "splinterVolley");
    const tile = (skill: Skill) => tileOf("bone", skill).tile;

    expect(volley.map((arrow) => arrow.from).sort()).toEqual([
      "boneSpear",
      "boneWall",
    ]);
    for (const arrow of volley) {
      const [first] = arrow.points;
      const last = arrow.points[arrow.points.length - 1];
      expect(first.y).toBe(tile(arrow.from).y + tile(arrow.from).h);
      expect(last.y).toBe(tile("splinterVolley").y);
      expect(last.x).toBe(centre(tile("splinterVolley")).x);
    }
    expect(arrows.some((arrow) => arrow.to === "boneWard")).toBe(false);
  });

  it("gives three tabs along the top of the grid, one per Branch", () => {
    const { tabs, skills, closeButton } = skillTreePanelLayout(screen);
    const rects = BRANCHES.map((branch) => tabs[branch]);

    for (const tab of rects) {
      expect(tab.y).toBeGreaterThanOrEqual(closeButton.y + closeButton.h);
      expect(tab.y + tab.h).toBeLessThanOrEqual(
        Math.min(...skills.map((shown) => shown.tile.y)),
      );
    }
    expect(rects[0].x + rects[0].w).toBeLessThan(rects[1].x);
    expect(rects[1].x + rects[1].w).toBeLessThan(rects[2].x);
  });

  it("puts a + on a tile's top right, inside it", () => {
    const { tile, raise } = tileOf("summoning", "golem");

    expect(raise.x + raise.w).toBe(tile.x + tile.w);
    expect(raise.y).toBe(tile.y);
  });

  it("tiles each Skill the same size", () => {
    const { skills } = skillTreePanelLayout(screen, "curses");

    expect(new Set(skills.map((shown) => shown.tile.w)).size).toBe(1);
    expect(skills[0].tile.w).toBe(SKILL_TREE_PANEL.tile);
  });
});

describe("skillTreeHitAt", () => {
  const screen = viewportOf({ width: 1280, height: 720 });
  const layout = skillTreePanelLayout(screen, "summoning");
  const centre = (rect: Rect) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  });
  const golem = layout.skills.find((shown) => shown.skill === "golem") as {
    tile: Rect;
    raise: Rect;
  };
  const hitAt = (point: { x: number; y: number }, w: World, open = true) =>
    skillTreeHitAt(screen, point, w, open, "summoning");

  it("finds a Skill's + only while the panel is open and it can be raised", () => {
    const at = centre(golem.raise);

    expect(hitAt(at, withGolem(1))).toEqual({
      button: { type: "learn", skill: "golem" },
    });
    // No + without a Skill Point: there it's just the learned Skill's tile.
    expect(hitAt(at, withGolem(2))).toEqual({
      button: { type: "pickUpSkill", skill: "golem" },
    });
    expect(hitAt(at, withGolem(1), false)).toBeNull();
  });

  it("finds no + below the Skill's required Level", () => {
    skillTuning.golem.requiredLevel = 6;

    expect(hitAt(centre(golem.raise), withGolem(0))).toEqual({ button: null });
  });

  it("finds a + with no Skill Point on a Skill whose Prerequisite is unlearned", () => {
    const w = world({ ...FRESH_PROGRESS, level: 20, skillPoints: 3 });

    expect(hitAt(centre(golem.raise), w)).toEqual({ button: null });
  });

  it("picks up a learned Skill pressed anywhere on its tile but its +", () => {
    const { tile } = golem;
    const corner = { x: tile.x + 4, y: tile.y + tile.h - 4 };
    const far = { x: tile.x + tile.w - 4, y: tile.y + tile.h - 4 };
    const drag = { button: { type: "pickUpSkill", skill: "golem" } };

    expect(hitAt(corner, withGolem(1))).toEqual(drag);
    expect(hitAt(far, withGolem(2))).toEqual(drag);
    expect(hitAt(corner, withGolem(1), false)).toBeNull();
  });

  it("can't pick up a learned Passive Skill", () => {
    const passive = skillTreePanelLayout(screen, "curses").skills.find(
      (shown) => shown.skill === "lingeringMalice",
    ) as { tile: Rect };
    const at = { x: passive.tile.x + 4, y: passive.tile.y + 4 };
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: { ...FRESH_PROGRESS.skillLevels, lingeringMalice: 2 },
    });

    expect(skillTreeHitAt(screen, at, w, true, "curses")).toEqual({
      button: null,
    });
  });

  it("can't pick up a Skill not yet learned", () => {
    const at = { x: golem.tile.x + 4, y: golem.tile.y + golem.tile.h - 4 };

    expect(hitAt(at, withGolem(0))).toEqual({ button: null });
  });

  it("finds nothing on the tiles of a Branch that isn't open", () => {
    const at = centre(golem.tile);

    expect(skillTreeHitAt(screen, at, withGolem(2), true, "bone")).toEqual({
      button: null,
    });
  });

  it("finds each Branch tab, which opens its Branch", () => {
    for (const branch of BRANCHES) {
      expect(hitAt(centre(layout.tabs[branch]), withGolem(0))).toEqual({
        button: { type: "branchTab", branch },
      });
    }
    expect(hitAt(centre(layout.tabs.bone), withGolem(0), false)).toBeNull();
  });

  it("gives a learned Passive Skill's Focus spot no second hit to pick it up", () => {
    const w = world({
      ...FRESH_PROGRESS,
      level: 20,
      skillLevels: {
        ...FRESH_PROGRESS.skillLevels,
        golem: 1,
        lingeringMalice: 2,
      },
    });
    const spotOf = (branch: Branch, skill: Skill) => {
      const tile = skillTreePanelLayout(screen, branch).skills.find(
        (shown) => shown.skill === skill,
      )?.tile;
      return skillTreeFocusSpots(w, screen, branch).find(
        (spot) => JSON.stringify(spot.rect) === JSON.stringify(tile),
      );
    };

    expect(spotOf("summoning", "golem")?.secondHit).toEqual({
      button: { type: "pickUpSkill", skill: "golem" },
    });
    expect(spotOf("curses", "lingeringMalice")?.secondHit).toBeUndefined();
  });

  it("puts the Focus over the Branch tabs, the open Branch's tiles, the Skill Bar slots and the ×", () => {
    const spots = skillTreeFocusSpots(withGolem(1), screen, "summoning");
    const hits = spots.map((spot) => spot.hit.button);

    expect(hits.slice(0, 3)).toEqual(
      BRANCHES.map((branch) => ({ type: "branchTab", branch })),
    );
    const tiles = spots.slice(3, 3 + branchSkills.summoning.length);
    expect(tiles.map((spot) => spot.rect)).toEqual(
      layout.skills.map((shown) => shown.tile),
    );
    // Golem's tile is clicked on its +, which spends the point.
    expect(spots[3 + branchSkills.summoning.indexOf("golem")].hit).toEqual({
      button: { type: "learn", skill: "golem" },
    });
    expect(
      hits.filter((button) => button?.type === "skillBarSlot"),
    ).toHaveLength(5);
    expect(hits[hits.length - 1]).toEqual({
      type: "close",
      panel: "skillTree",
    });
  });

  it("finds the × above the open panel's grid", () => {
    const { closeButton } = layout;

    expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(golem.tile.y);
    expect(hitAt(centre(closeButton), withGolem(1))).toEqual({
      button: { type: "close", panel: "skillTree" },
    });
    expect(hitAt(centre(closeButton), withGolem(1), false)).toBeNull();
  });

  it.each([
    { width: 1024, height: 600 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ])("fits the grid over its hint, on the screen, on $width×$height", (size) => {
    const viewport = viewportOf(size);
    const hint =
      (SKILL_TREE_PANEL.hintHeight + SKILL_TREE_PANEL.padding) *
      viewport.uiScale;

    expect(viewport.compact).toBe(false);
    for (const branch of BRANCHES) {
      const { panel, skills } = skillTreePanelLayout(viewport, branch);
      expect(panel.y + panel.h).toBeLessThanOrEqual(size.height);
      for (const { tile } of skills) {
        expect(tile.y + tile.h).toBeLessThanOrEqual(panel.y + panel.h - hint);
      }
    }
  });

  it("catches anywhere else on the open panel, and nothing off it", () => {
    const { panel } = layout;
    const inside = { x: panel.x + 2, y: panel.y + panel.h - 2 };
    const outside = { x: panel.x - 2, y: panel.y + 2 };

    expect(hitAt(inside, withGolem(0))).toEqual({ button: null });
    expect(hitAt(inside, withGolem(0), false)).toBeNull();
    expect(hitAt(outside, withGolem(0))).toBeNull();
  });
});

/** Whether `inner` lies inside `outer`. */
function expectInside(inner: Rect, outer: Rect) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1e-6);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1e-6);
  expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w + 1e-6);
  expect(inner.y + inner.h).toBeLessThanOrEqual(outer.y + outer.h + 1e-6);
}
