import { describe, expect, it } from "vitest";
import { newMinion } from "../sim/minions";
import { combatArea } from "../sim/testAreas";
import {
  createWorld,
  type MinionType,
  maxMana,
  step,
  type World,
} from "../sim/world";
import { viewportOf } from "../viewport";
import {
  MINION_FRAME,
  MINION_KINDS,
  minionFrameLayout,
  minionFrameRows,
  minionsFlashed,
} from "./minionFrame";

/** A Town of open floor with its `start` Entry on the first tile. */
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
      objects: [{ name: "start", type: "entry", point: true, x: 16, y: 16 }],
    },
  ],
};

/** A World whose Hero has `types` as Minions, oldest first, at Skill Level 1. */
function withMinions(...types: MinionType[]): World {
  const w = createWorld({ areas: { town }, seed: 1 });
  w.hero.progress.skillLevels.raiseSkeleton = 1;
  for (const type of types) {
    const skill =
      type === "golem"
        ? "golem"
        : type === "raisedMage"
          ? "raiseMage"
          : "raiseSkeleton";
    w.minions.push(
      newMinion(w.nextMinionId++, type, skill, 1, { x: 1.5, y: 0.5 }, 0),
    );
  }
  return w;
}

/** An open floor of `width` tiles with `objects` on it. */
function floorOf(width: number, objects: object[]) {
  return {
    ...town,
    width,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height: 1,
        data: Array(width).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/**
 * A World whose Hero stands in a Combat Area with Raise Skeleton on key 1,
 * arrived from a Town whose second tile leads there.
 */
function raiser(): World {
  const entry = { name: "start", type: "entry", point: true, x: 16, y: 16 };
  const exit = {
    name: "",
    type: "exit",
    x: 32,
    y: 0,
    width: 32,
    height: 32,
    properties: [
      { name: "area", type: "string", value: "field" },
      { name: "entry", type: "string", value: "start" },
    ],
  };
  const w = createWorld({
    areas: {
      town: floorOf(3, [entry, exit]),
      field: combatArea(floorOf(8, [entry]), 1),
    },
    seed: 1,
  });
  w.hero.progress.skillLevels.raiseSkeleton = 1;
  w.hero.progress.skillBar.key1 = "raiseSkeleton";
  step(w, [{ type: "MoveTo", target: { x: 1.5, y: 0.5 } }]);
  for (let i = 0; w.areaName !== "field" || w.areaChange; i++) {
    if (i > 600) throw new Error("Never arrived");
    step(w, []);
  }
  return w;
}

/**
 * Raises a Raised Skeleton from a fresh Corpse beside the Hero, through the
 * sim, and returns the new Minion's id.
 */
function raiseSkeleton(w: World): number {
  const pos = { x: w.hero.pos.x + 1, y: w.hero.pos.y };
  w.corpses.push({
    id: w.nextMonsterId++,
    type: "skeleton",
    monsterLevel: 1,
    pos,
  });
  w.hero.mana = maxMana(w);
  const id = w.nextMinionId;
  step(w, [{ type: "Cast", slot: "key1", target: pos }]);
  for (let i = 0; w.hero.cast && i < 600; i++) step(w, []);
  if (w.nextMinionId === id) throw new Error("Nothing raised");
  return id;
}

describe("raising Minions through the sim", () => {
  it("puts the bar of a newly raised Skeleton at the end of the row", () => {
    const w = raiser();
    const first = raiseSkeleton(w);
    const second = raiseSkeleton(w);

    const [row] = minionFrameRows(w);
    expect(row.bars.map((bar) => bar.id)).toEqual([first, second]);
  });

  it("drops the oldest bar from the front when raising past the cap", () => {
    const w = raiser();
    const ids = [raiseSkeleton(w)];
    const cap = minionFrameRows(w)[0].cap ?? 0;
    while (ids.length < cap + 1) ids.push(raiseSkeleton(w));

    const [row] = minionFrameRows(w);
    expect(row.bars).toHaveLength(cap);
    expect(row.bars.map((bar) => bar.id)).toEqual(ids.slice(1));
  });
});

describe("minionFrameRows", () => {
  it("counts Raised Skeletons against the cap at the Raise Skeleton Skill Level", () => {
    const w = withMinions("raisedSkeleton", "raisedSkeleton");
    w.hero.progress.skillLevels.raiseSkeleton = 3;
    expect(minionFrameRows(w)[0]).toMatchObject({ cap: 2 });

    // A Skill Point into Raise Skeleton that earns a Minion raises the cap.
    w.hero.progress.skillLevels.raiseSkeleton = 4;
    expect(minionFrameRows(w)[0]).toMatchObject({ cap: 3 });
  });

  it("gives a Raised Archer row its own count and cap", () => {
    const w = withMinions("raisedSkeleton");
    w.minions.push(
      newMinion(
        w.nextMinionId++,
        "raisedArcher",
        "raiseArcher",
        1,
        {
          x: 1.5,
          y: 0.5,
        },
        0,
      ),
    );
    w.hero.progress.skillLevels.raiseSkeleton = 1;
    w.hero.progress.skillLevels.raiseArcher = 4;

    expect(
      minionFrameRows(w).map(({ bars, cap }) => [bars.length, cap]),
    ).toEqual([
      [1, 2],
      [1, 3],
    ]);
  });

  it("gives no rows to a Hero without Minions", () => {
    expect(minionFrameRows(withMinions())).toEqual([]);
  });

  it("gives a Golem alone one row with one bar at its Life fraction", () => {
    const w = withMinions("golem");
    w.minions[0].life /= 4;

    expect(minionFrameRows(w)).toEqual([
      {
        kind: "golem",
        cap: null,
        bars: [{ id: w.minions[0].id, fraction: 0.25 }],
      },
    ]);
  });

  it("gives Raised Skeletons one row with a bar each, oldest first", () => {
    const w = withMinions("raisedSkeleton", "raisedSkeleton");
    w.minions[1].life /= 2;
    const [oldest, newest] = w.minions;

    expect(minionFrameRows(w)).toEqual([
      {
        kind: "raisedSkeleton",
        cap: 2,
        bars: [
          { id: oldest.id, fraction: 1 },
          { id: newest.id, fraction: 0.5 },
        ],
      },
    ]);
  });

  it("drops the oldest bar from the front when it crumbles", () => {
    const w = withMinions("raisedSkeleton", "raisedSkeleton");
    const [oldest, newest] = w.minions;
    w.minions.shift();

    const [row] = minionFrameRows(w);
    expect(row.bars.map((bar) => bar.id)).toEqual([newest.id]);
    expect(row.bars.map((bar) => bar.id)).not.toContain(oldest.id);
  });

  it("puts the Golem row before the Raised Skeletons', whoever came first", () => {
    const w = withMinions("raisedSkeleton", "golem", "raisedSkeleton");

    const rows = minionFrameRows(w);
    expect(rows.map((row) => row.kind)).toEqual(["golem", "raisedSkeleton"]);
    expect(rows[1].bars).toHaveLength(2);
  });

  it("puts Raised Archers last", () => {
    const w = withMinions("raisedArcher", "raisedSkeleton", "golem");

    expect(minionFrameRows(w).map((row) => row.kind)).toEqual([
      "golem",
      "raisedSkeleton",
      "raisedArcher",
    ]);
  });

  it("gives a Raised Mage row its own count and cap", () => {
    const w = withMinions("raisedMage");
    w.hero.progress.skillLevels.raiseMage = 5;

    expect(minionFrameRows(w)).toEqual([
      expect.objectContaining({ kind: "raisedMage", cap: 2 }),
    ]);
  });

  it("puts Raised Mages after the Raised Archers", () => {
    const w = withMinions(
      "raisedMage",
      "raisedArcher",
      "raisedSkeleton",
      "golem",
    );

    expect(minionFrameRows(w).map((row) => row.kind)).toEqual([
      "golem",
      "raisedSkeleton",
      "raisedArcher",
      "raisedMage",
    ]);
  });

  it("drops a row once its last Minion dies", () => {
    const w = withMinions("golem", "raisedSkeleton");
    w.minions = w.minions.filter((minion) => minion.type !== "raisedSkeleton");

    expect(minionFrameRows(w).map((row) => row.kind)).toEqual(["golem"]);
  });

  it("gives every Minion kind a place", () => {
    const kinds = Object.keys(MINION_KINDS).sort();

    expect(kinds).toEqual([
      "golem",
      "raisedArcher",
      "raisedMage",
      "raisedSkeleton",
    ]);
  });
});

/** Rows of `counts` bars for the kinds in order, all at full Life. */
function rowsOf(...counts: number[]) {
  return counts.map((count, i) => ({
    kind: (["golem", "raisedSkeleton", "raisedArcher"] as const)[i],
    cap: i === 0 ? null : 99,
    bars: Array.from({ length: count }, (_, id) => ({ id, fraction: 1 })),
  }));
}

describe("minionFrameLayout", () => {
  it("has no frame without rows", () => {
    const screen = viewportOf({ width: 1280, height: 720 });

    expect(minionFrameLayout(screen, [])).toEqual({ frame: null, rows: [] });
  });

  it("sits at the top left, rows stacked down, bars in order along each row", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const { frame, rows } = minionFrameLayout(screen, rowsOf(1, 3));
    const [first, second] = rows;

    expect(frame).toMatchObject({
      x: MINION_FRAME.margin,
      y: MINION_FRAME.margin,
    });
    expect(second.icon.y).toBeGreaterThanOrEqual(first.icon.y + first.icon.h);
    expect(second.bars).toHaveLength(3);
    expect(second.bars[1].rect.x).toBeGreaterThanOrEqual(
      second.bars[0].rect.x + second.bars[0].rect.w,
    );
    expect(second.bars[0].rect.x).toBeGreaterThanOrEqual(
      second.icon.x + second.icon.w,
    );
  });

  it("puts a count between the icon and the bars of rows with a cap only", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const [golem, skeletons] = minionFrameLayout(screen, rowsOf(1, 3)).rows;

    expect(golem.count).toBeNull();
    if (!skeletons.count) throw new Error("No count");
    const { rect, text } = skeletons.count;
    expect(text).toBe("3/99");
    expect(rect.x).toBeGreaterThanOrEqual(skeletons.icon.x + skeletons.icon.w);
    expect(skeletons.bars[0].rect.x).toBeGreaterThanOrEqual(rect.x + rect.w);
  });

  it("scales with the UI Scale", () => {
    const small = viewportOf({ width: 1280, height: 720 });
    const big = viewportOf({ width: 2560, height: 1440 });
    const bar = (screen: typeof small) =>
      minionFrameLayout(screen, rowsOf(1, 2)).rows[1].bars[0].rect;

    expect(big.uiScale).toBeGreaterThan(small.uiScale);
    expect(bar(big).w / bar(small).w).toBeCloseTo(big.uiScale / small.uiScale);
  });

  it("wraps a long row of bars onto more lines inside the frame", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const { frame, rows } = minionFrameLayout(screen, rowsOf(1, 34));
    if (!frame) throw new Error("No frame");

    for (const { rect: bar } of rows[1].bars) {
      expect(bar.x + bar.w).toBeLessThanOrEqual(frame.x + frame.w);
      expect(bar.y + bar.h).toBeLessThanOrEqual(frame.y + frame.h);
    }
    expect(new Set(rows[1].bars.map((bar) => bar.rect.y)).size).toBeGreaterThan(
      1,
    );
  });
});

describe("minionsFlashed", () => {
  it("flashes a Minion that lost Life to a hit", () => {
    expect(
      minionsFlashed([
        { type: "MinionHit", minion: 4, damage: 3, damageType: "physical" },
      ]),
    ).toEqual([4]);
  });

  it("flashes nothing for a Miss, a hit for no damage or no events", () => {
    expect(minionsFlashed([{ type: "MinionMissed", minion: 4 }])).toEqual([]);
    expect(
      minionsFlashed([
        { type: "MinionHit", minion: 4, damage: 0, damageType: "physical" },
      ]),
    ).toEqual([]);
    expect(minionsFlashed([])).toEqual([]);
  });

  it("flashes each Minion hit in one step, once", () => {
    expect(
      minionsFlashed([
        { type: "MinionHit", minion: 4, damage: 3, damageType: "physical" },
        { type: "MinionMissed", minion: 5 },
        { type: "MinionHit", minion: 6, damage: 1, damageType: "physical" },
        { type: "MinionHit", minion: 4, damage: 2, damageType: "physical" },
      ]),
    ).toEqual([4, 6]);
  });
});
