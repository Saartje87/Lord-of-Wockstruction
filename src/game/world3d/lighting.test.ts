import { Scene } from "three";
import { describe, expect, it } from "vitest";
import { createLighting, lightScene, TORCH_LIGHTS } from "./lighting";

const hero = { pos: { x: 10, y: 10 } };

describe("the scene's lights", () => {
  it("gives the light pool to the standing lanterns of Town", () => {
    const scene = new Scene();
    const lighting = createLighting(scene);
    const before = scene.children.length;

    lightScene(
      lighting,
      {
        hero,
        torches: [],
        lamps: [{ pos: { x: 12, y: 10 } }],
        combat: false,
      },
      1,
    );

    expect(lighting.torches[0].intensity).toBeGreaterThan(0);
    expect(lighting.torches[0].position.x).toBeCloseTo(12);
    expect(lighting.torches[0].color.getHex()).toBe(0xffa04a);
    expect(lighting.torches[1].intensity).toBe(0);
    expect(scene.children.length).toBe(before);
  });

  it("lights Town with the moon, under a little fog, and Combat Areas without", () => {
    const scene = new Scene();
    const lighting = createLighting(scene);
    const before = scene.children.length;
    const dark = lighting.ambient.intensity;

    lightScene(lighting, { hero, torches: [], lamps: [], combat: false }, 1);
    const town = {
      ambient: lighting.ambient.intensity,
      moon: lighting.moon.intensity,
      fogEnds: lighting.fog.far,
      fogNear: lighting.fog.near,
      background: scene.background,
    };
    lightScene(lighting, { hero, torches: [], lamps: [], combat: true }, 1);

    expect(town.ambient).toBeGreaterThan(dark);
    expect(town.moon).toBeGreaterThan(lighting.moon.intensity);
    expect(town.fogNear).toBeLessThan(lighting.fog.near);
    expect(town.fogEnds).toBeLessThan(lighting.fog.far);
    expect(lighting.fog.near).toBeGreaterThan(1000);
    expect(lighting.ambient.intensity).toBe(dark);
    // The same lights as ever: nothing was added or taken away.
    expect(scene.children.length).toBe(before);
    expect(scene.fog).toBe(lighting.fog);
  });

  it("keeps the same lights as lanterns and torches come and go", () => {
    const scene = new Scene();
    const lighting = createLighting(scene);
    const lamps = Array.from({ length: 9 }, (_, i) => ({
      pos: { x: 10 + i * 0.5, y: 11 },
    }));

    lightScene(lighting, { hero, torches: [], lamps, combat: false }, 1);

    expect(lighting.torches).toHaveLength(TORCH_LIGHTS);
    expect(lighting.torches.every((light) => light.intensity > 0)).toBe(true);
  });
});
