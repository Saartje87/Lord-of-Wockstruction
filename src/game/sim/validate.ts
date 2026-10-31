import { ELEMENTS, type Resistances } from "../tuning/damage";
import { QUEST_IDS, questTuning } from "../tuning/quests";
import { type Area, type Exit, isWalkable, isWater, TOWN } from "./area";
import { canReach } from "./path";
import { tileOf } from "./vec";

/**
 * Checks that Areas fit together, throwing with a message naming the Area
 * and the problem: each needs a `start` Entry, each Combat Area an Area Level
 * and an Act and Town no Level, no Entry on Water, Exits must lead to an
 * Entry that exists and be reachable from `start`, spawns must be on tiles
 * the Monsters can stand on, and only Town may have a Town Portal spot, which
 * must be reachable from `start` too, as must a Waypoint and each Bone Altar.
 * A Town without one opens no Town Portals: the content tests check the
 * shipped Town has it.
 */
export function validateAreas(areas: Record<string, Area>) {
  for (const area of Object.values(areas)) {
    const start = area.entries.start;
    if (!start) throw new Error(`Area "${area.name}" has no "start" Entry`);

    for (const [name, entry] of Object.entries(area.entries)) {
      if (!isWater(area, entry)) continue;
      const { x, y } = tileOf(entry);
      throw new Error(
        `Area "${area.name}" has Entry "${name}" on Water, tile (${x}, ${y})`,
      );
    }

    if (area.name === TOWN && area.areaLevel !== null) {
      throw new Error(`Area "${area.name}" has an Area Level; Town has none`);
    }
    if (area.name !== TOWN && area.areaLevel === null) {
      throw new Error(
        `Area "${area.name}" is a Combat Area without an Area Level`,
      );
    }

    if (area.name !== TOWN && area.act === null) {
      throw new Error(`Area "${area.name}" is a Combat Area without an Act`);
    }

    if (area.townPortal && area.name !== TOWN) {
      throw new Error(
        `Area "${area.name}" has a Town Portal spot; only Town has one`,
      );
    }
    if (
      area.townPortal &&
      !(
        isWalkable(area, area.townPortal) &&
        canReach(area, start, area.townPortal)
      )
    ) {
      throw new Error(
        `Area "${area.name}" has its Town Portal spot where it can't be reached from "start"`,
      );
    }

    if (
      area.waypoint &&
      !(isWalkable(area, area.waypoint) && canReach(area, start, area.waypoint))
    ) {
      throw new Error(
        `Area "${area.name}" has its Waypoint where it can't be reached from "start"`,
      );
    }

    for (const altar of area.boneAltars) {
      if (!(isWalkable(area, altar) && canReach(area, start, altar))) {
        const { x, y } = tileOf(altar);
        throw new Error(
          `Area "${area.name}" has a Bone Altar on tile (${x}, ${y}) where it can't be reached from "start"`,
        );
      }
    }

    for (const spawn of area.spawns) {
      if (isWalkable(area, spawn.pos)) continue;
      const { x, y } = tileOf(spawn.pos);
      throw new Error(
        `Area "${area.name}" has a spawn on blocked tile (${x}, ${y})`,
      );
    }

    for (const unique of area.uniques) {
      if (isWalkable(area, unique.pos)) continue;
      const { x, y } = tileOf(unique.pos);
      throw new Error(
        `Area "${area.name}" has Unique Monster "${unique.name}" on blocked tile (${x}, ${y})`,
      );
    }

    for (const exit of area.exits) {
      const target = areas[exit.area];
      if (!target) {
        throw new Error(
          `Area "${area.name}" has an Exit to unknown Area "${exit.area}"`,
        );
      }
      if (!target.entries[exit.entry]) {
        throw new Error(
          `Area "${area.name}" has an Exit to missing Entry "${exit.entry}" in Area "${exit.area}"`,
        );
      }
      if (!canReachExit(area, exit)) {
        throw new Error(
          `Area "${area.name}" has an Exit to "${exit.area}" that can't be reached from "start"`,
        );
      }
    }
  }
}

/**
 * Checks that each Act is whole, throwing with a message naming it: exactly
 * one Act Boss spawn in its Areas and a Waypoint in its Town, a Waypoint in
 * every Area on the Main Path and none in a Side Area, and every Waypoint's
 * Area in an Act. Apart from `validateAreas` because small test
 * maps make Acts that are not whole; `createShippedWorld` runs it on the
 * shipped Areas.
 */
