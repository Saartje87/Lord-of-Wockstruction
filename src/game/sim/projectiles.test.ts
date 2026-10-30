import { describe, expect, it } from "vitest";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import type { Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  type Monster,
  type Progress,
  type Projectile,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `N` an Entry named `arrive`, `E` an Exit to the other Area's
 * `arrive`, `A` one Skeleton Archer, each in the middle of its tile. A
 * Combat Area has `areaLevel`; Town has none.
 */
function map(rows: string[], exitTo = "town", areaLevel: number | null = 1) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "N") objects.push({ name: "arrive", type: "entry", x, y });
    if (cell === "A") {
      objects.push({
        name: "",
        type: "monsterSpawn",
        point: true,
        x,
        y,
        properties: [
          { name: "monster", type: "string", value: "skeleton_archer" },
        ],
      });
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
  });
  const layer = (name: string, data: number[]) => ({
    type: "tilelayer",
    name,
    width,
    height,
    data,
  });
  const area = {
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
  return areaLevel === null ? area : combatArea(area, areaLevel);
}

/** A Level 2 Hero who spent their Skill Point on the Golem, on the Skill Bar. */
const GOLEM_HERO: Progress = {
  ...FRESH_PROGRESS,
  level: 2,
  experience: 500,
  attributePoints: 5,
  skillLevels: { ...FRESH_PROGRESS.skillLevels, golem: 1 },
  skillBar: { ...emptySkillBar(), right: "golem" },
};

/** Town, a strip with an Exit at its west end into the field. */
const TOWN = map(["EN.....H"], "field", null);

/** A World of Town and `field`, the Hero just arrived in the field at (1, 0). */
function inField(fieldRows: string[], seed = 1): World {
  const w = createWorld({
    areas: { town: TOWN, field: map(fieldRows) },
    seed,
    progress: GOLEM_HERO,
  });
  walkThroughExit(w);
  return w;
}

/** A World of one Area, Town, with the Hero at `H`. */
function inTown(rows: string[], seed = 1): World {
  return createWorld({ areas: { town: map(rows, "town", null) }, seed });
}

/**
 * Walks the Hero onto the Exit at tile (0, 0) and steps until they have
 * arrived in the other Area, returning the events on the way.
 */
function walkThroughExit(w: World): SimEvent[] {
  const from = w.areaName;
  const events = step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  for (let i = 0; w.areaName === from || w.areaChange; i++) {
    if (i > 60 * 5) throw new Error("Never arrived");
    events.push(...step(w, []));
  }
  return events;
}

function archerOf(w: World): Monster {
  const archer = w.monsters.find((m) => m.type === "skeleton_archer");
  if (!archer) throw new Error("No Archer");
  return archer;
}

/** Steps until `archer` starts winding up. */
function untilWindUp(w: World, archer: Monster) {
  for (let i = 0; archer.state !== "windup"; i++) {
    if (i > 60 * 10) throw new Error("It never wound up");
    step(w, []);
  }
}

/** Steps until the first Arrow is loosed, returning it. */
function untilLoosed(w: World) {
  for (let i = 0; w.projectiles.length === 0; i++) {
    if (i > 60 * 10) throw new Error("No Arrow was loosed");
    step(w, []);
  }
  return w.projectiles[0];
}

/** Steps until `arrow` is gone, returning the events on the way. */
function untilGone(w: World, arrow: object): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; w.projectiles.includes(arrow as never); i++) {
    if (i > 60 * 5) throw new Error("The Arrow never went");
    events.push(...step(w, []));
  }
  return events;
}

/** The events of an attack on the Hero landing or failing to. */
function onHero(events: SimEvent[]): SimEvent[] {
  return events.filter(
    (event) =>
      event.type === "HeroHit" ||
      (event.type === "Missed" && event.target === "hero"),
  );
}

/** The events of an attack on the Minion landing or failing to. */
function onMinion(events: SimEvent[]): SimEvent[] {
  return events.filter(
    (event) => event.type === "MinionHit" || event.type === "MinionMissed",
  );
}

function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe("an Arrow and the Golem", () => {
  it("hits a Golem standing between the Archer and the Hero, and the Hero isn't hit", () => {
    const w = inField([
      "EN.....A....", //
      "............",
      "...........H",
    ]);
    const archer = archerOf(w);
    untilWindUp(w, archer);
    expect(archer.target).toBe("hero");
    // Summoned on the line between them while the Archer draws at the Hero.
    step(w, [{ type: "Cast", slot: "right", target: { x: 4.5, y: 0.5 } }]);
    expect(w.minions).toHaveLength(1);
    const life = w.hero.life;

    const arrow = untilLoosed(w);
    // Aimed at the Hero, west along the row.
    expect(arrow.direction.x).toBeCloseTo(-1);
    const events = untilGone(w, arrow);

    expect(onHero(events)).toEqual([]);
    expect(w.hero.life).toBe(life);
    expect(onMinion(events)).toHaveLength(1);
    expect(arrow.pos.x).toBeGreaterThan(w.hero.pos.x + 1);
  });

  it("is loosed at the Golem by an Archer whose nearest quarry it is", () => {
    // The Archer stands beyond its 9-tile aggroRadius from the Hero.
    const w = inField([
      "EN.........A", //
      "............",
      "...........H",
    ]);
    const archer = archerOf(w);
    step(w, [{ type: "Cast", slot: "right", target: { x: 9.5, y: 0.5 } }]);
    const [golem] = w.minions;
    if (!golem) throw new Error("No Golem");

    untilWindUp(w, archer);
    expect(archer.target).toBe(golem.id);
    const arrow = untilLoosed(w);
    const toGolem = {
      x: golem.pos.x - archer.pos.x,
      y: golem.pos.y - archer.pos.y,
    };
    const gap = Math.hypot(toGolem.x, toGolem.y);
    expect(arrow.direction.x).toBeCloseTo(toGolem.x / gap);
    expect(arrow.direction.y).toBeCloseTo(toGolem.y / gap);

    const events = untilGone(w, arrow);
    expect(onMinion(events)).toHaveLength(1);
    expect(onHero(events)).toEqual([]);
  });
});

