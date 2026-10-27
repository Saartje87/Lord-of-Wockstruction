import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, saveOf } from "../save";
import { minionTuning } from "../tuning/minions";
import { monsterTuning } from "../tuning/monsters";
import {
  minionAttackRating,
  minionDamageRange,
  minionDefense,
  newMinion,
} from "./minions";
import { monsterMaxLife } from "./monsters";
import { emptySkillBar } from "./skillBar";
import { combatArea } from "./testAreas";
import { distance, type Vec } from "./vec";
import {
  createWorld,
  FRESH_PROGRESS,
  isInCombat,
  maxLife,
  minionMaxLife,
  type Progress,
  type SimEvent,
  step,
  type World,
} from "./world";

/**
 * An orthogonal Area drawn row by row: `.` floor, `#` wall, `H` the Hero's
 * `start`, `A` an Entry named `arrive`, `S` one Skeleton and `E` an Exit to
 * the other Area's `arrive`, each in the middle of its tile. A Combat Area has `areaLevel`;
 * Town has none.
 */
function map(rows: string[], exitTo: string, areaLevel: number | null) {
  const width = rows[0].length;
  const height = rows.length;
  const cells = rows.join("");
  const objects: object[] = [];
  [...cells].forEach((cell, i) => {
    const x = ((i % width) + 0.5) * 32;
    const y = (Math.floor(i / width) + 0.5) * 32;
    if (cell === "H") objects.push({ name: "start", type: "entry", x, y });
    if (cell === "A") objects.push({ name: "arrive", type: "entry", x, y });
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
  skillLevels: { golem: 1 },
  skillBar: { ...emptySkillBar(), right: "golem" },
};

/**
 * Town, a strip with an Exit at its west end, and a field: a Combat Area
 * with no Monsters, a wall across most of its middle column and a walled-off
 * pocket in its south-east corner.
 */
const AREAS = {
  town: map(["EA.....H"], "field", null),
  field: map(
    [
      "EA........H.........",
      "....................",
      ".....#..............",
      ".....#..............",
      ".....#..####........",
      ".....#..#..#........",
      ".....#..#..#........",
    ],
    "town",
    1,
  ),
};

function world(progress: Progress = GOLEM_HERO, areas = AREAS): World {
  return createWorld({ areas, seed: 1, progress });
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

/** Walks the Hero to `target`, stepping until they stand there. */
function walkTo(w: World, target: Vec): SimEvent[] {
  const events = step(w, [{ type: "MoveTo", target }]);
  events.push(...stepUntil(w, () => w.hero.path.length === 0));
  return events;
}

/** A World with the Hero just arrived in the field, at tile (1, 0). */
function inField(progress?: Progress, areas = AREAS): World {
  const w = world(progress, areas);
  step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  stepUntil(w, () => w.areaName === "field" && !w.areaChange);
  return w;
}

/** Casts the Golem at `target`, then waits out the cast. */
function summonAt(w: World, target: Vec) {
  step(w, [{ type: "Cast", slot: "right", target }]);
  stepUntil(w, () => !w.hero.cast);
}

function golemOf(w: World) {
  const [golem] = w.minions;
  if (!golem) throw new Error("No Golem");
  return golem;
}

/**
 * A Golem-like Minion at `pos` that no cast brought, for the caller to add
 * to the Hero's Minions: the Hero can't have two Golems.
 */
function anotherMinion(w: World, pos: Vec) {
  return newMinion(w.nextMinionId++, "golem", "golem", 1, pos, 0);
}

const { followDistance, speed, stuckMs } = minionTuning.golem;
const { leash } = monsterTuning.skeleton;
const golemLeash = minionTuning.golem.leash;

describe("the Hero's Minions", () => {
  it("start as none, and a cast Golem joins them knowing the Skill that brought it", () => {
    const w = inField();
    expect(w.minions).toEqual([]);

    summonAt(w, { x: 3.5, y: 4.5 });

    expect(w.minions).toEqual([
      expect.objectContaining({ type: "golem", skill: "golem" }),
    ]);
  });
});

describe("the Golem following the Hero", () => {
  it("walks around walls after a Hero who left it behind and stops within the follow distance", () => {
    const w = inField();
    summonAt(w, { x: 3.5, y: 4.5 });
    walkTo(w, { x: 7.5, y: 1.5 });
    walkTo(w, { x: 7.5, y: 5.5 });
    const golem = golemOf(w);

    // Never further in a step than its speed: it walks, it doesn't teleport.
    let fastest = 0;
    stepUntil(w, () => {
      fastest = Math.max(fastest, distance(golem.prevPos, golem.pos));
      return golem.pos.x > 6 && distance(golem.prevPos, golem.pos) === 0;
    });
    for (let i = 0; i < 60; i++) step(w, []);

    expect(fastest).toBeLessThanOrEqual(speed / 60 + 1e-9);
    expect(distance(golem.pos, w.hero.pos)).toBeLessThanOrEqual(
      followDistance + 1e-9,
    );
    expect(golem.pos).toEqual(golem.prevPos);
  });

  it("teleports next to the Hero from further than the teleport distance", () => {
    const w = inField();
    summonAt(w, { x: 19.5, y: 6.5 });

    step(w, []);

    const golem = golemOf(w);
    expect(distance(golem.pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
    // Not sliding across the screen to get there.
    expect(golem.prevPos).toEqual(golem.pos);
  });

  it("teleports next to the Hero once stuck where it can't walk to them", () => {
    const w = inField();
    step(w, [{ type: "Cast", slot: "right", target: { x: 9.5, y: 5.5 } }]);

    const pocket = () => golemOf(w).pos.x > 9 && golemOf(w).pos.y > 5;
    for (let i = 0; i < (stuckMs * 60) / 1000; i++) {
      step(w, []);
      expect(pocket()).toBe(true);
    }
    stepUntil(w, () => !pocket(), 120);

    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

/** Walks the Hero onto the Exit at tile (0, 0) and through to the other Area. */
function takeExit(w: World): SimEvent[] {
  const from = w.areaName;
  const events = step(w, [{ type: "MoveTo", target: { x: 0.5, y: 0.5 } }]);
  events.push(...stepUntil(w, () => w.areaName !== from && !w.areaChange));
  return events;
}

describe("the Golem going through Exits", () => {
  it("arrives next to the Hero at the Entry, in Town and back out of it", () => {
    const w = inField();
    summonAt(w, { x: 3.5, y: 4.5 });
    const { id } = golemOf(w);

    takeExit(w);

    expect(w.areaName).toBe("town");
    expect(golemOf(w).id).toBe(id);
    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
    expect(golemOf(w).prevPos).toEqual(golemOf(w).pos);

    takeExit(w);

    expect(w.areaName).toBe("field");
    expect(golemOf(w).id).toBe(id);
    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("brings every Minion along, each next to the Hero", () => {
    const w = inField();
    summonAt(w, { x: 3.5, y: 4.5 });
    w.minions.push(anotherMinion(w, { x: 12.5, y: 3.5 }));
    const ids = w.minions.map((minion) => minion.id);

    takeExit(w);

    expect(w.minions.map((minion) => minion.id)).toEqual(ids);
    for (const minion of w.minions) {
      expect(distance(minion.pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("the Golem when the Hero dies", () => {
  it("crumbles away", () => {
    // A field where a pack of strong Skeletons soon kills the Hero.
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(["EA.H....", "..SSS...", "..SSS..."], "town", 9),
    });
    summonAt(w, { x: 6.5, y: 0.5 });
    const { id } = golemOf(w);

    // Where it stood after each step while it lived.
    let pos: Vec | null = null;
    const events = stepUntil(
      w,
      () => {
        pos = w.minions[0] ? { ...w.minions[0].pos } : pos;
        return w.death !== null;
      },
      60 * 60,
    );

    expect(events).toContainEqual({ type: "MinionCrumbled", minion: id, pos });
    expect(w.minions).toEqual([]);
  });

  it("crumbles every Minion away", () => {
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(["EA.H....", "..SSS...", "..SSS..."], "town", 9),
    });
    summonAt(w, { x: 6.5, y: 0.5 });
    w.minions.push(anotherMinion(w, { x: 7.5, y: 0.5 }));

    // Those still living when the Hero dies.
    let living: number[] = [];
    const events = stepUntil(
      w,
      () => {
        if (!w.death) living = w.minions.map((minion) => minion.id);
        return w.death !== null;
      },
      60 * 60,
    );

    const crumbled = events.flatMap((event) =>
      event.type === "MinionCrumbled" ? [event.minion] : [],
    );
    expect(living).toHaveLength(2);
    expect(crumbled).toEqual(living);
    expect(w.minions).toEqual([]);
  });
});

describe("the Golem and the Save", () => {
  it("is not kept: loading the Save starts with no Golem", () => {
    const w = inField();
    summonAt(w, { x: 4.5, y: 0.5 });
    const save = parseSave(encodeSave(saveOf(w)));

    const loaded = createWorld({
      areas: AREAS,
      seed: 2,
      progress: save?.progress,
      belongings: save?.belongings,
    });

    expect(save?.progress.skillLevels.golem).toBe(1);
    expect(loaded.minions).toEqual([]);
  });
});

describe("the Hero and the Golem", () => {
  it("walks straight through the Golem", () => {
    const w = inField();
    // On the Hero's way, within its follow distance, so it stands there.
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = { ...golemOf(w).pos };

    let nearest = Number.POSITIVE_INFINITY;
    step(w, [{ type: "MoveTo", target: { x: 7.5, y: 0.5 } }]);
    stepUntil(w, () => {
      nearest = Math.min(nearest, distance(w.hero.pos, golem));
      return w.hero.path.length === 0;
    });

    expect(golemOf(w).pos).toEqual(golem);
    expect(nearest).toBeLessThan(0.1);
    expect(w.hero.pos).toEqual({ x: 7.5, y: 0.5 });
  });
});

/**
 * A field with a Skeleton seven tiles east of where a Golem summoned three
 * tiles east of the arriving Hero stands, and ten from the Hero.
 */
const SKELETON_FIELD = {
  ...AREAS,
  field: map(
    ["EA.........S........", "....................", "...................H"],
    "town",
    1,
  ),
};

/** The Skeleton in a World with one. */
function skeletonOf(w: World) {
  const [skeleton] = w.monsters;
  if (!skeleton) throw new Error("No Skeleton");
  return skeleton;
}

describe("Monsters fighting the Golem", () => {
  it("go after the Golem when it is nearer than the Hero, and hit it, not the Hero", () => {
    const w = inField(GOLEM_HERO, SKELETON_FIELD);
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = golemOf(w);

    const events = stepUntil(
      w,
      () => golem.life < minionMaxLife(golem),
      60 * 30,
    );

    expect(events).toContainEqual(
      expect.objectContaining({ type: "MinionHit", minion: golem.id }),
    );
    expect(events.some((event) => event.type === "HeroHit")).toBe(false);
  });

  it("go after the nearest of several Minions", () => {
    const w = inField(GOLEM_HERO, SKELETON_FIELD);
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = golemOf(w);
    // Another Minion beside the Hero, further from the Skeleton, and first.
    const other = anotherMinion(w, { x: 2.5, y: 2.5 });
    w.minions.unshift(other);

    let hit: SimEvent | undefined;
    for (let i = 0; !hit; i++) {
      if (i > 60 * 30) throw new Error("Never hit a Minion");
      hit = step(w, []).find((event) => event.type === "MinionHit");
    }

    expect(hit).toMatchObject({ minion: golem.id });
    expect(other.life).toBe(minionMaxLife(other));
  });

  it("switch to the Hero once the Hero is nearer than the Golem", () => {
    const w = inField(GOLEM_HERO, SKELETON_FIELD);
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = golemOf(w);
    stepUntil(w, () => golem.life < minionMaxLife(golem), 60 * 30);

    // Just past the Skeleton, within the Golem's follow distance.
    const { x } = skeletonOf(w).pos;
    walkTo(w, { x: x + 0.5, y: 1.5 });
    let heroHit = false;
    for (let i = 0; !heroHit; i++) {
      if (i > 600) throw new Error("Never hit the Hero");
      heroHit = step(w, []).some((event) => event.type === "HeroHit");
    }

    expect(golemOf(w)).toBe(golem);
  });

  it("keep the Hero In Combat, not regaining Life, while one chases the Golem", () => {
    const w = inField(GOLEM_HERO, SKELETON_FIELD);
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = golemOf(w);
    stepUntil(w, () => golem.life < minionMaxLife(golem), 60 * 30);
    // Hurt by the Skeleton, then back behind the Golem.
    walkTo(w, { x: skeletonOf(w).pos.x + 0.5, y: 1.5 });
    stepUntil(w, () => w.hero.life < maxLife(w), 60 * 10);
    walkTo(w, { x: 1.5, y: 0.5 });
    const life = w.hero.life;

    // Longer than damage keeps the Hero In Combat.
    const events: SimEvent[] = [];
    for (let i = 0; i < 6 * 60; i++) {
      events.push(...step(w, []));
      expect(isInCombat(w)).toBe(true);
    }

    expect(events.some((event) => event.type === "HeroHit")).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "MinionHit", minion: golem.id }),
    );
    expect(w.minions).toEqual([golem]);
    expect(w.hero.life).toBe(life);
  });

  it("wear the Golem down, sometimes Missing, until it dies and leaves no Corpse", () => {
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(
        [
          "EA.........SS.......",
          "...........SS.......",
          "...................H",
        ],
        "town",
        1,
      ),
    });
    summonAt(w, { x: 4.5, y: 0.5 });
    const golem = golemOf(w);
    const heroLife = w.hero.life;

    let lowest = golem.life;
    let regained = false;
    const events = stepUntil(
      w,
      () => {
        if (golem.life > lowest) regained = true;
        lowest = Math.min(lowest, golem.life);
        return w.minions.length === 0;
      },
      60 * 120,
    );

    expect(regained).toBe(false);
    expect(events).toContainEqual({ type: "MinionMissed", minion: golem.id });
    const dealt = events
      .filter((event) => event.type === "MinionHit")
      .reduce((sum, event) => sum + event.damage, 0);
    expect(dealt).toBeGreaterThanOrEqual(minionMaxLife(golem));
    expect(events).toContainEqual({
      type: "MinionDied",
      minion: golem.id,
      pos: golem.pos,
    });
    expect(events.some((event) => event.type === "MinionCrumbled")).toBe(false);
    expect(w.corpses).toEqual([]);
    expect(w.hero.life).toBe(heroLife);
  });

  it("and the Golem push each other apart", () => {
    const w = inField(GOLEM_HERO, SKELETON_FIELD);
    const skeleton = skeletonOf(w);
    const at = { ...skeleton.pos };
    step(w, [{ type: "Cast", slot: "right", target: at }]);
    const golem = golemOf(w);

    step(w, []);

    const apart =
      monsterTuning.skeleton.radius + minionTuning.golem.radius - 1e-9;
    expect(distance(golem.pos, skeleton.pos)).toBeGreaterThanOrEqual(apart);
    // Each gave way.
    expect(golem.pos).not.toEqual(at);
    expect(skeleton.pos).not.toEqual(at);
  });

  it("give up on the Golem past the Leash and walk home ignoring both it and the Hero", () => {
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(
        [
          "EA....S.................................",
          ".......................................H",
        ],
        "town",
        1,
      ),
    });
    summonAt(w, { x: 4.5, y: 0.5 });
    const skeleton = skeletonOf(w);
    // Where it was placed.
    const home = { x: 6.5, y: 0.5 };
    const golem = golemOf(w);
    stepUntil(w, () => golem.life < minionMaxLife(golem), 60 * 30);

    // Runs off east, the Golem lagging behind between them and the Skeleton,
    // which follows the Golem past its Leash, never reaching the Hero, and
    // turns back.
    const events = step(w, [{ type: "MoveTo", target: { x: 39.5, y: 1.5 } }]);
    let furthest = 0;
    events.push(
      ...stepUntil(w, () => {
        const gone = distance(skeleton.pos, home);
        furthest = Math.max(furthest, gone);
        return furthest > leash && gone < furthest - 1;
      }),
    );
    expect(events.some((e) => e.type === "HeroHit")).toBe(false);

    // Back past it to its home, the Golem in tow: walking home, it never
    // turns on either.
    events.length = 0;
    events.push(
      ...step(w, [{ type: "MoveTo", target: { x: home.x, y: 1.5 } }]),
      ...stepUntil(w, () => distance(skeleton.pos, home) === 0),
    );

    expect(
      events.some((e) => e.type === "HeroHit" || e.type === "MinionHit"),
    ).toBe(false);
  });
});

/**
 * A field with a Skeleton four tiles east of where the Hero arrives, at tile
 * (1, 0), at Area Level `areaLevel`.
 */
function skeletonNearHero(areaLevel = 1) {
  return {
    ...AREAS,
    field: map(
      ["EA...S..............", "....................", "...................H"],
      "town",
      areaLevel,
    ),
  };
}

describe("the Golem fighting Monsters", () => {
  it("chases a Monster near the Hero and hits it, never the Hero", () => {
    const w = inField(GOLEM_HERO, skeletonNearHero());
    summonAt(w, { x: 2.5, y: 1.5 });
    const skeleton = skeletonOf(w);
    const heroLife = w.hero.life;

    const events = stepUntil(
      w,
      () => skeleton.life < monsterMaxLife(skeleton),
      60 * 20,
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "HitLanded",
        attacker: "minion",
        target: skeleton.id,
      }),
    );
    expect(w.hero.life).toBe(heroLife);
  });

  it("kills it with hits in its damage range, sometimes Missing, and the Hero gains its Experience", () => {
    const w = inField(GOLEM_HERO, skeletonNearHero());
    summonAt(w, { x: 2.5, y: 1.5 });
    const skeleton = skeletonOf(w);
    const { experience } = w.hero.progress;

    const events = stepUntil(w, () => w.monsters.length === 0, 60 * 60);

    const hits = events.filter(
      (event) => event.type === "HitLanded" && event.attacker === "minion",
    );
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      if (hit.type !== "HitLanded") continue;
      expect(hit.damage).toBeGreaterThanOrEqual(4);
      expect(hit.damage).toBeLessThanOrEqual(8);
    }
    expect(events).toContainEqual({ type: "Missed", target: skeleton.id });
    expect(
      events.some(
        (event) => event.type === "HitLanded" && event.attacker === "hero",
      ),
    ).toBe(false);
    expect(events).toContainEqual({ type: "MonsterDied", id: skeleton.id });
    expect(w.corpses).toEqual([
      expect.objectContaining({ id: skeleton.id, type: "skeleton" }),
    ]);
    expect(events).toContainEqual({ type: "ExperienceGained", amount: 100 });
    expect(w.hero.progress.experience).toBe(experience + 100);
    // Back to following once there is nothing left to fight.
    stepUntil(
      w,
      () => distance(golemOf(w).pos, w.hero.pos) <= followDistance + 1e-9,
      120,
    );
  });

  it("gives the Hero about 5% of the Experience for a kill 10 or more Levels below them", () => {
    const w = inField(
      { ...GOLEM_HERO, level: 11, experience: 0 },
      skeletonNearHero(),
    );
    summonAt(w, { x: 2.5, y: 1.5 });

    const events = stepUntil(w, () => w.monsters.length === 0, 60 * 60);

    expect(events).toContainEqual({ type: "ExperienceGained", amount: 5 });
  });

  it("gives up on a Monster past its Leash to the Hero and goes back to following", () => {
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(
        [
          "EA...S..................................",
          ".......................................H",
        ],
        "town",
        1,
      ),
    });
    summonAt(w, { x: 2.5, y: 1.5 });
    const golem = golemOf(w);
    const skeleton = skeletonOf(w);
    stepUntil(w, () => skeleton.life < monsterMaxLife(skeleton), 60 * 10);

    // Runs off east, leaving the two fighting, but not so far that the
    // Golem teleports after them.
    step(w, [{ type: "MoveTo", target: { x: 15.5, y: 1.5 } }]);
    stepUntil(w, () => distance(skeleton.pos, w.hero.pos) > golemLeash);
    // At most a wind-up and its root to finish first.
    for (let i = 0; i < 60; i++) step(w, []);

    const gap = distance(golem.pos, w.hero.pos);
    const events: SimEvent[] = [];
    for (let i = 0; i < 30; i++) events.push(...step(w, []));
    expect(distance(golem.pos, w.hero.pos)).toBeLessThan(gap);
    expect(
      events.some(
        (e) =>
          (e.type === "HitLanded" && e.attacker === "minion") ||
          e.type === "Missed",
      ),
    ).toBe(false);
  });

  it("teleports next to the Hero once stuck where it can't walk to its Monster", () => {
    const w = inField(GOLEM_HERO, {
      ...AREAS,
      field: map(
        [
          "EA...S....H.........",
          "....................",
          ".....#..............",
          ".....#..............",
          ".....#..####........",
          ".....#..#..#........",
          ".....#..#..#........",
        ],
        "town",
        1,
      ),
    });
    step(w, [{ type: "Cast", slot: "right", target: { x: 9.5, y: 5.5 } }]);

    const pocket = () => golemOf(w).pos.x > 9 && golemOf(w).pos.y > 5;
    for (let i = 0; i < (stuckMs * 60) / 1000; i++) {
      step(w, []);
      expect(pocket()).toBe(true);
    }
    stepUntil(w, () => !pocket(), 120);

    expect(distance(golemOf(w).pos, w.hero.pos)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("is never hit by the Hero's swings", () => {
    const w = inField();
    summonAt(w, { x: 2.5, y: 0.5 });
    const golem = golemOf(w);

    const events: SimEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(
        ...step(w, [{ type: "SwingAt", target: { ...golem.pos } }]),
        ...stepUntil(w, () => !w.hero.swing),
      );
    }

    expect(golem.life).toBe(minionMaxLife(golem));
    expect(
      events.some((e) => e.type === "HitLanded" || e.type === "Missed"),
    ).toBe(false);
  });
});

describe("the Golem's Skill Level", () => {
  it("gives it more Life, damage, Attack Rating and Defense", () => {
    const at = (skillLevel: number) => {
      const w = inField({ ...GOLEM_HERO, skillLevels: { golem: skillLevel } });
      summonAt(w, { x: 2.5, y: 1.5 });
      const golem = golemOf(w);
      return {
        life: golem.life,
        damage: minionDamageRange(golem),
        attackRating: minionAttackRating(golem),
        defense: minionDefense(golem),
      };
    };

    // +20% Life and damage, +10% Attack Rating and Defense per Skill Level.
    expect(at(1)).toEqual({
      life: 180,
      damage: [4, 8],
      attackRating: 100,
      defense: 30,
    });
    expect(at(3)).toEqual({
      life: 252,
      damage: [6, 11],
      attackRating: 120,
      defense: 36,
    });
  });
});
