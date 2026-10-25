import { describe, expect, it } from "vitest";
import { menuChoiceAt, pauseMenuLayout } from "./pauseMenu";
import type { Rect } from "./rect";

const screen = { width: 1280, height: 720 };

const centre = (rect: Rect) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

describe("the pause menu's buttons", () => {
  it("offer a New Hero, in the middle of the screen", () => {
    const { buttons } = pauseMenuLayout(screen, false);

    expect(buttons.map((button) => button.choice)).toEqual(["newHero"]);
    expect(centre(buttons[0].rect).x).toBe(640);
  });

  it("offer Yes and No while asking to confirm", () => {
    const { buttons } = pauseMenuLayout(screen, true);

    expect(buttons.map((button) => button.choice)).toEqual([
      "confirm",
      "goBack",
    ]);
  });

  it("are found under a click", () => {
    const [newHero] = pauseMenuLayout(screen, false).buttons;
    const [yes, no] = pauseMenuLayout(screen, true).buttons;

    expect(menuChoiceAt(screen, centre(newHero.rect), false)).toBe("newHero");
    expect(menuChoiceAt(screen, centre(yes.rect), true)).toBe("confirm");
    expect(menuChoiceAt(screen, centre(no.rect), true)).toBe("goBack");
  });

  it("find nothing off them, nor where a hidden one would be", () => {
    const [newHero] = pauseMenuLayout(screen, false).buttons;
    const [yes] = pauseMenuLayout(screen, true).buttons;

    expect(menuChoiceAt(screen, { x: 10, y: 10 }, false)).toBeNull();
    expect(menuChoiceAt(screen, centre(yes.rect), false)).not.toBe("confirm");
    expect(menuChoiceAt(screen, centre(newHero.rect), true)).not.toBe(
      "newHero",
    );
  });
});
