/**
 * A test map made a Combat Area by giving it the `areaLevel` map property.
 * The Area Level is unchecked here, so tests can hand it bad ones.
 */
export function combatArea<Map extends object>(
  map: Map,
  areaLevel: unknown = 1,
): Map & { properties: { name: string; type: string; value: unknown }[] } {
  return {
    ...map,
    properties: [{ name: "areaLevel", type: "int", value: areaLevel }],
  };
}
