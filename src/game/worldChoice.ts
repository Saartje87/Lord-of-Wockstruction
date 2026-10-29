import type { SaveStorage } from "./save";

/** Which World drawing is used: the 2D World or the 3D World. */
export type WorldChoice = "2d" | "3d";

/** Where the choice is kept, apart from the Save's key. */
const WORLD_CHOICE_KEY = "wiablo.world";

/** The stored choice of World, the 2D World where there is none. */
export function readWorldChoice(storage: SaveStorage): WorldChoice {
  return storage.get(WORLD_CHOICE_KEY) === "3d" ? "3d" : "2d";
}

/** Stores the choice of World on this device, apart from the Save. */
export function writeWorldChoice(storage: SaveStorage, choice: WorldChoice) {
  storage.set(WORLD_CHOICE_KEY, choice);
}

/**
 * The World a game starts with: the 3D World when the query asks for it
 * (`?renderer=3d`, which is never stored), otherwise the `stored` choice.
 */
export function startingWorld(
  fromQuery: WorldChoice,
  stored: WorldChoice,
): WorldChoice {
  return fromQuery === "3d" ? "3d" : stored;
}
