import { afterEach, describe, expect, it } from "vitest";
import { monsterTuning } from "../tuning/monsters";
import { createWorld, maxLife, type SimEvent, step, type World } from "./world";

/**
 * An orthogonal Area of open floor drawn row by row: `.` floor, `H` the
 * Hero's `start` and `S` a pack of `pack` Skeletons, centred on their tile.
 */
function map(rows: string[], pack = 1) {
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
    if (cell === "S") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "skeleton" },
          { name: "count", type: "int", value: pack },
        ],
      });
    }
  });
  return {
    orientation: "orthogonal",
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height,
        data: new Array(width * height).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/** A Town with the Hero next to a pack of `pack` Skeletons. */
function world(pack = 1): World {
  return createWorld({ areas: { town: map(["H.S.."], pack) }, seed: 1 });
}

/**
 * Attacks the nearest Monster until `kills` have died, returning every
 * event on the way.
 */
function kill(world: World, kills: number): SimEvent[] {
  const all: SimEvent[] = [];
  let died = 0;
  for (let i = 0; died < kills; i++) {
    if (i > 60 * 60) throw new Error(`Only ${died} of ${kills} kills`);
    const [nearest] = [...world.monsters].sort(
      (a, b) => gap(world, a.pos) - gap(world, b.pos),
    );
    const events = step(world, [{ type: "Attack", monster: nearest.id }]);
    died += events.filter((event) => event.type === "MonsterDied").length;
    all.push(...events);
  }
  return all;
}

function gap(world: World, pos: { x: number; y: number }): number {
  return Math.hypot(pos.x - world.hero.pos.x, pos.y - world.hero.pos.y);
}

const ofType = <T extends SimEvent["type"]>(events: SimEvent[], type: T) =>
  events.filter(
    (event): event is Extract<SimEvent, { type: T }> => event.type === type,
  );

describe("Experience", () => {
  it("is gained when a Skeleton dies, right after MonsterDied", () => {
    const w = world();
    const events = kill(w, 1);

    const died = events.findIndex((event) => event.type === "MonsterDied");
    expect(events[died + 1]).toEqual({ type: "ExperienceGained", amount: 100 });
    expect(ofType(events, "ExperienceGained")).toHaveLength(1);
    expect(w.hero.experience).toBe(100);
    expect(w.hero.level).toBe(1);
  });
});

describe("Levels", () => {
  it("reaches Level 2 on the 5th Skeleton killed, not before", () => {
    const w = world(5);
    const events = kill(w, 4);
    expect(ofType(events, "LevelReached")).toEqual([]);
    expect(w.hero.level).toBe(1);

    const fifth = kill(w, 1);
    expect(ofType(fifth, "LevelReached")).toEqual([
      { type: "LevelReached", level: 2 },
    ]);
    expect(w.hero.level).toBe(2);
  });

  it("adds 2 max Life per new Level and fills Life to it", () => {
    const w = world(5);
    expect(maxLife(w)).toBe(100);
    kill(w, 4);
    expect(w.hero.life).toBeLessThan(100);

    kill(w, 1);
    expect(maxLife(w)).toBe(102);
    expect(w.hero.life).toBe(102);
  });
});

describe("a kill worth several Levels", () => {
  const tuned = monsterTuning.skeleton.experience;
  afterEach(() => {
    monsterTuning.skeleton.experience = tuned;
  });

  it("grants every one of them, each with its own LevelReached", () => {
    // Level 5 needs 7,875 and Level 6 14,175.
    monsterTuning.skeleton.experience = 10_000;
    const w = world();
    const events = kill(w, 1);

    expect(ofType(events, "LevelReached").map((event) => event.level)).toEqual([
      2, 3, 4, 5,
    ]);
    expect(w.hero.level).toBe(5);
    expect(w.hero.experience).toBe(10_000);
    expect(maxLife(w)).toBe(108);
    expect(w.hero.life).toBe(108);
  });

  it("stops at Level 99, with Experience at the table's last value", () => {
    monsterTuning.skeleton.experience = 2_000_000_000;
    const w = world(3);
    const events = kill(w, 2);
    expect(ofType(events, "LevelReached")).toHaveLength(98);
    expect(w.hero.level).toBe(99);
    expect(w.hero.experience).toBe(3_520_485_254);
    expect(ofType(events, "ExperienceGained")).toEqual([
      { type: "ExperienceGained", amount: 2_000_000_000 },
      { type: "ExperienceGained", amount: 1_520_485_254 },
    ]);

    const after = kill(w, 1);
    expect(ofType(after, "ExperienceGained")).toEqual([]);
    expect(ofType(after, "LevelReached")).toEqual([]);
    expect(w.hero.level).toBe(99);
    expect(w.hero.experience).toBe(3_520_485_254);
  });
});

describe("max Life", () => {
  it("is what regeneration tops up to", () => {
    const w = world(6);
    kill(w, 6);
    expect(w.hero.level).toBe(2);
    expect(w.hero.life).toBeLessThan(100);

    // Out of combat after 5 s, then 2 Life/s.
    for (let i = 0; i < 60 * 60; i++) step(w, []);
    expect(w.hero.life).toBe(102);
  });

  it("is what arriving in Town fills Life to", () => {
    const w = world(6);
    kill(w, 5);
    expect(w.hero.level).toBe(2);

    // The last Skeleton kills the Hero, who goes back to Town.
    let died = false;
    for (let i = 0; !died; i++) {
      if (i > 60 * 60) throw new Error("The Hero didn't die");
      died = step(w, []).some((event) => event.type === "HeroDied");
    }
    for (let i = 0; i < 60; i++) step(w, []);
    step(w, [{ type: "Continue" }]);
    while (w.areaChange !== null) step(w, []);

    expect(w.hero.life).toBe(102);
  });
});
