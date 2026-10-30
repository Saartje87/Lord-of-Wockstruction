import { describe, expect, it } from "vitest";
import { newMinion } from "../sim/minions";
import { createWorld, type MinionType, type World } from "../sim/world";
import { viewportOf } from "../viewport";
import {
  MINION_FLASH,
  MINION_FRAME,
  MINION_KINDS,
  minionFlashBrightness,
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
    const skill = type === "golem" ? "golem" : "raiseSkeleton";
    w.minions.push(
      newMinion(w.nextMinionId++, type, skill, 1, { x: 1.5, y: 0.5 }, 0),
    );
  }
  return w;
}

describe("minionFrameRows", () => {
  it("counts Raised Skeletons against the cap at the Raise Skeleton Skill Level", () => {
    const w = withMinions("raisedSkeleton", "raisedSkeleton");
    w.hero.progress.skillLevels.raiseSkeleton = 3;
    expect(minionFrameRows(w)[0]).toMatchObject({ count: 2, cap: 2 });

    // A Skill Point into Raise Skeleton that earns a Minion raises the cap.
    w.hero.progress.skillLevels.raiseSkeleton = 4;
    expect(minionFrameRows(w)[0]).toMatchObject({ count: 2, cap: 3 });
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

    expect(minionFrameRows(w).map(({ count, cap }) => [count, cap])).toEqual([
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
        count: 1,
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
        count: 2,
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

  it("drops a row once its last Minion dies", () => {
    const w = withMinions("golem", "raisedSkeleton");
    w.minions = w.minions.filter((minion) => minion.type !== "raisedSkeleton");

    expect(minionFrameRows(w).map((row) => row.kind)).toEqual(["golem"]);
  });

  it("gives every Minion kind a place", () => {
    const kinds = Object.keys(MINION_KINDS).sort();

    expect(kinds).toEqual(["golem", "raisedArcher", "raisedSkeleton"]);
  });
});

/** Rows of `counts` bars for the kinds in order, all at full Life. */
function rowsOf(...counts: number[]) {
  return counts.map((count, i) => ({
    kind: (["golem", "raisedSkeleton", "raisedArcher"] as const)[i],
    count,
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
    expect(second.bars[1].x).toBeGreaterThanOrEqual(
      second.bars[0].x + second.bars[0].w,
    );
    expect(second.bars[0].x).toBeGreaterThanOrEqual(
      second.icon.x + second.icon.w,
    );
  });

  it("puts a count between the icon and the bars of rows with a cap only", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const [golem, skeletons] = minionFrameLayout(screen, rowsOf(1, 3)).rows;

    expect(golem.count).toBeNull();
    if (!skeletons.count) throw new Error("No count");
    expect(skeletons.count.x).toBeGreaterThanOrEqual(
      skeletons.icon.x + skeletons.icon.w,
    );
    expect(skeletons.bars[0].x).toBeGreaterThanOrEqual(
      skeletons.count.x + skeletons.count.w,
    );
  });

  it("scales with the UI Scale", () => {
    const small = viewportOf({ width: 1280, height: 720 });
    const big = viewportOf({ width: 2560, height: 1440 });
    const bar = (screen: typeof small) =>
      minionFrameLayout(screen, rowsOf(1, 2)).rows[1].bars[0];

    expect(big.uiScale).toBeGreaterThan(small.uiScale);
    expect(bar(big).w / bar(small).w).toBeCloseTo(big.uiScale / small.uiScale);
  });

  it("wraps a long row of bars onto more lines inside the frame", () => {
    const screen = viewportOf({ width: 1280, height: 720 });
    const { frame, rows } = minionFrameLayout(screen, rowsOf(1, 34));
    if (!frame) throw new Error("No frame");

    for (const bar of rows[1].bars) {
      expect(bar.x + bar.w).toBeLessThanOrEqual(frame.x + frame.w);
      expect(bar.y + bar.h).toBeLessThanOrEqual(frame.y + frame.h);
    }
    expect(new Set(rows[1].bars.map((bar) => bar.y)).size).toBeGreaterThan(1);
  });
});

describe("minionsFlashed", () => {
  it("flashes a Minion that lost Life to a hit", () => {
    expect(
      minionsFlashed([{ type: "MinionHit", minion: 4, damage: 3 }]),
    ).toEqual([4]);
  });

  it("flashes nothing for a Miss, a hit for no damage or no events", () => {
    expect(minionsFlashed([{ type: "MinionMissed", minion: 4 }])).toEqual([]);
    expect(
      minionsFlashed([{ type: "MinionHit", minion: 4, damage: 0 }]),
    ).toEqual([]);
    expect(minionsFlashed([])).toEqual([]);
  });

  it("flashes each Minion hit in one step, once", () => {
    expect(
      minionsFlashed([
        { type: "MinionHit", minion: 4, damage: 3 },
        { type: "MinionMissed", minion: 5 },
        { type: "MinionHit", minion: 6, damage: 1 },
        { type: "MinionHit", minion: 4, damage: 2 },
      ]),
    ).toEqual([4, 6]);
  });
});

describe("minionFlashBrightness", () => {
  it("is brightest when it begins and fades to nothing over its length", () => {
    expect(minionFlashBrightness(0)).toBe(1);
    expect(minionFlashBrightness(MINION_FLASH.ms / 2)).toBeCloseTo(0.5);
    expect(minionFlashBrightness(MINION_FLASH.ms)).toBe(0);
    expect(minionFlashBrightness(MINION_FLASH.ms * 3)).toBe(0);
  });
});
