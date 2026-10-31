import { describe, expect, it } from "vitest";
import { damageNumbers, FLOAT_MS, floatAt, floatText } from "./damageNumbers";

describe("damageNumbers", () => {
  it("shows the Hero's hits on the Monsters hit", () => {
    expect(
      damageNumbers([
        {
          type: "HitLanded",
          attacker: "hero",
          target: 1,
          damage: 22,
          damageType: "physical",
        },
        {
          type: "HitLanded",
          attacker: "hero",
          target: 2,
          damage: 27,
          damageType: "physical",
        },
      ]),
    ).toEqual([
      { on: 1, damage: 22, kind: "hit" },
      { on: 2, damage: 27, kind: "hit" },
    ]);
  });

  it("shows a hit that kills as a killing blow", () => {
    expect(
      damageNumbers([
        {
          type: "HitLanded",
          attacker: "hero",
          target: 1,
          damage: 22,
          damageType: "physical",
        },
        {
          type: "HitLanded",
          attacker: "hero",
          target: 2,
          damage: 27,
          damageType: "physical",
        },
        { type: "MonsterDied", id: 2 },
      ]),
    ).toEqual([
      { on: 1, damage: 22, kind: "hit" },
      { on: 2, damage: 27, kind: "kill" },
    ]);
  });

  it("shows damage the Hero takes on the Hero", () => {
    expect(
      damageNumbers([
        { type: "HeroHit", damage: 6, warded: 0, damageType: "physical" },
      ]),
    ).toEqual([{ on: "hero", damage: 6, kind: "taken" }]);
  });

  it("shows nothing on the Hero for a hit their Bone Ward soaked whole", () => {
    expect(
      damageNumbers([
        { type: "HeroHit", damage: 0, warded: 6, damageType: "physical" },
      ]),
    ).toEqual([]);
  });

  it("shows a Miss on the Monster Missed, alongside the hits", () => {
    expect(
      damageNumbers([
        { type: "Missed", target: 1 },
        {
          type: "HitLanded",
          attacker: "hero",
          target: 2,
          damage: 27,
          damageType: "physical",
        },
      ]),
    ).toEqual([
      { on: 1, kind: "miss" },
      { on: 2, damage: 27, kind: "hit" },
    ]);
  });

  it("shows damage a Minion takes, and Misses on it, on that Minion", () => {
    expect(
      damageNumbers([
        { type: "MinionHit", minion: 3, damage: 7, damageType: "physical" },
        { type: "MinionMissed", minion: 3 },
      ]),
    ).toEqual([
      { on: { minion: 3 }, damage: 7, kind: "taken" },
      { on: { minion: 3 }, kind: "miss" },
    ]);
  });

  it("shows No room over the Hero", () => {
    expect(damageNumbers([{ type: "NoRoom" }])).toEqual([
      { on: "hero", kind: "noRoom" },
    ]);
  });

  it("shows a failed cast over the Hero, with why", () => {
    expect(
      damageNumbers([
        { type: "CastFailed", reason: "town" },
        { type: "CastFailed", reason: "mana" },
      ]),
    ).toEqual([
      { on: "hero", kind: "castFailed", reason: "town" },
      { on: "hero", kind: "castFailed", reason: "mana" },
    ]);
  });

  it("shows a Monster's Miss over the Hero", () => {
    expect(damageNumbers([{ type: "Missed", target: "hero" }])).toEqual([
      { on: "hero", kind: "miss" },
    ]);
  });
});

describe("floatText", () => {
  it("is the damage, Miss or No room", () => {
    expect(floatText({ on: 1, damage: 22, kind: "hit" })).toBe("22");
    expect(floatText({ on: 1, kind: "miss" })).toBe("Miss");
    expect(floatText({ on: "hero", kind: "miss" })).toBe("Miss");
    expect(floatText({ on: "hero", kind: "noRoom" })).toBe("No room");
  });

  it("names why a cast failed", () => {
    expect(floatText({ on: "hero", kind: "castFailed", reason: "town" })).toBe(
      "Can't cast in Town",
    );
    expect(floatText({ on: "hero", kind: "castFailed", reason: "mana" })).toBe(
      "Not enough Mana",
    );
    expect(
      floatText({ on: "hero", kind: "castFailed", reason: "corpse" }),
    ).toBe("No Corpse");
  });
});

describe("floatAt", () => {
  it("rises from where it appears, fully opaque", () => {
    expect(floatAt(0, 1)).toEqual({ rise: 0, alpha: 1 });
  });

  it("fades over the second half of its life and then is gone", () => {
    expect(floatAt(FLOAT_MS / 2, 1)?.alpha).toBe(1);
    expect(floatAt(FLOAT_MS * 0.75, 1)?.alpha).toBeCloseTo(0.5);
    expect(floatAt(FLOAT_MS * 0.75, 1)?.rise).toBeGreaterThan(
      floatAt(FLOAT_MS / 2, 1)?.rise ?? Infinity,
    );
    expect(floatAt(FLOAT_MS, 1)).toBeNull();
  });

  it("rises UI Scale times as far at the UI Scale", () => {
    const native = floatAt(FLOAT_MS / 2, 1)?.rise ?? 0;

    expect(native).toBeGreaterThan(0);
    expect(floatAt(FLOAT_MS / 2, 1.5)?.rise).toBeCloseTo(1.5 * native);
    expect(floatAt(FLOAT_MS / 2, 1.5)?.alpha).toBe(1);
  });
});
