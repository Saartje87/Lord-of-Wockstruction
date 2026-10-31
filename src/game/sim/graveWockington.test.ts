import { afterEach, describe, expect, it } from "vitest";
import { graveWockingtonTuning } from "../tuning/graveWockington";
import { heroTuning } from "../tuning/hero";
import { isPotion } from "../tuning/items";
import { monsterTuning } from "../tuning/monsters";
import { loadArea } from "./area";
import { monsterMaxLife } from "./monsters";
import { isLobbed } from "./projectiles";
import { combatArea } from "./testAreas";
import { msToSteps } from "./units";
import {
  createWorld,
  FRESH_PROGRESS,
  type Order,
  type Progress,
  questOf,
  type SimEvent,
  step,
  type World,
} from "./world";

/** A point object in the middle of tile (x, y). */
function point(type: string, name: string, x: number, y: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
}

/** The Act Boss spawn: Grave Wockington on tile (x, 1). */
function actBoss(x: number) {
  return {
    ...point("actBoss", "Grave Wockington", x, 1),
    properties: [
      { name: "monster", type: "string", value: "grave_wockington" },
    ],
  };
}

function map(width: number, objects: object[]) {
  return {
    orientation: "orthogonal",
    width,
    height: 3,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width,
        height: 3,
        data: new Array(width * 3).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const town = map(6, [point("entry", "start", 1, 1)]);

/** The Ossuary, with the Hero `gap` tiles from Grave Wockington. */
function ossuary(gap: number) {
  return combatArea(
    map(40, [point("entry", "start", 1, 1), actBoss(1 + gap)]),
    11,
  );
}

function inOssuary(
  gap: number,
  progress: Progress = FRESH_PROGRESS,
  seed = 1,
): World {
  return createWorld({
    areas: { town, ossuary: ossuary(gap) },
    seed,
    progress,
    start: { area: "ossuary", entry: "start" },
  });
}

/** Progress with the Act Boss Quest in `state`. */
function actBossIs(state: "notGiven" | "given" | "ready" | "done"): Progress {
  return {
    ...FRESH_PROGRESS,
    quests: { ...FRESH_PROGRESS.quests, "act-boss": { state, count: 0 } },
  };
}

const flinch = heroTuning.flinchChance;
afterEach(() => {
  heroTuning.flinchChance = flinch;
});

/** Steps `world` `steps` times, with nobody hurting the Hero; the events. */
function wait(world: World, steps: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    events.push(...step(world, []));
    world.hero.life = 1_000_000;
  }
  return events;
}

/** Has the Hero attack Grave Wockington until he dies; the events. */
function kill(world: World): SimEvent[] {
  heroTuning.flinchChance = 0;
  const boss = world.monsters.find((m) => m.type === "grave_wockington");
  if (!boss) throw new Error("no Grave Wockington");
  boss.life = 1;
  // Already past half, so no turn gets between the Hero and his kill.
  if (boss.waves) boss.waves.stage = 1;
  const events: SimEvent[] = [];
  for (let i = 0; i < 6000 && world.monsters.includes(boss); i++) {
    const orders: Order[] =
      i % 120 === 0 ? [{ type: "Attack", monster: boss.id }] : [];
    events.push(...step(world, orders));
    world.hero.life = 1_000_000;
  }
  return events;
}

describe("Grave Wockington", () => {
  it("waits where the map puts him, a Unique Monster of his own type", () => {
    const world = inOssuary(30);
    const [boss] = world.monsters;

    expect(world.monsters).toHaveLength(1);
    expect(boss.type).toBe("grave_wockington");
    expect(boss.unique).toBe("Grave Wockington");
    expect(boss.monsterLevel).toBe(11);
    expect(boss.life).toBe(monsterMaxLife(boss));
  });

  it("raises no Skeletons while he hasn't noticed the Hero", () => {
    const world = inOssuary(30);

    const events = wait(world, 60 * 30);

    expect(events.some((event) => event.type === "WaveRaised")).toBe(false);
    expect(world.monsters).toHaveLength(1);
  });

  it("raises a wave of Skeletons around himself once after the Hero", () => {
    const world = inOssuary(6);
    const [boss] = world.monsters;

    const events = wait(
      world,
      msToSteps(graveWockingtonTuning.firstWaveMs) + 5,
    );
    const wave = events.find((event) => event.type === "WaveRaised");

    expect(wave).toMatchObject({ type: "WaveRaised", boss: boss.id });
    const raised = world.monsters.filter((m) => m.id !== boss.id);
    expect(raised).toHaveLength(graveWockingtonTuning.waveSize);
    for (const skeleton of raised) {
      expect(skeleton.type).toBe("skeleton");
      expect(skeleton.monsterLevel).toBe(11);
      expect(skeleton.unique).toBeNull();
    }
  });

  it("raises more in later waves, never above his limit alive", () => {
    const world = inOssuary(6);
    const waveSteps = msToSteps(graveWockingtonTuning.waveEveryMs);

    const events = wait(world, 4 * waveSteps);

    const waves = events.filter((event) => event.type === "WaveRaised");
    expect(waves.length).toBeGreaterThanOrEqual(2);
    const alive = world.monsters.filter((m) => m.type === "skeleton");
    expect(alive.length).toBeLessThanOrEqual(graveWockingtonTuning.raisedLimit);
  });

  it("is back in every new Session", () => {
    const first = inOssuary(30, actBossIs("done"));
    const second = inOssuary(30, actBossIs("done"));

    for (const world of [first, second]) {
      expect(world.monsters.map((m) => m.unique)).toEqual(["Grave Wockington"]);
    }
  });
});

describe("killing Grave Wockington", () => {
  it.each([
    "notGiven",
    "given",
  ] as const)("completes the Act and makes the Quest Ready when it is %s", (state) => {
    const world = inOssuary(3, actBossIs(state));

    const events = kill(world);

    expect(events).toContainEqual({ type: "ActCompleted", act: 1 });
    expect(events).toContainEqual({ type: "QuestReady", quest: "act-boss" });
    expect(questOf(world, "act-boss").state).toBe("ready");
  });

  it("completes the Act again while the Quest is Ready but not handed in", () => {
    const events = kill(inOssuary(3, actBossIs("ready")));

    expect(events).toContainEqual({ type: "ActCompleted", act: 1 });
  });

  it("shows no Act Complete once the Quest is Done", () => {
    const world = inOssuary(3, actBossIs("done"));

    const events = kill(world);

    expect(events.some((event) => event.type === "MonsterDied")).toBe(true);
    expect(events.some((event) => event.type === "ActCompleted")).toBe(false);
    expect(questOf(world, "act-boss").state).toBe("done");
  });

  it("always drops two Rare Items and a Magic or Rare one, with Affixes", () => {
    const second = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const items = kill(inOssuary(3, FRESH_PROGRESS, seed))
        .filter((event) => event.type === "ItemDropped")
        .map((event) => event.item)
        .filter((item) => !isPotion(item.type));

      expect(items).toHaveLength(3);
      expect(items[0].rarity).toBe("rare");
      expect(items[1].rarity).toBe("rare");
      expect(["magic", "rare"]).toContain(items[2].rarity);
      second.add(items[2].rarity);
      for (const item of items) {
        expect(item.affixes.length).toBeGreaterThanOrEqual(
          item.rarity === "rare" ? 3 : 1,
        );
      }
    }
    expect([...second].sort()).toEqual(["magic", "rare"]);
  });

  it("still rolls the usual Potion drop", () => {
    let potions = 0;
    for (let seed = 1; seed <= 60; seed++) {
      potions += kill(inOssuary(3, FRESH_PROGRESS, seed)).filter(
        (event) => event.type === "ItemDropped" && isPotion(event.item.type),
      ).length;
    }
    expect(potions).toBeGreaterThan(0);
  });

  it("leaves play going on in the Area", () => {
    const world = inOssuary(3);

    kill(world);
    step(world, []);

    expect(world.areaName).toBe("ossuary");
    expect(world.death).toBeNull();
  });
});

