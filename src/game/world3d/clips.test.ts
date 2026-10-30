import { describe, expect, it } from "vitest";
import { ATTACK_CONTACT } from "./clips";
import { MINION_LOOKS } from "./minionLook";
import { MONSTER_LOOKS } from "./monsterLook";

// The ranges come from sampling the weapon hand's speed along each KayKit
// clip: the Chop's fast downswing runs 0.51 to 0.60 of its 1.07 s, and the
// blade has landed by 0.57. The Monstrosity's slam stops dead at about 0.55
// of 1.63 s. The crossbow is raised by 0.25 and jerks (the shot) at 0.28-0.31.
describe("attack clip contact fractions", () => {
  it("land on the end of the Chop's downswing for the Hero, Skeleton and Zombie", () => {
    for (const contact of [
      ATTACK_CONTACT,
      MONSTER_LOOKS.skeleton.contact,
      MONSTER_LOOKS.zombie.contact,
      MINION_LOOKS.raisedSkeleton.contact,
    ]) {
      expect(contact).toBeGreaterThanOrEqual(0.55);
      expect(contact).toBeLessThanOrEqual(0.6);
    }
  });

  it("land on the Golem's slam stopping", () => {
    expect(MINION_LOOKS.golem.contact).toBeGreaterThanOrEqual(0.52);
    expect(MINION_LOOKS.golem.contact).toBeLessThanOrEqual(0.57);
  });

  it("release the Skeleton Archer's bolt at the crossbow's jerk", () => {
    expect(MONSTER_LOOKS.skeleton_archer.contact).toBeGreaterThanOrEqual(0.28);
    expect(MONSTER_LOOKS.skeleton_archer.contact).toBeLessThanOrEqual(0.32);
  });
});
