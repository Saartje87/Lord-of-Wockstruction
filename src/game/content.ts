import catacombs from "../../content/areas/catacombs.tmj";
import cozyPlains from "../../content/areas/cozy-plains.tmj";
import crypt from "../../content/areas/crypt.tmj";
import ossuary from "../../content/areas/ossuary.tmj";
import town from "../../content/areas/town.tmj";
import kaykit from "../../content/tilesets/kaykit.tsj";

/** Every shipped Area's raw `.tmj` content, by Area name, painted with KayKit's pieces. */
export const areas: Record<string, unknown> = {
  town,
  "cozy-plains": cozyPlains,
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
  catacombs: "Catacombs",
  crypt: "Crypt",
  ossuary: "Ossuary",
};
