import { afterEach, describe, expect, it } from "vitest";
import { smithTuning } from "../tuning/smith";
import { equipmentOf, FRESH_BELONGINGS, inventoryOf } from "./inventory";
import {
  attributesOf,
  createWorld,
  FRESH_PROGRESS,
  heroDefense,
  type Order,
  type Progress,
  type SimEvent,
  SKILLS,
  skillRaiseOf,
  step,
  type World,
} from "./world";

function point(type: string, name: string, x: number, y: number) {
  return { name, type, point: true, x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
}

// An open Town with the Smith beside the Hero's start, and the Elder far off.
const town = {
  orientation: "orthogonal",
  width: 20,
  height: 3,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    {
      type: "tilelayer",
      name: "floor",
      width: 20,
      height: 3,
      data: new Array(60).fill(1),
    },
    {
      type: "objectgroup",
      name: "objects",
      objects: [
        point("entry", "start", 1, 1),
        point("npc", "Smith", 2, 1),
        point("npc", "Elder", 18, 1),
      ],
    },
  ],
};

function progressWith(smithService: Progress["smithService"]): Progress {
  const spa = smithService === "locked" ? "given" : "done";
  return {
    ...FRESH_PROGRESS,
    smithService,
    quests: { ...FRESH_PROGRESS.quests, "spa-day": { state: spa, count: 1 } },
  };
}

function newWorld(
  smithService: Progress["smithService"] = "unlocked",
  inventory: {
    type:
      | "axe"
      | "chainMail"
      | "ring"
      | "lifePotion"
      | "ironHelm"
      | "leatherGloves"
      | "leatherBoots"
      | "buckler"
      | "boneWand";
    cell: { column: number; row: number };
  }[] = [],
): World {
  return createWorld({
    areas: { town },
    seed: 3,
    progress: progressWith(smithService),
    belongings: {
      ...FRESH_BELONGINGS,
      inventory,
      equipment: {
        weapon: { type: "shortSword" },
        armour: { type: "chainMail" },
      },
    },
  });
}

function smith(world: World, orders: Order[]): SimEvent[] {
  return step(world, orders);
}

function bonusesOf(world: World) {
  return [
    ...inventoryOf(world).map(({ item }) => item),
    ...Object.values(equipmentOf(world)),
  ].flatMap((item) => (item?.smithBonus ? [item] : []));
}

const pools = {
  wand: [...smithTuning.wand],
  weapon: [...smithTuning.weapon],
  armour: [...smithTuning.armour],
};

/** Replaces the Smith's `pool` with `only`, until the test is over. */
function tunePool(pool: keyof typeof pools, only: (typeof pools)["wand"]) {
  smithTuning[pool].splice(0, smithTuning[pool].length, ...only);
}

