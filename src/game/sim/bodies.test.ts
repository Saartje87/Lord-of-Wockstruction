import { describe, expect, it } from "vitest";
import { heroTuning } from "../tuning/hero";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import { newMinion } from "./minions";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { tileOf, type Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start` and `S` one Skeleton, both in the middle of their tile.
 */
function map(rows: string[], exitTo = "town") {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") {
      objects.push({ name: "start", type: "entry", point: true, x, y });
    }
    if (cell === "A") {
      for (const name of ["arrive", "start"]) {
        objects.push({ name, type: "entry", point: true, x, y });
      }
    }
    if (cell === "E") {
      objects.push({
        name: "",
        type: "exit",
        x: x - 16,
        y: y - 16,
        width: 32,
        height: 32,
        properties: [
          { name: "area", type: "string", value: exitTo },
          { name: "entry", type: "string", value: "arrive" },
        ],
      });
    }
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [{ name: "monster", type: "string", value: "skeleton" }],
      });
    }
  });
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width,
    height,
    data,
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: "test",
        tiles: [
          {
            id: 1,
            properties: [{ name: "blocks", type: "bool", value: true }],
          },
        ],
      },
    ],
    layers: [
      layer("floor", new Array(width * height).fill(1)),
      layer(
        "walls & props",
        [...cells].map((cell) => (cell === "#" ? 2 : 0)),
      ),
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

function world(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows) }, seed });
}

/** Adds a Golem at `pos` to the Hero's Minions. */
function addGolem(w: World, pos: Vec) {
  const golem = newMinion(w.nextMinionId++, "golem", "golem", 1, pos, 0);
  w.minions.push(golem);
  return golem;
}

/** Steps with no orders until `done`, failing after `limit` steps. */
function stepUntil(w: World, done: () => boolean, limit = 600): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; !done(); i++) {
    if (i > limit) throw new Error("Never happened");
    events.push(...step(w, []));
  }
  return events;
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * How far into a wall of `rows`, or past its edge, a Body of `radius` at
 * `pos` reaches: 0 when it touches none.
 */
function intoWall(rows: string[], pos: Vec, radius: number): number {
  const at = tileOf(pos);
  let deepest = 0;
  for (let y = at.y - 1; y <= at.y + 1; y++) {
    for (let x = at.x - 1; x <= at.x + 1; x++) {
      const open = rows[y]?.[x] !== undefined && rows[y][x] !== "#";
      if (open) continue;
      const nearest = {
        x: Math.min(Math.max(pos.x, x), x + 1),
        y: Math.min(Math.max(pos.y, y), y + 1),
      };
      deepest = Math.max(deepest, radius - distance(pos, nearest));
    }
  }
  return deepest;
}

/** The size a Body is checked against walls at: never more than the Hero's. */
const wallSize = (radius: number) => Math.min(radius, heroTuning.radius);

describe("Bodies and walls", () => {
  it("never leaves a shoved Monster with any part of its Body inside a wall", () => {
    // The Hero between two pillars against a wall, a crowd in sight of them
    // shoving each other at it.
    const rows = [
      "#########", //
      "...#H#...",
      ".........",
      "..S.S.S..",
      ".S.S.S.S.",
    ];
    const w = world(rows);
    const strolling = ["idle", "wander"];
    stepUntil(w, () =>
      w.monsters.every(({ state }) => !strolling.includes(state)),
    );

    // Long enough to crowd the Hero, not to kill them.
    for (let i = 0; i < 240; i++) {
      step(w, []);
      expect(w.death).toBeNull();
      for (const skeleton of w.monsters) {
        expect(strolling).not.toContain(skeleton.state);
        const radius = wallSize(monsterTuning[skeleton.type].radius);
        expect(intoWall(rows, skeleton.pos, radius)).toBeLessThan(1e-9);
      }
    }
  });

  it("lets a Golem follow the Hero through a gap exactly as wide as the Hero fits through", () => {
    const rows = [
      "......#......",
      "......#......",
      "..H..........",
      "......#......",
      "......#......",
    ];
    const w = world(rows);
    const golem = addGolem(w, { x: 1.5, y: 2.5 });
    const { followDistance } = minionTuning.golem;
    expect(minionTuning.golem.radius).toBeGreaterThan(heroTuning.radius);

    step(w, [{ type: "MoveTo", target: { x: 11.5, y: 2.5 } }]);
    stepUntil(w, () => w.hero.path.length === 0);
    stepUntil(
      w,
      () => distance(golem.pos, w.hero.pos) <= followDistance + 1e-9,
    );

    expect(golem.pos.x).toBeGreaterThan(7);
  });
});

describe("a Hero in Death", () => {
  it("has no Body: Monsters walk over where they lie without being pushed", () => {
    const w = world([
      "......", //
      "..HS..",
      "......",
    ]);
    w.hero.life = 1;
    stepUntil(w, () => w.death !== null);
    const [skeleton] = w.monsters;
    // Walking home, no faster.
    const { speed, returnSpeed } = monsterTuning.skeleton;
    const walk = ((speed * returnSpeed) / 60) * 1.0001;

    skeleton.pos = { ...w.hero.pos };
    for (let i = 0; i < 30; i++) {
      step(w, []);
      expect(distance(skeleton.prevPos, skeleton.pos)).toBeLessThanOrEqual(
        walk,
      );
    }
  });
});

describe("a crowded fight", () => {
  const crowd = [
    "......S.....",
    "..S.......S.",
    "............",
    "...S........",
    "............",
    "S.....H.....",
    "...........S",
    "............",
    "........S...",
    "..S.......S.",
    "............",
  ];

  /** Every creature's position after the same fight, from the same start. */
  function fight(): Vec[] {
    const w = world(crowd, 7);
    addGolem(w, { x: 7.5, y: 5.5 });
    addGolem(w, { x: 5.5, y: 5.5 });
    for (let i = 0; i < 240; i++) {
      const orders =
        i === 120
          ? [{ type: "MoveTo" as const, target: { x: 0.5, y: 0.5 } }]
          : [];
      step(w, orders);
    }
    return [w.hero, ...w.minions, ...w.monsters].map(({ pos }) => ({ ...pos }));
  }

  it("ends the same way every time", () => {
    expect(fight()).toEqual(fight());
  });
});

describe("the Hero's Minions and their Bodies", () => {
  const field = [
    "............",
    "............",
    "....H.......",
    "............",
    "............",
  ];

  /** A Raised Skeleton at `pos`, added to the Hero's Minions. */
  function addSkeleton(w: World, pos: Vec) {
    const skeleton = newMinion(
      w.nextMinionId++,
      "raisedSkeleton",
      "raiseSkeleton",
      1,
      pos,
      0,
    );
    w.minions.push(skeleton);
    return skeleton;
  }

  it("shove each other apart and never stay stacked", () => {
    const w = world(field);
    const golem = addGolem(w, { x: 5.5, y: 3.5 });
    const skeletons = [
      addSkeleton(w, { x: 5.5, y: 3.5 }),
      addSkeleton(w, { x: 5.55, y: 3.5 }),
      addSkeleton(w, { x: 5.5, y: 3.55 }),
    ];

    for (let i = 0; i < 120; i++) step(w, []);

    const minions = [golem, ...skeletons];
    for (const [i, a] of minions.entries()) {
      for (const b of minions.slice(i + 1)) {
        const apart = minionTuning[a.type].radius + minionTuning[b.type].radius;
        expect(distance(a.pos, b.pos)).toBeGreaterThanOrEqual(apart - 1e-6);
      }
    }
  });

  it("fighting one Monster together end up with no two Bodies overlapping", () => {
    const w = world(["............", "....H...S...", "............"]);
    const minions = [
      addGolem(w, { x: 3.5, y: 1.5 }),
      addSkeleton(w, { x: 3.5, y: 0.5 }),
      addSkeleton(w, { x: 3.5, y: 2.5 }),
      addSkeleton(w, { x: 2.5, y: 1.5 }),
    ];

    for (let i = 0; i < 300; i++) step(w, []);

    for (const [i, a] of minions.entries()) {
      for (const b of minions.slice(i + 1)) {
        const apart = minionTuning[a.type].radius + minionTuning[b.type].radius;
        expect(distance(a.pos, b.pos)).toBeGreaterThanOrEqual(apart - 1e-6);
      }
    }
  });

  it("are shoved aside by the Hero walking through, who is never moved or slowed", () => {
    const target = { x: 10.5, y: 2.5 };
    const empty = world(field);
    step(empty, [{ type: "MoveTo", target }]);
    let alone = 0;
    stepUntil(empty, () => {
      alone++;
      return empty.hero.path.length === 0;
    });

    const w = world(field);
    const golem = addGolem(w, { x: 6.5, y: 2.5 });
    const start = { ...golem.pos };
    step(w, [{ type: "MoveTo", target }]);
    let taken = 0;
    let nearest = Number.POSITIVE_INFINITY;
    stepUntil(w, () => {
      taken++;
      nearest = Math.min(nearest, distance(w.hero.pos, golem.pos));
      return w.hero.path.length === 0;
    });

    expect(taken).toBe(alone);
    // Shoved clear every step, not walked through.
    expect(nearest).toBeGreaterThanOrEqual(
      heroTuning.radius + minionTuning.golem.radius - 1e-6,
    );
    expect(w.hero.pos).toEqual(empty.hero.pos);
    expect(golem.pos).not.toEqual(start);
  });

  it("never settle overlapping the Hero, even one standing on them", () => {
    const w = world(field);
    const golem = addGolem(w, { ...w.hero.pos });
    const skeleton = addSkeleton(w, {
      x: w.hero.pos.x + 0.05,
      y: w.hero.pos.y,
    });

    for (let i = 0; i < 120; i++) step(w, []);

    expect(distance(golem.pos, w.hero.pos)).toBeGreaterThanOrEqual(
      heroTuning.radius + minionTuning.golem.radius - 1e-6,
    );
    expect(distance(skeleton.pos, w.hero.pos)).toBeGreaterThanOrEqual(
      heroTuning.radius + minionTuning.raisedSkeleton.radius - 1e-6,
    );
  });
});

describe("placing new creatures", () => {
  const caster: Progress = {
    ...FRESH_PROGRESS,
    level: 3,
    experience: 1000,
    skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 1, raiseSkeleton: 1 },
    skillBar: { ...emptySkillBar(), right: "golem", key1: "raiseSkeleton" },
  };

  /**
   * A World with the Hero arrived in a Combat Area of `rows`, at its `A`
   * tile, ready to cast.
   */
  function field(rows: string[]): World {
    const w = createWorld({
      areas: {
        town: map(["HAE.....", "........", "........"], "field"),
        field: combatArea(map(rows, "town"), 1),
      },
      seed: 1,
      progress: caster,
    });
    step(w, [{ type: "MoveTo", target: { x: 2.5, y: 0.5 } }]);
    stepUntil(w, () => w.areaName === "field" && !w.areaChange);
    return w;
  }

  /** Whether a Body at `pos` of `radius` overlaps the Hero or a Monster. */
  function overlaps(w: World, pos: Vec, radius: number) {
    const others = [
      { pos: w.hero.pos, radius: heroTuning.radius },
      ...w.monsters.map((m) => ({
        pos: m.pos,
        radius: monsterTuning[m.type].radius,
      })),
    ];
    return others.some((o) => distance(o.pos, pos) < o.radius + radius - 1e-6);
  }

  it("puts a summoned Golem at the nearest free spot where a Monster stands", () => {
    const w = field(["..........", "A...S.....", ".........."]);
    const [skeleton] = w.monsters;
    const asked = { ...skeleton.pos };

    const events = step(w, [{ type: "Cast", slot: "right", target: asked }]);
    events.push(...stepUntil(w, () => !w.hero.cast));

    const summoned = events.find((event) => event.type === "MinionSummoned");
    if (summoned?.type !== "MinionSummoned") throw new Error("Not summoned");
    // Where it was put, before anything shoved it.
    expect(overlaps(w, summoned.pos, minionTuning.golem.radius)).toBe(false);
    expect(distance(summoned.pos, asked)).toBeLessThan(1.5);
  });

  /** The Bodies of the Hero and their Minions, to check for overlaps. */
  function friends(w: World) {
    return [
      { pos: w.hero.pos, radius: heroTuning.radius },
      ...w.minions.map((m) => ({
        pos: m.pos,
        radius: minionTuning[m.type].radius,
      })),
    ];
  }

  /** The smallest gap between any two of `bodies` (negative when overlapping). */
  function tightest(bodies: { pos: Vec; radius: number }[]): number {
    let least = Number.POSITIVE_INFINITY;
    for (const [i, a] of bodies.entries()) {
      for (const b of bodies.slice(i + 1)) {
        least = Math.min(least, distance(a.pos, b.pos) - a.radius - b.radius);
      }
    }
    return least;
  }

  it("raises a Raised Skeleton at the nearest free spot from a Corpse with a Monster on it", () => {
    const w = field(["..........", "A...S.....", ".........."]);
    const [skeleton] = w.monsters;
    const corpse = {
      id: w.nextMonsterId++,
      type: "skeleton" as const,
      monsterLevel: 1,
      pos: { ...skeleton.pos },
    };
    w.corpses.push(corpse);

    const events = step(w, [
      { type: "Cast", slot: "key1", target: { ...corpse.pos } },
    ]);
    events.push(...stepUntil(w, () => !w.hero.cast));

    const raised = events.find((event) => event.type === "MinionSummoned");
    if (raised?.type !== "MinionSummoned") throw new Error("Not raised");
    expect(overlaps(w, raised.pos, minionTuning.raisedSkeleton.radius)).toBe(
      false,
    );
    expect(distance(raised.pos, corpse.pos)).toBeLessThan(1.5);
  });

  it("lands Minions following the Hero through an Exit in separate spots", () => {
    const w = field(["AE........", "..........", ".........."]);
    for (let i = 0; i < 4; i++) {
      const at = { x: 1.5 + i * 0.01, y: 0.5 };
      const type = i === 0 ? "golem" : "raisedSkeleton";
      w.minions.push(
        newMinion(
          w.nextMinionId++,
          type,
          type === "golem" ? "golem" : "raiseSkeleton",
          1,
          at,
          0,
        ),
      );
    }

    step(w, [{ type: "MoveTo", target: { x: 1.5, y: 0.5 } }]);
    stepUntil(w, () => w.areaName === "town" && !w.areaChange);

    expect(tightest(friends(w))).toBeGreaterThanOrEqual(-1e-6);
  });

  it("lands Minions teleported beside the Hero at once in separate spots", () => {
    const w = field([
      "A.........................",
      "..........................",
      "..........................",
    ]);
    for (let i = 0; i < 4; i++) {
      const at = { x: 24.5 + i * 0.01, y: 1.5 };
      const type = i === 0 ? "golem" : "raisedSkeleton";
      w.minions.push(
        newMinion(
          w.nextMinionId++,
          type,
          type === "golem" ? "golem" : "raiseSkeleton",
          1,
          at,
          0,
        ),
      );
    }

    step(w, []);

    for (const minion of w.minions) {
      expect(distance(minion.pos, w.hero.pos)).toBeLessThan(4);
    }
    expect(tightest(friends(w))).toBeGreaterThanOrEqual(-1e-6);
  });

  it("never puts a creature across a wall from the spot asked for", () => {
    // A Monster alone in a sealed one-tile pocket the Hero summons into.
    const w = field(["A....###", ".....#S#", ".....###"]);
    const [skeleton] = w.monsters;

    const events = step(w, [
      { type: "Cast", slot: "right", target: { ...skeleton.pos } },
    ]);
    events.push(...stepUntil(w, () => !w.hero.cast));

    const summoned = events.find((event) => event.type === "MinionSummoned");
    if (summoned?.type !== "MinionSummoned") throw new Error("Not summoned");
    expect(Math.floor(summoned.pos.x)).toBe(6);
    expect(Math.floor(summoned.pos.y)).toBe(1);
  });
});