export function validateActs(areas: Record<string, Area>) {
  const acts = new Set<number>();
  for (const area of Object.values(areas)) {
    if (area.act !== null) acts.add(area.act);
    else if (area.waypoint) {
      throw new Error(
        `Area "${area.name}" has a Waypoint but belongs to no Act`,
      );
    }
  }
  for (const act of acts) {
    const inAct = Object.values(areas).filter((area) => area.act === act);
    const bosses = inAct.filter((area) => area.actBoss).length;
    if (bosses !== 1) {
      throw new Error(`Act ${act} has ${bosses} Act Boss spawns, not one`);
    }
    const town = inAct.find((area) => area.name === TOWN);
    if (!town?.waypoint) {
      throw new Error(`Act ${act} has no Waypoint in its Town`);
    }
    for (const area of inAct) {
      // A Side Area is a Combat Area off the Main Path; the Town has no such
      // position to hold a Waypoint to, and has its own check above.
      if (area.name === TOWN) continue;
      if (area.mainPath !== null && !area.waypoint) {
        throw new Error(
          `Area "${area.name}" is on the Main Path but has no Waypoint`,
        );
      }
      if (area.mainPath === null && area.waypoint) {
        throw new Error(
          `Area "${area.name}" is a Side Area but has a Waypoint`,
        );
      }
    }
  }
}

/**
 * Checks that every Quest's objects exist in the Areas it names, throwing
 * with a message naming the Quest: its giver in its Act's Town, and its
 * Bone Altars, Unique Monster, NPC to talk to or Act Boss where its trigger
 * asks. Run on the shipped Areas by `createShippedWorld`.
 */
export function validateQuests(areas: Record<string, Area>) {
  for (const id of QUEST_IDS) {
    const { name, act, giver, trigger } = questTuning[id];
    const fail = (what: string): never => {
      throw new Error(`Quest "${name}" ${what}`);
    };
    const town = Object.values(areas).find(
      (area) => area.name === TOWN && area.act === act,
    );
    if (!town?.npcs.some((npc) => npc.name === giver)) {
      fail(`has no giver "${giver}" in the Town of Act ${act}`);
    }
    switch (trigger.type) {
      case "boneAltars": {
        const altars = areas[trigger.area]?.boneAltars.length ?? 0;
        if (altars < trigger.count) {
          fail(
            `asks for ${trigger.count} Bone Altars in "${trigger.area}", which has ${altars}`,
          );
        }
        break;
      }
      case "uniqueKilled":
        if (!areas[trigger.area]?.uniques.length) {
          fail(`needs a Unique Monster in "${trigger.area}", which has none`);
        }
        break;
      case "talk":
        if (
          !Object.values(areas).some((area) =>
            area.npcs.some((npc) => npc.name === trigger.npc),
          )
        ) {
          fail(`needs an NPC called "${trigger.npc}", who is nowhere`);
        }
        break;
      case "actBossKilled":
        if (
          !Object.values(areas).some(
            (area) => area.act === trigger.act && area.actBoss,
          )
        ) {
          fail(`needs an Act Boss in Act ${trigger.act}`);
        }
        break;
    }
  }
}

/**
 * Checks that no Resistance in `tuning`, Monster types' or Minion kinds',
 * reaches 100 (no Monster is immune), throwing with a message naming the
 * type and Element. Run on the shipped tuning by `createWorld`.
 */
export function validateResistances(
  tuning: Record<string, { resistances?: Resistances }>,
) {
  for (const [type, { resistances }] of Object.entries(tuning)) {
    for (const element of ELEMENTS) {
      const resistance = resistances?.[element] ?? 0;
      if (!(resistance < 100)) {
        throw new Error(
          `"${type}" has ${resistance}% ${element} Resistance; it must be below 100`,
        );
      }
    }
  }
}

/** Whether any tile of an Exit's zone can be walked to from `start`. */
function canReachExit(area: Area, exit: Exit): boolean {
  const start = area.entries.start;
  for (let y = Math.floor(exit.y); y < exit.y + exit.height; y++) {
    for (let x = Math.floor(exit.x); x < exit.x + exit.width; x++) {
      const tile = { x: x + 0.5, y: y + 0.5 };
      if (isWalkable(area, tile) && canReach(area, start, tile)) return true;
    }
  }
  return false;
}
