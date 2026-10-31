import { describe, expect, it } from "vitest";
import { dropTuning } from "./items";
import { monsterTuning } from "./monsters";

// This file has no afterEach of its own: the Vitest setup file restores tuning.
describe("tuning restore", () => {
  const shippedLife = monsterTuning.skeleton.life;
  const shippedItems = [...dropTuning.items];

  it("lets a test change a nested value, add a key and grow an array", () => {
    monsterTuning.skeleton.life = shippedLife + 999;
    Object.assign(monsterTuning.skeleton, { leaked: true });
    (dropTuning.items as string[]).push("leaked");

    expect(monsterTuning.skeleton.life).toBe(shippedLife + 999);
  });

  it("gives the next test the shipped values and no added key", () => {
    expect(monsterTuning.skeleton.life).toBe(shippedLife);
    expect("leaked" in monsterTuning.skeleton).toBe(false);
    expect(dropTuning.items).toEqual(shippedItems);
  });

  it("lets a test replace a whole tuning entry", () => {
    monsterTuning.skeleton = { ...monsterTuning.skeleton, life: 1 };

    expect(monsterTuning.skeleton.life).toBe(1);
  });

  it("gives the next test the shipped entry back", () => {
    expect(monsterTuning.skeleton.life).toBe(shippedLife);
  });
});
