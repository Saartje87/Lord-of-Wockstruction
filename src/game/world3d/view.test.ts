import { describe, expect, it } from "vitest";
import { arenaWith } from "../input/testArena";
import {
  CAST_STEPS,
  DEATH_STEPS,
  HERO_FLINCH_STEPS,
  HIT_STEP,
  OPENING_STEPS,
  SWING_STEPS,
  step,
  type World,
} from "../sim/world";
import { inputTuning } from "../tuning/input";
import { ATTACK_CONTACT } from "./clips";
import { type PointerState, worldViewOf } from "./view";

const NO_POINTER: PointerState = { hoverTile: null, click: null };

describe("the 3D World view of the Hero", () => {
  it("stands idle when nothing happens", () => {
    const world = arenaWith([], { combat: true });

    const { hero } = worldViewOf(world, 0, NO_POINTER);

    expect(hero.animation.clip).toBe("idle");
    expect(hero.pos).toEqual({ x: 10, y: 10 });
  });

  it("runs while walking, facing the way it goes", () => {
    const world = arenaWith([], { combat: true });
    step(world, [{ type: "MoveTo", target: { x: 10, y: 15 } }]);

    const { hero } = worldViewOf(world, 1, NO_POINTER);

    expect(hero.animation.clip).toBe("run");
    expect(hero.facing).toBeCloseTo(Math.PI / 2);
  });

  it("sits between the previous and the current position by alpha", () => {
    const world = arenaWith([], { combat: true });
    step(world, [{ type: "MoveTo", target: { x: 10, y: 15 } }]);
    const from = world.hero.prevPos;
    const to = world.hero.pos;

    const half = worldViewOf(world, 0.5, NO_POINTER).hero.pos;

    expect(half.x).toBeCloseTo((from.x + to.x) / 2);
    expect(half.y).toBeCloseTo((from.y + to.y) / 2);
    expect(worldViewOf(world, 0, NO_POINTER).hero.pos).toEqual(from);
    expect(worldViewOf(world, 1, NO_POINTER).hero.pos).toEqual(to);
  });

  it("shows the swing's contact frame on the step the hit lands", () => {
    const world = arenaWith([{ x: 11, y: 10 }], { combat: true });
    const swingAt = { type: "SwingAt", target: { x: 11, y: 10 } } as const;
    let landed = false;
    let lastBefore = -1;
    for (let i = 0; i < SWING_STEPS && !landed; i++) {
      const events = step(world, i === 0 ? [swingAt] : []);
      landed = events.some(
        (event) => event.type === "HitLanded" || event.type === "Missed",
      );
      const { animation } = worldViewOf(world, 1, NO_POINTER).hero;
      expect(animation.clip).toBe("swing");
      if (animation.clip !== "swing") return;
      if (landed) {
        expect(animation.progress).toBeCloseTo(ATTACK_CONTACT);
      } else {
        // Before the hit the swing hasn't reached its contact frame.
        expect(animation.progress).toBeLessThan(ATTACK_CONTACT);
        expect(animation.progress).toBeGreaterThanOrEqual(lastBefore);
        lastBefore = animation.progress;
      }
    }
    expect(landed).toBe(true);
    expect(world.hero.swing?.elapsed).toBe(HIT_STEP);
  });

  it("finishes the swing's clip as the swing ends", () => {
    const world = arenaWith([], { combat: true });
    world.hero.swing = {
      elapsed: SWING_STEPS - 1,
      landed: true,
      monster: null,
    };

    const { animation } = worldViewOf(world, 1, NO_POINTER).hero;

    expect(animation.clip).toBe("swing");
    if (animation.clip === "swing") {
      expect(animation.progress).toBeGreaterThan(0.95);
      expect(animation.progress).toBeLessThan(1);
    }
  });

  it("casts through the Skill's cast time", () => {
    const world = arenaWith([], { combat: true });
    world.hero.cast = { skill: "golem", elapsed: CAST_STEPS.golem / 2 };

    const { animation } = worldViewOf(world, 1, NO_POINTER).hero;

    expect(animation).toEqual({ clip: "cast", progress: 0.5 });
  });

  it("casts while a Town Portal opens", () => {
    const world = arenaWith([], { combat: true });
    world.hero.opening = { elapsed: OPENING_STEPS / 4 };

    const { animation } = worldViewOf(world, 1, NO_POINTER).hero;

    expect(animation).toEqual({ clip: "cast", progress: 0.25 });
  });

  it("flinches from the flinch's start to its end", () => {
    const world = arenaWith([], { combat: true });
    world.hero.flinch = HERO_FLINCH_STEPS;
    expect(worldViewOf(world, 1, NO_POINTER).hero.animation).toEqual({
      clip: "flinch",
      progress: 0,
    });

    world.hero.flinch = 1;
    const { animation } = worldViewOf(world, 1, NO_POINTER).hero;
    expect(animation.clip).toBe("flinch");
    if (animation.clip === "flinch") {
      expect(animation.progress).toBeCloseTo(1 - 1 / HERO_FLINCH_STEPS);
    }
  });

  it("dies over the Death's steps and then lies still", () => {
    const world: World = arenaWith([], { combat: true });
    world.death = { elapsed: DEATH_STEPS / 2 };
    expect(worldViewOf(world, 1, NO_POINTER).hero.animation).toEqual({
      clip: "death",
      progress: 0.5,
    });

    world.death = { elapsed: DEATH_STEPS * 3 };
    expect(worldViewOf(world, 1, NO_POINTER).hero.animation).toEqual({
      clip: "death",
      progress: 1,
    });
  });
});

describe("the 3D World view of the pointer", () => {
  it("shows the hover tile it is given", () => {
    const world = arenaWith([], { combat: true });

    const view = worldViewOf(world, 0, {
      hoverTile: { x: 4, y: 5 },
      click: null,
    });

    expect(view.hoverTile).toEqual({ x: 4, y: 5 });
  });

  it("fades the click marker out over its time, then drops it", () => {
    const world = arenaWith([], { combat: true });
    const at = { x: 12.5, y: 9.5 };
    const marker = (ageMs: number) =>
      worldViewOf(world, 0, { hoverTile: null, click: { at, ageMs } })
        .clickMarker;

    expect(marker(0)).toEqual({ at, progress: 0 });
    expect(marker(inputTuning.clickMarkerMs / 2)?.progress).toBeCloseTo(0.5);
    expect(marker(inputTuning.clickMarkerMs)).toBeNull();
  });

  it("shows no click marker without a click", () => {
    const world = arenaWith([], { combat: true });

    expect(worldViewOf(world, 0, NO_POINTER).clickMarker).toBeNull();
  });
});
