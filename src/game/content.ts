import cave from "../../content/areas/cave.tmj";
import town from "../../content/areas/town.tmj";
import dungeon from "../../content/tilesets/dungeon.tsj";
import grassland from "../../content/tilesets/grassland.tsj";

/** Every shipped Area's raw `.tmj` content, by Area name. */
export const areas: Record<string, unknown> = { town, cave };

/** The raw `.tsj` content of the shipped Areas' tilesets, by file name. */
export const tilesets: Record<string, unknown> = { grassland, dungeon };
