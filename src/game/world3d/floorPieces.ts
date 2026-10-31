import type { Area } from "../sim/area";
import type { FloorPieces } from "./floor";
import { lookOf, outdoorLookOf, toonShade } from "./toon";

/**
 * Shades the loaded floor `scenes` and returns which set of them an Area is
 * drawn with: its pieces in their indoor look (dusk-lit Wockville, the
 * dungeon), or under the open sky for an outdoor Area. A piece that looks the
 * same in both is shared; one that differs has a copy of its own.
 */
export function floorPiecesOf(
  scenes: FloorPieces,
): (area: Area) => FloorPieces {
  const indoor: FloorPieces = {};
  const outdoor: FloorPieces = {};
  for (const [name, scene] of Object.entries(scenes)) {
    const day = outdoorLookOf(name);
    const differs = day !== lookOf(name);
    const open = differs ? scene.clone() : scene;
    toonShade(scene, lookOf(name));
    if (differs) toonShade(open, day);
    indoor[name] = scene;
    outdoor[name] = open;
  }
  return (area) => (area.outdoors ? outdoor : indoor);
}
