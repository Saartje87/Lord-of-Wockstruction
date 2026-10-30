import catacombs from "../../content/areas/catacombs.tmj";
import cozyPlains from "../../content/areas/cozy-plains.tmj";
import crypt from "../../content/areas/crypt.tmj";
import oldMill from "../../content/areas/old-mill.tmj";
import ossuary from "../../content/areas/ossuary.tmj";
import soggyBog from "../../content/areas/soggy-bog.tmj";
import spa from "../../content/areas/spa.tmj";
import town from "../../content/areas/town.tmj";
import wockyard from "../../content/areas/wockyard.tmj";
import kaykit from "../../content/tilesets/kaykit.tsj";
import { validateActs, validateQuests } from "./sim/validate";
import { createWorld, type World } from "./sim/world";

/** Every shipped Area's raw `.tmj` content, by Area name, painted with KayKit's pieces. */
export const areas: Record<string, unknown> = {
  town,
  "cozy-plains": cozyPlains,
  "soggy-bog": soggyBog,
  wockyard,
  spa,
  "old-mill": oldMill,
  catacombs,
  crypt,
  ossuary,
};

/** The raw `.tsj` content of the shipped Areas' tilesets, by file name. */
export const tilesets: Record<string, unknown> = {
  kaykit,
};

/** Each shipped Area's display name, shown in the Area Banner on arriving there. */
export const areaDisplayNames: Record<string, string> = {
  town: "Wockville",
  "cozy-plains": "Cozy Plains",
  "soggy-bog": "Soggy Bog",
  wockyard: "Wockyard",
  spa: "Spa",
  "old-mill": "Old Mill",
  catacombs: "Catacombs",
  crypt: "Crypt",
  ossuary: "Ossuary",
};

/**
 * A World made from the shipped Areas (or `content`), after checking that
 * their Acts and Quests are whole (`validateActs`, `validateQuests`), which
 * `createWorld` leaves to its callers because small test maps make Acts that
 * are not whole. Throws, naming the Act or Quest, when they are not.
 */
export function createShippedWorld(
  options: Omit<Parameters<typeof createWorld>[0], "areas" | "tilesets">,
  content: {
    areas: Record<string, unknown>;
    tilesets: Record<string, unknown>;
  } = {
    areas,
    tilesets,
  },
): World {
  const world = createWorld({ ...options, ...content });
  validateActs(world.areas);
  validateQuests(world.areas);
  return world;
}
