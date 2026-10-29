import catacombs from "../../content/areas/catacombs.tmj";
import crypt from "../../content/areas/crypt.tmj";
import flareCatacombs from "../../content/areas/flare/catacombs.tmj";
import flareCrypt from "../../content/areas/flare/crypt.tmj";
import flareOssuary from "../../content/areas/flare/ossuary.tmj";
import flareTown from "../../content/areas/flare/town.tmj";
import ossuary from "../../content/areas/ossuary.tmj";
import town from "../../content/areas/town.tmj";
import dungeon from "../../content/tilesets/dungeon.tsj";
import grassland from "../../content/tilesets/grassland.tsj";
import kaykit from "../../content/tilesets/kaykit.tsj";

/** Every shipped Area's raw `.tmj` content, by Area name: painted with KayKit's pieces. */
export const areas: Record<string, unknown> = {
  town,
  catacombs,
  crypt,
  ossuary,
};

/**
 * The Flare version of each shipped Area, by Area name. The 2D World still
 * draws these until the 3D World takes over.
 */
export const flareAreas: Record<string, unknown> = {
  town: flareTown,
  catacombs: flareCatacombs,
  crypt: flareCrypt,
  ossuary: flareOssuary,
};

/** The raw `.tsj` content of the shipped Areas' tilesets, by file name. */
export const tilesets: Record<string, unknown> = {
  grassland,
  dungeon,
  kaykit,
};

/** Each shipped Area's display name, shown in the Area Banner on arriving there. */
export const areaDisplayNames: Record<string, string> = {
  town: "Town",
  catacombs: "Catacombs",
  crypt: "Crypt",
  ossuary: "Ossuary",
};
