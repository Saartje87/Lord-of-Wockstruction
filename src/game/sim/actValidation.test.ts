import { describe, expect, it } from "vitest";
import { type Area, loadArea } from "./area";
import { combatArea } from "./testAreas";
import { validateActs, validateQuests } from "./validate";

/** A point object in the middle of tile (x, y). */
function point(type: string, name: string, x: number, y: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
}

function map(objects: object[], properties: object[] = []) {
  return {
    orientation: "orthogonal",
    width: 10,
    height: 3,
    tilewidth: 32,
    tileheight: 32,
    properties,
    layers: [
      {
        type: "tilelayer",
        name: "floor",
        width: 10,
        height: 3,
        data: new Array(30).fill(1),
      },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

const boss = {
  ...point("actBoss", "Grave Wockington", 5, 1),
  properties: [{ name: "monster", type: "string", value: "grave_wockington" }],
};
const start = point("entry", "start", 1, 1);
const act = { name: "act", type: "int", value: 1 };

/** The `mainPath` property for Main Path position `position`. */
const mainPath = (position: number) => ({
  name: "mainPath",
  type: "int",
  value: position,
});

/** A Town of Act `1`, first on the Main Path, with `objects` besides its start. */
const townWith = (...objects: object[]) =>
  loadArea("town", map([start, ...objects], [act, mainPath(0)]));
const waypoint = point("waypoint", "waypoint", 3, 1);
const ossuary = (...objects: object[]) =>
  loadArea("ossuary", combatArea(map([start, ...objects])));

/** A Combat Area of Act `1` at Main Path position `position`. */
const onMainPath = (name: string, position: number, ...objects: object[]) => {
  const plain = combatArea(map([start, ...objects]));
  return loadArea(name, {
    ...plain,
    properties: [...plain.properties, mainPath(position)],
  });
};

function areas(...list: Area[]): Record<string, Area> {
  return Object.fromEntries(list.map((area) => [area.name, area]));
}

describe("validateActs", () => {
  it("accepts an Act with one Act Boss spawn and a Waypoint in its Town", () => {
    expect(() =>
      validateActs(areas(townWith(waypoint), ossuary(boss))),
    ).not.toThrow();
  });

  it("accepts a Main Path with a Waypoint in every Area and a Side Area with none", () => {
    expect(() =>
      validateActs(
        areas(
          townWith(waypoint),
          onMainPath("plains", 1, waypoint),
          onMainPath("crypt", 2, waypoint, boss),
          ossuary(),
        ),
      ),
    ).not.toThrow();
  });

  it("does not call a Town without a Main Path position a Side Area", () => {
    const town = loadArea("town", map([start, waypoint], [act]));

    expect(() => validateActs(areas(town, ossuary(boss)))).not.toThrow();
  });

  it("rejects a Main Path Area without a Waypoint", () => {
    expect(() =>
      validateActs(
        areas(townWith(waypoint), onMainPath("plains", 1), ossuary(boss)),
      ),
    ).toThrow(/Area "plains" is on the Main Path but has no Waypoint/);
  });

  it("rejects a Side Area with a Waypoint", () => {
    expect(() =>
      validateActs(areas(townWith(waypoint), ossuary(boss, waypoint))),
    ).toThrow(/Area "ossuary" is a Side Area but has a Waypoint/);
  });

  it("rejects an Act without an Act Boss spawn", () => {
    expect(() => validateActs(areas(townWith(waypoint), ossuary()))).toThrow(
      /Act 1 has 0 Act Boss spawns/,
    );
  });

  it("rejects an Act with two Act Boss spawns in different Areas", () => {
    const crypt = loadArea("crypt", combatArea(map([start, boss])));

    expect(() =>
      validateActs(areas(townWith(waypoint), ossuary(boss), crypt)),
    ).toThrow(/Act 1 has 2 Act Boss spawns/);
  });

  it("rejects an Act without a Waypoint in its Town", () => {
    expect(() => validateActs(areas(townWith(), ossuary(boss)))).toThrow(
      /Act 1 has no Waypoint in its Town/,
    );
  });

  it("rejects a Waypoint in an Area that belongs to no Act", () => {
    const stray = loadArea("stray", map([start, waypoint], []));

    expect(() =>
      validateActs(areas(townWith(waypoint), ossuary(boss), stray)),
    ).toThrow(/Area "stray" has a Waypoint but belongs to no Act/);
  });

  it("does not take a Waypoint in a Combat Area for one in the Town", () => {
    expect(() =>
      validateActs(areas(townWith(), ossuary(boss, waypoint))),
    ).toThrow(/no Waypoint in its Town/);
  });
});

describe("validateQuests", () => {
  const npc = (name: string) => point("npc", name, 2, 1);
  const altar = (x: number) => point("boneAltar", "", x, 1);
  const unique = {
    ...point("uniqueMonster", "Sir Soaks-a-Lot", 4, 1),
    properties: [{ name: "monster", type: "string", value: "zombie" }],
  };
  const named = (name: string, ...objects: object[]) =>
    loadArea(name, combatArea(map([start, ...objects])));

  /** Areas holding everything the shipped Quests ask for. */
  const whole = () => ({
    town: townWith(npc("Elder"), npc("Trader"), npc("Smith")),
    "soggy-bog": named("soggy-bog", altar(3), altar(4), altar(5)),
    spa: named("spa", unique),
    "old-mill": named("old-mill", npc("Wanderer")),
    ossuary: ossuary(boss),
  });

  it("accepts Areas holding every Quest's objects", () => {
    expect(() => validateQuests(whole())).not.toThrow();
  });

  it("rejects a giver missing from the Town", () => {
    const { town, ...rest } = whole();
    const bare = townWith(npc("Elder"), npc("Smith"));

    expect(() => validateQuests({ ...rest, town: bare })).toThrow(
      /"Bog Off" has no giver "Trader"/,
    );
    expect(town).toBeDefined();
  });

  it("rejects fewer Bone Altars than the Quest asks to destroy", () => {
    expect(() =>
      validateQuests({
        ...whole(),
        "soggy-bog": named("soggy-bog", altar(3), altar(4)),
      }),
    ).toThrow(/"Bog Off" asks for 3 Bone Altars in "soggy-bog", which has 2/);
  });

  it("rejects an Area with no Unique Monster for its Quest", () => {
    expect(() => validateQuests({ ...whole(), spa: named("spa") })).toThrow(
      /"Spa Day" needs a Unique Monster in "spa"/,
    );
  });

  it("rejects a Wanderer who is nowhere", () => {
    expect(() =>
      validateQuests({ ...whole(), "old-mill": named("old-mill") }),
    ).toThrow(/"Lost Wanderer" needs an NPC called "Wanderer"/);
  });

  it("rejects an Act without the Act Boss the Quest asks to kill", () => {
    expect(() => validateQuests({ ...whole(), ossuary: ossuary() })).toThrow(
      /"Wock the Dead" needs an Act Boss in Act 1/,
    );
  });
});
