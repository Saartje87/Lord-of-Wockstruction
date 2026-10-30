import { describe, expect, it } from "vitest";
import { encodeSave, parseSave, SAVE_VERSION } from "./save";
import { emptyBelt } from "./sim/belt";
import type { Belongings } from "./sim/inventory";
import { FRESH_PROGRESS } from "./sim/world";

const BELONGINGS: Belongings = {
  inventory: [],
  equipment: {},
  belt: emptyBelt(),
};

/** Saved text of a fresh Hero holding `gold`, as parsed JSON to tamper with. */
function textWith(gold: number): Record<string, unknown> {
  return JSON.parse(
    encodeSave({
      progress: { ...FRESH_PROGRESS, gold },
      belongings: BELONGINGS,
    }),
  );
}

describe("the Save of Gold", () => {
  it("is version 12", () => {
    expect(SAVE_VERSION).toBe(12);
  });

  it("round-trips Gold", () => {
    const loaded = parseSave(JSON.stringify(textWith(1234)));

    expect(loaded?.progress.gold).toBe(1234);
  });

  it("round-trips none", () => {
    expect(parseSave(JSON.stringify(textWith(0)))?.progress.gold).toBe(0);
  });

  it("loads version 11 text, which has no Gold, with 0", () => {
    const { gold, ...text } = textWith(0);

    const loaded = parseSave(JSON.stringify({ ...text, version: 11 }));

    expect(loaded?.progress.gold).toBe(0);
  });

  it("gives no Save for version 11 text that holds Gold", () => {
    const text = { ...textWith(5), version: 11 };

    expect(parseSave(JSON.stringify(text))).toBeNull();
  });

  it.each([
    ["negative", -1],
    ["fractional", 2.5],
    ["not a number", "12"],
    ["missing", undefined],
    ["null", null],
  ])("gives no Save for Gold that is %s", (_, gold) => {
    const text = { ...textWith(0), gold };

    expect(parseSave(JSON.stringify(text))).toBeNull();
  });
});