describe("an Arrow and the Hero's Death", () => {
  it("flies on over a Hero in Death without hitting them", () => {
    // Both Archers loose at once: the near one's Arrow kills the Hero while
    // the far one's is still in flight.
    const w = inTown(["....HA....A.."]);
    w.hero.life = 1;
    const far = w.monsters[1];

    let events: SimEvent[] = [];
    for (let i = 0; !events.some((e) => e.type === "HeroDied"); i++) {
      if (i > 60 * 5) throw new Error("The Hero never died");
      events = step(w, []);
    }
    const arrow = w.projectiles.find((p) => p.from === far.id);
    if (!arrow) throw new Error("No Arrow in flight");
    expect(arrow.pos.x).toBeGreaterThan(w.hero.pos.x + 1);

    const after: SimEvent[] = [];
    let at = { ...arrow.pos };
    let passed = false;
    while (w.projectiles.includes(arrow)) {
      if (after.length > 1000) throw new Error("Too many events");
      after.push(...step(w, []));
      if (w.projectiles.includes(arrow)) {
        // It keeps flying while the Hero lies dead.
        expect(distance(at, arrow.pos)).toBeCloseTo(9 / 60);
        at = { ...arrow.pos };
        if (arrow.pos.x < w.hero.pos.x - 0.5) passed = true;
      }
    }

    expect(onHero(after)).toEqual([]);
    expect(passed).toBe(true);
  });

  it("flies on over the Hero when it touches them on the step another Arrow kills them", () => {
    // Two Archers the same distance off either side loose at once, so their
    // Arrows reach the Hero on the same step.
    const w = inTown(["A.....H.....A"]);
    w.hero.life = 1;
    const [west, east] = w.monsters;

    let events: SimEvent[] = [];
    let inFlight: Projectile[] = [];
    for (let i = 0; !events.some((e) => e.type === "HeroDied"); i++) {
      if (i > 60 * 5) throw new Error("The Hero never died");
      inFlight = [...w.projectiles];
      events = step(w, []);
    }
    expect(inFlight.map((p) => p.from).sort()).toEqual(
      [west.id, east.id].sort(),
    );
    expect(onHero(events)).toHaveLength(1);
    const [arrow] = w.projectiles;
    expect(w.projectiles).toHaveLength(1);

    const after: SimEvent[] = [];
    const from = arrow.from;
    let passed = false;
    while (w.projectiles.includes(arrow)) {
      if (after.length > 1000) throw new Error("Too many events");
      after.push(...step(w, []));
      const beyond =
        from === west.id
          ? arrow.pos.x > w.hero.pos.x + 0.5
          : arrow.pos.x < w.hero.pos.x - 0.5;
      if (beyond) passed = true;
    }

    expect(onHero(after)).toEqual([]);
    expect(passed).toBe(true);
  });
});

describe("Arrows and Exits", () => {
  it("sets Projectiles aside once the Hero walks through an Exit, and has them again on returning", () => {
    const w = inField([
      "EN.....A....", //
      "............",
      "...........H",
    ]);
    untilLoosed(w);
    const loosed = w.projectiles.length;

    walkThroughExit(w);
    expect(w.areaName).toBe("town");
    expect(w.projectiles).toEqual([]);

    walkThroughExit(w);
    expect(w.areaName).toBe("field");
    expect(w.projectiles).toHaveLength(loosed);
  });
});

describe("an Arrow whose Archer dies", () => {
  it("still lands on the Hero, with the numbers it was loosed with", () => {
    // The Hero's swing at the Archer next to them lands just after it looses.
    let found = 0;
    for (let delay = 0; delay < 40 && found === 0; delay++) {
      for (let seed = 1; seed <= 3; seed++) {
        const w = inTown(["HA........"], seed);
        const archer = archerOf(w);
        untilWindUp(w, archer);
        archer.life = 1;
        for (let i = 0; i < delay; i++) step(w, []);
        let events = step(w, [{ type: "Attack", monster: archer.id }]);
        for (
          let i = 0;
          i < 60 && !events.some((e) => e.type === "MonsterDied");
          i++
        ) {
          events = step(w, []);
        }
        const arrow = w.projectiles.find((p) => p.from === archer.id);
        if (!events.some((e) => e.type === "MonsterDied") || !arrow) continue;
        found += 1;

        const landed = onHero([...events, ...untilGone(w, arrow)]);

        expect(w.monsters).not.toContain(archer);
        expect(landed).toHaveLength(1);
        const [hit] = landed;
        if (hit.type !== "HeroHit") throw new Error("No hit at 0 Defense");
        expect(hit.damage).toBeGreaterThanOrEqual(3);
        expect(hit.damage).toBeLessThanOrEqual(6);
      }
    }

    expect(found).toBeGreaterThan(0);
  });
});