describe("The Smith bonus", () => {
  afterEach(() => {
    for (const [name, pool] of Object.entries(pools)) {
      const live = smithTuning[name as keyof typeof pools];
      live.splice(0, live.length, ...pool);
    }
  });

  it("gives a Weapon one bonus from the Weapon pool", () => {
    const world = newWorld();
    const sword = equipmentOf(world).weapon;
    if (!sword) throw new Error("no sword");

    const events = smith(world, [{ type: "SmithBonus", item: sword.id }]);

    const given = equipmentOf(world).weapon?.smithBonus;
    expect(given).toBeDefined();
    const pool = smithTuning.weapon.find(
      (entry) => entry.bonus === given?.bonus,
    );
    expect(pool).toBeDefined();
    expect(given?.amount).toBeGreaterThanOrEqual(pool?.amount[0] ?? Infinity);
    expect(given?.amount).toBeLessThanOrEqual(pool?.amount[1] ?? -Infinity);
    expect(events).toContainEqual({
      type: "SmithBonusGiven",
      item: sword.id,
      bonus: given,
    });
    expect(world.hero.progress.smithService).toBe("used");
    expect(bonusesOf(world)).toHaveLength(1);
  });

  it("gives an Armour in the Inventory a bonus from the Armour pool", () => {
    const world = newWorld("unlocked", [
      { type: "chainMail", cell: { column: 0, row: 0 } },
    ]);
    const [{ item }] = inventoryOf(world);

    smith(world, [{ type: "SmithBonus", item: item.id }]);

    const given = inventoryOf(world)[0].item.smithBonus;
    expect(smithTuning.armour.map((entry) => entry.bonus)).toContain(
      given?.bonus,
    );
  });

  it.each([
    "ironHelm",
    "leatherGloves",
    "leatherBoots",
    "buckler",
  ] as const)("gives a %s a bonus from the Armour pool", (type) => {
    const world = newWorld("unlocked", [{ type, cell: { column: 0, row: 0 } }]);
    smith(world, [{ type: "SmithBonus", item: inventoryOf(world)[0].item.id }]);
    expect(smithTuning.armour.map((entry) => entry.bonus)).toContain(
      inventoryOf(world)[0].item.smithBonus?.bonus,
    );
  });

  it("gives a Wand a bonus from the Wand pool", () => {
    const wandBonuses = smithTuning.wand.map((entry) => entry.bonus);
    expect(wandBonuses).toEqual(
      expect.arrayContaining(["mana", "energy", "skillLevel"]),
    );
    for (let seed = 1; seed <= 20; seed++) {
      const world = createWorld({
        areas: { town },
        seed,
        progress: progressWith("unlocked"),
        belongings: {
          ...FRESH_BELONGINGS,
          inventory: [{ type: "boneWand", cell: { column: 0, row: 0 } }],
          equipment: { weapon: { type: "shortSword" } },
        },
      });
      smith(world, [
        { type: "SmithBonus", item: inventoryOf(world)[0].item.id },
      ]);
      const given = inventoryOf(world)[0].item.smithBonus;
      expect(wandBonuses).toContain(given?.bonus);
      if (given?.bonus === "skillLevel") {
        expect(SKILLS).toContain(given.skill);
      }
    }
  });

  it("raises the Skill Level of a random Skill for a Wand while Equipped", () => {
    tunePool("wand", [
      {
        bonus: "skillLevel",
        amount: [2, 2],
      },
    ]);
    const world = newWorld("unlocked", [
      { type: "boneWand", cell: { column: 0, row: 0 } },
    ]);
    const wand = inventoryOf(world)[0].item;
    smith(world, [{ type: "SmithBonus", item: wand.id }]);
    const skill = inventoryOf(world)[0].item.smithBonus?.skill;
    expect(skill).toBeDefined();
    if (!skill) return;
    expect(skillRaiseOf(world, skill)).toBe(0);
    world.hero.equipment.offHand = inventoryOf(world)[0].item;
    world.hero.inventory = [];
    expect(skillRaiseOf(world, skill)).toBe(2);
  });

  it("changes the Hero while the Item is Equipped", () => {
    // Make every roll a Strength bonus.
    tunePool("weapon", [
      {
        bonus: "strength",
        amount: [5, 5],
      },
    ]);
    const world = newWorld();
    const before = attributesOf(world).strength;
    const sword = equipmentOf(world).weapon;
    smith(world, [{ type: "SmithBonus", item: sword?.id ?? -1 }]);
    expect(attributesOf(world).strength).toBe(before + 5);
  });

  it("adds Defense for a Defense bonus on Armour", () => {
    tunePool("armour", [
      {
        bonus: "defense",
        amount: [7, 7],
      },
    ]);
    const world = newWorld();
    const before = heroDefense(world);
    const mail = equipmentOf(world).armour;
    smith(world, [{ type: "SmithBonus", item: mail?.id ?? -1 }]);
    expect(heroDefense(world)).toBe(before + 7);
  });

  it("works only once", () => {
    const world = newWorld("unlocked", [
      { type: "axe", cell: { column: 0, row: 0 } },
    ]);
    const sword = equipmentOf(world).weapon;
    smith(world, [{ type: "SmithBonus", item: sword?.id ?? -1 }]);

    const events = smith(world, [
      { type: "SmithBonus", item: inventoryOf(world)[0].item.id },
    ]);

    expect(events).toEqual([]);
    expect(bonusesOf(world)).toHaveLength(1);
  });

  it("isn't available while locked", () => {
    const world = newWorld("locked");
    const sword = equipmentOf(world).weapon;

    const events = smith(world, [
      { type: "SmithBonus", item: sword?.id ?? -1 },
    ]);

    expect(events).toEqual([]);
    expect(bonusesOf(world)).toHaveLength(0);
    expect(world.hero.progress.smithService).toBe("locked");
  });

  it("can't pick an Item that isn't a Weapon or Armour, and keeps the service", () => {
    const world = newWorld("unlocked", [
      { type: "ring", cell: { column: 0, row: 0 } },
      { type: "lifePotion", cell: { column: 2, row: 0 } },
    ]);

    for (const { item } of inventoryOf(world)) {
      smith(world, [{ type: "SmithBonus", item: item.id }]);
    }
    smith(world, [{ type: "SmithBonus", item: 9999 }]);

    expect(bonusesOf(world)).toHaveLength(0);
    expect(world.hero.progress.smithService).toBe("unlocked");
  });

  it("can't pick an Item that already has a Smith bonus", () => {
    const world = newWorld();
    const sword = equipmentOf(world).weapon;
    smith(world, [{ type: "SmithBonus", item: sword?.id ?? -1 }]);
    world.hero.progress.smithService = "unlocked";
    const bonus = equipmentOf(world).weapon?.smithBonus;

    const events = smith(world, [
      { type: "SmithBonus", item: sword?.id ?? -1 },
    ]);

    expect(events).toEqual([]);
    expect(equipmentOf(world).weapon?.smithBonus).toEqual(bonus);
    expect(world.hero.progress.smithService).toBe("unlocked");
  });

  it("needs the Smith in reach", () => {
    const world = newWorld();
    world.hero.pos = { x: 17.5, y: 1.5 };
    world.hero.prevPos = { ...world.hero.pos };
    // Next to the Elder, not the Smith.
    const sword = equipmentOf(world).weapon;

    const events = smith(world, [
      { type: "SmithBonus", item: sword?.id ?? -1 },
    ]);

    expect(events).toEqual([]);
    expect(world.hero.progress.smithService).toBe("unlocked");
  });

  it("is unlocked by handing in Spa Day", () => {
    const world = createWorld({
      areas: { town },
      seed: 1,
      progress: {
        ...FRESH_PROGRESS,
        quests: {
          ...FRESH_PROGRESS.quests,
          "spa-day": { state: "ready", count: 1 },
        },
      },
    });
    expect(world.hero.progress.smithService).toBe("locked");
    const smithNpc = world.areas.town.npcs.findIndex(
      ({ name }) => name === "Smith",
    );
    expect(smithNpc).toBeGreaterThanOrEqual(0);

    step(world, [{ type: "HandInQuest", quest: "spa-day" }]);

    expect(world.hero.progress.smithService).toBe("unlocked");
  });

  it("stays with the Item as it moves to the Inventory and back", () => {
    const world = newWorld();
    const sword = equipmentOf(world).weapon;
    smith(world, [{ type: "SmithBonus", item: sword?.id ?? -1 }]);
    const bonus = equipmentOf(world).weapon?.smithBonus;

    step(world, [
      { type: "LiftItem", from: "weapon" },
      { type: "PlaceItem", to: { column: 0, row: 0 } },
    ]);
    expect(inventoryOf(world)[0].item.smithBonus).toEqual(bonus);

    step(world, [{ type: "EquipItem", item: inventoryOf(world)[0].item.id }]);
    expect(equipmentOf(world).weapon?.smithBonus).toEqual(bonus);
  });
});
