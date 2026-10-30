import { describe, expect, it } from "vitest";
import { areas, tilesets } from "../content";
import { createWorld } from "../sim/world";
import { START_DRIFT, startFocusAt, startViewOf } from "./startView";

const world = () => createWorld({ areas, tilesets, seed: 1 });
const centre = { x: 20, y: 20 };

describe("the Start Screen's camera", () => {
  it("drifts slowly about the centre, never far from it", () => {
    for (let ms = 0; ms < 5 * 60_000; ms += 3_333) {
      const at = startFocusAt(centre, ms);
      expect(Math.hypot(at.x - centre.x, at.y - centre.y)).toBeLessThanOrEqual(
        START_DRIFT.radius * 1.5,
      );
    }
  });

  it("moves, but only a little each second", () => {
    const before = startFocusAt(centre, 10_000);
    const after = startFocusAt(centre, 11_000);
    const moved = Math.hypot(after.x - before.x, after.y - before.y);

    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(0.5);
  });
});

describe("the Start Screen's view of the Town", () => {
  it("hides the Hero and looks from the camera's focus", () => {
    const focus = { x: 14, y: 16 };

    const view = startViewOf(world(), focus, 5_000);

    expect(view.hero.visible).toBe(false);
    expect(view.hero.pos).toEqual(focus);
  });

  it("keeps the NPCs standing idle while the World is not stepped", () => {
    const standing = world();
    const early = startViewOf(standing, centre, 1_000).npcs;
    const later = startViewOf(standing, centre, 2_000).npcs;

    expect(early.length).toBeGreaterThan(0);
    expect(early.every((npc) => npc.animation.clip === "idle")).toBe(true);
    expect(early[0].animation).not.toEqual(later[0].animation);
  });

  it("shows no Monsters, Minions or Town Portal", () => {
    const view = startViewOf(world(), centre, 0);

    expect(view.monsters).toEqual([]);
    expect(view.minions).toEqual([]);
    expect(view.townPortals).toEqual([]);
  });
});
