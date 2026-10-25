import { describe, expect, it } from "vitest";
import { damageNumbers, FLOAT_MS, floatAt, floatText } from "./damageNumbers";

describe("damageNumbers", () => {
  it("shows the Hero's hits on the Monsters hit", () => {
    expect(
      damageNumbers([
        { type: "HitLanded", attacker: "hero", target: 1, damage: 22 },
        { type: "HitLanded", attacker: "hero", target: 2, damage: 27 },
      ]),
    ).toEqual([
      { on: 1, damage: 22, kind: "hit" },
      { on: 2, damage: 27, kind: "hit" },
    ]);
  });

  it("shows a hit that kills as a killing blow", () => {
    expect(
      damageNumbers([
        { type: "HitLanded", attacker: "hero", target: 1, damage: 22 },
        { type: "HitLanded", attacker: "hero", target: 2, damage: 27 },
        { type: "MonsterDied", id: 2 },
      ]),
    ).toEqual([
      { on: 1, damage: 22, kind: "hit" },
      { on: 2, damage: 27, kind: "kill" },
    ]);
  });

  it("shows damage the Hero takes on the Hero", () => {
    expect(damageNumbers([{ type: "HeroHit", damage: 6 }])).toEqual([
      { on: "hero", damage: 6, kind: "taken" },
    ]);
  });

  it("shows a Miss on the Monster Missed, alongside the hits", () => {
    expect(
      damageNumbers([
        { type: "Missed", target: 1 },
        { type: "HitLanded", attacker: "hero", target: 2, damage: 27 },
      ]),
    ).toEqual([
      { on: 1, kind: "miss" },
      { on: 2, damage: 27, kind: "hit" },
    ]);
  });

  it("shows No room over the Hero", () => {
    expect(damageNumbers([{ type: "NoRoom" }])).toEqual([
      { on: "hero", kind: "noRoom" },
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
});

describe("floatAt", () => {
  it("rises from where it appears, fully opaque", () => {
    expect(floatAt(0)).toEqual({ rise: 0, alpha: 1 });
  });

  it("fades over the second half of its life and then is gone", () => {
    expect(floatAt(FLOAT_MS / 2)?.alpha).toBe(1);
    expect(floatAt(FLOAT_MS * 0.75)?.alpha).toBeCloseTo(0.5);
    expect(floatAt(FLOAT_MS * 0.75)?.rise).toBeGreaterThan(
      floatAt(FLOAT_MS / 2)?.rise ?? Infinity,
    );
    expect(floatAt(FLOAT_MS)).toBeNull();
  });
});
