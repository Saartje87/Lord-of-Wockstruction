import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import { msToSteps } from "../sim/units";
import { monsterTuning } from "../tuning/monsters";
import { MONSTER_LOOKS } from "./monsterLook";
import { type Effects, type PointerState, worldViewOf } from "./view";

const NO_POINTER: PointerState = {
  hoverTile: null,
  click: null,
  highlight: null,
};
const NO_EFFECTS: Effects = {
  flashes: new Map(),
  deadForMs: new Map(),
  portals: [],
  bursts: [],
  curses: [],
  levelUpAgoMs: null,
  departedMinions: [],
};

const withSkeleton = () => {
  const world = arenaWith([{ x: 12, y: 10 }], { combat: true });
  return { world, monster: world.monsters[0] };
};

const firstMonster = (
  world: ReturnType<typeof withSkeleton>["world"],
  effects = NO_EFFECTS,
) => worldViewOf(world, 1, NO_POINTER, effects).monsters[0];

describe("the 3D World view of the Monsters", () => {
  it("scrubs a winding-up Monster's attack clip up to contact as the wind-up ends", () => {
    const { world, monster } = withSkeleton();
    monster.state = "windup";
    monster.attack = 0;
    const start = firstMonster(world);
    monster.attack = msToSteps(monsterTuning.skeleton.windUpMs) - 1;
    const end = firstMonster(world);

    expect(start.animation).toEqual({ clip: "attack", progress: 0 });
    expect(end.animation.clip).toBe("attack");
    const reached = "progress" in end.animation ? end.animation.progress : -1;
    expect(reached).toBeLessThan(MONSTER_LOOKS.skeleton.contact);
    expect(reached).toBeGreaterThan(MONSTER_LOOKS.skeleton.contact * 0.9);
  });

  it("plays the rest of the attack clip during the recovery", () => {
    const { world, monster } = withSkeleton();
    monster.state = "recover";
    monster.attack = msToSteps(monsterTuning.skeleton.rootMs);
    const rooted = firstMonster(world);
    monster.attack = 0;
    const done = firstMonster(world);

    expect(rooted.animation).toEqual({
      clip: "attack",
      progress: expect.closeTo(MONSTER_LOOKS.skeleton.contact, 5),
    });
    expect(done.animation).toEqual({
      clip: "attack",
      progress: expect.closeTo(1, 5),
    });
  });

  it("gives a Monster the clip of its state", () => {
    const { world, monster } = withSkeleton();
    expect(firstMonster(world).animation.clip).toBe("idle");

    monster.prevPos = { x: 12.1, y: 10 };
    monster.state = "wander";
    expect(firstMonster(world).animation.clip).toBe("walk");

    monster.state = "chase";
    expect(firstMonster(world).animation.clip).toBe("run");

    monster.flinch = 5;
    expect(firstMonster(world).animation.clip).toBe("flinch");
  });

  it("draws a Wockwolf as the Werewolf, scaled down, with the clip of its state", () => {
    const { world, monster } = withSkeleton();
    monster.type = "wockwolf";

    const look = MONSTER_LOOKS.wockwolf;
    expect(look.model).toBe("Werewolf");
    expect(look.scale).toBeLessThan(1);
    expect(look.height).toBeLessThan(1.2);
    expect(firstMonster(world).type).toBe("wockwolf");
    expect(firstMonster(world).animation.clip).toBe("idle");
    monster.state = "chase";
    monster.prevPos = { x: 12.1, y: 10 };
    expect(firstMonster(world).animation.clip).toBe("run");
    monster.state = "windup";
    monster.attack = 0;
    expect(firstMonster(world).animation.clip).toBe("attack");
    monster.state = "wander";
    monster.flinch = 3;
    expect(firstMonster(world).animation.clip).toBe("flinch");
    for (const clip of [
      "idle",
      "walk",
      "run",
      "attack",
      "flinch",
      "death",
    ] as const) {
      expect(look.clips[clip]).toBeTruthy();
    }
  });

  it("flashes a hit Monster by the strength it is given", () => {
    const { world, monster } = withSkeleton();
    const effects = { ...NO_EFFECTS, flashes: new Map([[monster.id, 0.8]]) };

    expect(firstMonster(world, effects).flash).toBe(0.8);
    expect(firstMonster(world).flash).toBe(0);
  });

  it("lays a killed Monster down as a Corpse where it died, falling and then lying still", () => {
    const { world, monster } = withSkeleton();
    world.monsters = [];
    world.corpses.push({
      id: monster.id,
      type: monster.type,
      monsterLevel: 1,
      pos: { x: 12.5, y: 10.5 },
    });
    const falling = {
      ...NO_EFFECTS,
      deadForMs: new Map([[monster.id, 400]]),
    };

    const lying = firstMonster(world);
    const dying = firstMonster(world, falling);

    expect(lying.corpse).toBe(true);
    expect(lying.pos).toEqual({ x: 12.5, y: 10.5 });
    expect(lying.animation).toEqual({ clip: "death", progress: 1 });
    expect(dying.animation).toEqual({
      clip: "death",
      progress: expect.closeTo(0.5, 5),
    });
  });
});