/** A world with a first wave raised around Grave Wockington. */
function withWave(gap: number) {
  const world = inOssuary(gap);
  wait(world, msToSteps(graveWockingtonTuning.firstWaveMs) + 5);
  const boss = world.monsters.find((m) => m.type === "grave_wockington");
  if (!boss) throw new Error("no Grave Wockington");
  const raised = world.monsters.filter((m) => m !== boss).map((m) => m.id);
  expect(raised.length).toBeGreaterThan(0);
  return { world, boss, raised };
}

/** Has the Hero attack `id` until it is gone; the events. */
function attackUntilGone(world: World, id: number): SimEvent[] {
  heroTuning.flinchChance = 0;
  const events: SimEvent[] = [];
  for (let i = 0; i < 3000 && world.monsters.some((m) => m.id === id); i++) {
    events.push(
      ...step(world, i % 120 === 0 ? [{ type: "Attack", monster: id }] : []),
    );
    world.hero.life = 1_000_000;
  }
  return events;
}

describe("his raised Monsters falling with him", () => {
  it("die at once with him, each leaving a Corpse, for no Experience or drops", () => {
    const { world, boss, raised } = withWave(3);
    boss.life = 1;
    const others = world.monsters.filter((m) => m !== boss);
    for (const other of others) other.life = 1_000_000;

    const events = attackUntilGone(world, boss.id);

    expect(world.monsters).toHaveLength(0);
    const corpses = world.corpses.map((corpse) => corpse.id);
    for (const id of raised) {
      expect(corpses).toContain(id);
      expect(events).toContainEqual({ type: "MonsterDied", id });
    }
    // Only his own kill gave Experience.
    expect(events.filter((e) => e.type === "ExperienceGained")).toHaveLength(1);
    const dropped = events.filter((e) => e.type === "ItemDropped");
    const bossDrops = events.filter(
      (e) => e.type === "ItemDropped" && e.pos.x === boss.pos.x,
    );
    expect(dropped).toEqual(bossDrops);
  });

  it("die when he starts Returning, for no Experience or drops", () => {
    const { world, boss, raised } = withWave(6);
    boss.pos = { x: boss.home.x + 25, y: boss.home.y };

    const events = wait(world, 2);

    expect(boss.state).toBe("return");
    expect(world.monsters).toEqual([boss]);
    for (const id of raised) {
      expect(world.corpses.map((corpse) => corpse.id)).toContain(id);
      expect(events).toContainEqual({ type: "MonsterDied", id });
    }
    expect(events.some((e) => e.type === "ExperienceGained")).toBe(false);
    expect(events.some((e) => e.type === "ItemDropped")).toBe(false);
  });

  it("leave a Corpse and give Experience when the Hero kills them", () => {
    const { world, raised } = withWave(3);
    const skeleton = world.monsters.find((m) => m.id === raised[0]);
    if (!skeleton) throw new Error("no raised Skeleton");
    skeleton.life = 1;

    const events = attackUntilGone(world, skeleton.id);

    expect(world.corpses.map((corpse) => corpse.id)).toContain(skeleton.id);
    expect(events.some((e) => e.type === "ExperienceGained")).toBe(true);
  });
});

