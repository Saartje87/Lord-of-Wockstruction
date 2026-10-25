import catacombs from "../../content/areas/catacombs.tmj";
import crypt from "../../content/areas/crypt.tmj";
import town from "../../content/areas/town.tmj";
import dungeon from "../../content/tilesets/dungeon.tsj";
import grassland from "../../content/tilesets/grassland.tsj";

/** Every shipped Area's raw `.tmj` content, by Area name. */
export const areas: Record<string, unknown> = { town, catacombs, crypt };

/** The raw `.tsj` content of the shipped Areas' tilesets, by file name. */
export const tilesets: Record<string, unknown> = { grassland, dungeon };

/** Each shipped Area's display name, shown in a banner on arriving there. */
export const areaDisplayNames: Record<string, string> = {
  town: "Town",
  catacombs: "Catacombs",
  crypt: "Crypt",
};
