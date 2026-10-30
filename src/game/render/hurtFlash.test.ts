import { describe, expect, it } from "vitest";
import { HURT_FLASH_MS, hurtFlashLeft } from "./hurtFlash";

describe("hurtFlashLeft", () => {
  it("is whole when the flash begins and fades to nothing over its length", () => {
    expect(hurtFlashLeft(0)).toBe(1);
    expect(hurtFlashLeft(HURT_FLASH_MS / 2)).toBeCloseTo(0.5);
    expect(hurtFlashLeft(HURT_FLASH_MS)).toBe(0);
    expect(hurtFlashLeft(HURT_FLASH_MS * 3)).toBe(0);
  });
});