/** Steps until his first wave is raised; the events. */
function untilFirstWave(world: World): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 60 * 20; i++) {
    events.push(...wait(world, 1));
    if (events.some((e) => e.type === "WaveRaised")) return events;
  }
  throw new Error("No wave");
}

function bossOf(world: World) {
  const boss = world.monsters.find((m) => m.type === "grave_wockington");
  if (!boss) throw new Error("no Grave Wockington");
  return boss;
}

/** Raises his first wave, then lowers him to `fraction` of his Life. */
function afterFirstWave(fraction: number) {
  const world = inOssuary(6);
  const boss = bossOf(world);
  untilFirstWave(world);
  boss.life = Math.floor(monsterMaxLife(boss) * fraction);
  return { world, boss };
}

describe("the turn at half his Life", () => {
  const second = graveWockingtonTuning.pastHalf;

  it("raises Skeletons only while he is above half his Life", () => {
    const world = inOssuary(6);
    const boss = bossOf(world);
    boss.life = Math.floor(monsterMaxLife(boss) / 2) + 1;

    const events = wait(
      world,
      3 * msToSteps(graveWockingtonTuning.waveEveryMs),
    );

    expect(events.some((e) => e.type === "WaveRaised")).toBe(true);
    expect(events.some((e) => e.type === "BossFlared")).toBe(false);
    expect(
      world.monsters.filter((m) => m !== boss).map((m) => m.type),
    ).not.toContain("skeleton_archer");
  });

  it("raises a wave at once, once, the first step he is at or below half", () => {
    const { world, boss } = afterFirstWave(0.5);
    // Well before the timer would raise one.
    expect(boss.waves?.cooldown ?? 0).toBeGreaterThan(30);
    for (const m of world.monsters) if (m !== boss) m.life = 0;
    world.monsters = [boss];
    const before = world.monsters.length;

    const events = wait(world, 1);
    const later = wait(world, 2 * msToSteps(second.waveEveryMs) - 10);

    expect(events).toContainEqual({ type: "BossFlared", boss: boss.id });
    expect(events.some((e) => e.type === "WaveRaised")).toBe(true);
    expect(world.monsters.length).toBeGreaterThan(before);
    expect(later.filter((e) => e.type === "BossFlared")).toHaveLength(0);
  });

  it("raises the turn's wave to the past-half limit, with the Archer, over first-half Skeletons alive", () => {
    const { world, boss } = afterFirstWave(0.6);
    const first = graveWockingtonTuning.raisedLimit;
    const alive = () => boss.waves?.raised.length ?? 0;
    // Fill his first-half limit with living Skeletons.
    for (let i = 0; i < 60 * 30 && alive() < first; i++) {
      if (boss.waves) boss.waves.cooldown = Math.min(boss.waves.cooldown, 1);
      wait(world, 1);
    }
    boss.life = Math.floor(monsterMaxLife(boss) / 2);
    expect(alive()).toBe(first);

    const events = wait(world, 1);
    const wave = events.find((e) => e.type === "WaveRaised");

    expect(second.raisedLimit).toBeGreaterThan(first);
    if (wave?.type !== "WaveRaised") throw new Error("no turn wave");
    expect(wave.monsters).toHaveLength(
      Math.min(second.waveSize, second.raisedLimit - first),
    );
    expect(
      wave.monsters.map((id) => world.monsters.find((m) => m.id === id)?.type),
    ).toContain("skeleton_archer");
    expect(alive()).toBeLessThanOrEqual(second.raisedLimit);
  });

  it("raises more in later waves, each with one Skeleton Archer, on a shorter timer", () => {
    const { world, boss } = afterFirstWave(0.4);
    wait(world, 1);
    expect(second.waveEveryMs).toBeLessThan(graveWockingtonTuning.waveEveryMs);
    expect(second.waveSize).toBeGreaterThan(graveWockingtonTuning.waveSize);

    const events = wait(world, msToSteps(second.waveEveryMs) + 5);
    const waves = events.filter((e) => e.type === "WaveRaised");

    expect(waves.length).toBeGreaterThanOrEqual(1);
    for (const wave of waves) {
      if (wave.type !== "WaveRaised") continue;
      const types = wave.monsters.map(
        (id) =>
          world.monsters.find((m) => m.id === id)?.type ??
          world.corpses.find((c) => c.id === id)?.type,
      );
      expect(types.filter((t) => t === "skeleton_archer")).toHaveLength(1);
    }
    expect(second.raisedLimit).toBeGreaterThanOrEqual(
      graveWockingtonTuning.raisedLimit,
    );
    expect(boss.waves?.raised.length).toBeLessThanOrEqual(second.raisedLimit);
  });

  it("casts Gravefire again sooner than before the turn", () => {
    const recoveryMs = monsterTuning.grave_wockington.attack;
    if (recoveryMs.kind !== "ranged" || !recoveryMs.recoveryMs)
      throw new Error("no tuning");
    expect(recoveryMs.recoveryMs[1]).toBeLessThan(recoveryMs.recoveryMs[0]);
    const { world, boss } = afterFirstWave(0.4);
    wait(world, 1);
    for (const m of world.monsters) if (m !== boss) m.life = 0;
    boss.cooldown = 0;
    boss.state = "chase";
    for (let i = 0; i < 600 && !world.projectiles.some(isLobbed); i++) {
      wait(world, 1);
    }
    expect(world.projectiles.some(isLobbed)).toBe(true);
    const t = monsterTuning.grave_wockington;
    const most =
      msToSteps(t.rootMs) +
      msToSteps(recoveryMs.recoveryMs[1]) +
      msToSteps(t.jitterMs) +
      msToSteps(t.windUpMs) +
      4;

    expect(boss.cooldown).toBeLessThanOrEqual(most);
  });

  it("takes damage throughout the turn", () => {
    heroTuning.flinchChance = 0;
    const world = inOssuary(3);
    const boss = bossOf(world);
    boss.life = Math.floor(monsterMaxLife(boss) / 2) + 1;
    let flared = false;
    let hurtAfter = false;
    for (let i = 0; i < 3000 && !hurtAfter; i++) {
      const events = step(
        world,
        i % 120 === 0 ? [{ type: "Attack", monster: boss.id }] : [],
      );
      world.hero.life = 1_000_000;
      flared ||= events.some((e) => e.type === "BossFlared");
      hurtAfter =
        flared &&
        events.some((e) => e.type === "HitLanded" && e.target === boss.id);
    }

    expect(flared).toBe(true);
    expect(hurtAfter).toBe(true);
  });

  it("goes back to the first stage with full Life when he Returns", () => {
    const { world, boss } = afterFirstWave(0.4);
    wait(world, 1);
    boss.pos = { x: boss.home.x + 25, y: boss.home.y };

    wait(world, 2);
    expect(boss.state).toBe("return");
    boss.pos = { ...boss.home };
    const events: SimEvent[] = [];
    for (let i = 0; i < 600 && boss.life < monsterMaxLife(boss); i++) {
      events.push(...step(world, []));
      world.hero.life = 1_000_000;
    }

    expect(boss.life).toBe(monsterMaxLife(boss));
    expect(boss.waves?.stage).toBe(0);
  });
});

describe("an Act Boss object", () => {
  it("must not appear twice in one Area", () => {
    expect(() =>
      loadArea(
        "ossuary",
        combatArea(
          map(10, [point("entry", "start", 1, 1), actBoss(4), actBoss(5)]),
        ),
      ),
    ).toThrow(/two Act Boss/);
  });
});
