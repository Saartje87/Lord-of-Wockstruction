import { describe, expect, it } from "vitest";
import { areaDisplayNames, createShippedWorld } from "../content";
import { emptyBelt } from "../sim/belt";
import { EQUIPMENT_SLOTS } from "../sim/inventory";
import { overlaps, type Rect } from "../sim/rect";
import { ATTRIBUTES } from "../sim/world";
import { DESKTOP_SCREENS, PHONES } from "../testScreens";
import { atUiScale, type Viewport, viewportOf } from "../viewport";
import { beltStripLayout } from "./beltStrip";
import {
  DIALOGUE,
  dialogueLayout,
  dialogueSheet,
  SMITH_PAGE_SIZE,
} from "./dialoguePanel";
import { experienceBarLayout } from "./experienceBar";
import {
  heroPanelLayout,
  heroPanelRow,
  heroSheet,
  PANEL_ROWS,
} from "./heroPanel";
import { INVENTORY_PANEL, inventoryPanelLayout } from "./inventoryPanel";
import { orbsLayout } from "./orbs";
import { panelButtonsLayout } from "./panelButtons";
import { QUEST_PANEL, questPanelLayout, questPanelSheet } from "./questPanel";
import { skillBarLayout } from "./skillBar";
import {
  fullRooms,
  SKILL_TREE_PANEL,
  skillTreePanelLayout,
} from "./skillTreePanel";
import { VENDOR_PANEL, vendorPanelLayout } from "./vendorPanel";
import {
  WAYPOINT_LIST,
  waypointListLayout,
  waypointListSheet,
} from "./waypointList";

/**
 * Where one panel puts its parts on a viewport, as the layout test reads
 * them.
 */
type PanelRects = {
  panel: Rect;
  /** Where its close hint goes, at the bottom inside its padding. */
  closeHint: Rect;
  /** The × close button. */
  closeButton: Rect;
  /**
   * Its rows, slots and cells: each inside the panel, clear of the others,
   * of the × and of the close hint.
   */
  parts: [string, Rect][];
  /**
   * Its buttons inside rows (+, −, Accept): inside the panel, clear of the
   * × and the close hint.
   */
  buttons: [string, Rect][];
};

/** A panel the test covers: add a new panel to `PANELS_UNDER_TEST` to cover it. */
type PanelUnderTest = {
  name: string;
  rects: (viewport: Viewport) => PanelRects;
};

const world = createShippedWorld({ seed: 1 });

/**
 * A Hero with Gloves and Boots of speed Equipped, whose Hero panel shows
 * every line it can: the speed lines show only with those bonuses.
 */
const speedyWorld = createShippedWorld({
  seed: 1,
  belongings: {
    inventory: [],
    belt: emptyBelt(),
    equipment: {
      gloves: {
        type: "leatherGloves",
        rarity: "magic",
        affixes: [{ kind: "attackSpeed", grade: 0, value: 12 }],
      },
      boots: {
        type: "leatherBoots",
        rarity: "magic",
        affixes: [{ kind: "walkSpeed", grade: 0, value: 9 }],
      },
    },
  },
});

/** The rows of Belt Columns a Belt can give, from none Equipped up. */
const BELT_ROWS = [1, 2, 3, 4];

/** The close hint at the bottom of `panel`, inside `padding` and `hintHeight` tall (CSS px at native scale). */
function closeHintOf(
  panel: Rect,
  size: { padding: number; hintHeight: number },
  viewport: Viewport,
): Rect {
  const { padding, hintHeight } = atUiScale(size, viewport.uiScale);
  return {
    x: panel.x + padding,
    y: panel.y + panel.h - padding - hintHeight,
    w: panel.w - 2 * padding,
    h: hintHeight,
  };
}

/** The most buttons the Dialogue panel shows: the Smith's page, More gear and Goodbye, or any NPC's own. */
const DIALOGUE_BUTTONS = Math.max(
  SMITH_PAGE_SIZE + 2,
  ...Object.keys(world.areas).flatMap((name) => {
    const inArea = { ...world, areaName: name };
    return inArea.areas[name].npcs.map(
      (_, npc) => dialogueSheet(inArea, npc)?.buttons.length ?? 0,
    );
  }),
);

const PANELS_UNDER_TEST: PanelUnderTest[] = [
  {
    name: "Hero panel",
    rects(viewport) {
      const layout = heroPanelLayout(viewport);
      const derived = heroSheet(speedyWorld).derived.length;
      const rows = [
        PANEL_ROWS.level,
        PANEL_ROWS.experience,
        ...ATTRIBUTES.map((_, i) => PANEL_ROWS.attributes + i),
        PANEL_ROWS.attributePoints,
        ...Array.from({ length: derived }, (_, i) => PANEL_ROWS.derived + i),
      ];
      return {
        panel: layout.panel,
        closeHint: layout.closeHint,
        closeButton: layout.closeButton,
        parts: rows.map((row) => [`row ${row}`, heroPanelRow(viewport, row)]),
        buttons: [
          ...ATTRIBUTES.flatMap((attribute): [string, Rect][] => [
            [`${attribute} +`, layout.raise[attribute]],
            [`${attribute} −`, layout.lower[attribute]],
          ]),
          ["Accept", layout.accept],
        ],
      };
    },
  },
  ...BELT_ROWS.map(
    (beltRows): PanelUnderTest => ({
      name: `Inventory panel, ${beltRows} Belt rows`,
      rects(viewport) {
        const layout = inventoryPanelLayout(viewport, beltRows);
        return {
          panel: layout.panel,
          closeHint: closeHintOf(layout.panel, INVENTORY_PANEL, viewport),
          closeButton: layout.closeButton,
          parts: [
            ["grid", layout.grid],
            ...EQUIPMENT_SLOTS.map((slot): [string, Rect] => [
              slot,
              layout.slots[slot],
            ]),
            ...layout.belt.flatMap((cells, column) =>
              cells.map((rect, row): [string, Rect] => [
                `Belt ${column},${row}`,
                rect,
              ]),
            ),
          ],
          buttons: [],
        };
      },
    }),
  ),
  {
    name: "Skill Tree",
    rects(viewport) {
      const layout = skillTreePanelLayout(viewport, fullRooms());
      return {
        panel: layout.panel,
        closeHint: closeHintOf(layout.panel, SKILL_TREE_PANEL, viewport),
        closeButton: layout.closeButton,
        parts: [
          ...Object.entries(layout.branches).map(
            ([branch, rect]): [string, Rect] => [`${branch} heading`, rect],
          ),
          ...Object.entries(layout.skills).map(
            ([skill, rect]): [string, Rect] => [skill, rect],
          ),
        ],
        buttons: Object.entries(layout.raise).map(
          ([skill, rect]): [string, Rect] => [`${skill} +`, rect],
        ),
      };
    },
  },
  {
    name: "Quest panel",
    rects(viewport) {
      const layout = questPanelLayout(viewport, questPanelSheet(world).length);
      return {
        panel: layout.panel,
        closeHint: closeHintOf(layout.panel, QUEST_PANEL, viewport),
        closeButton: layout.closeButton,
        parts: layout.rows.map((rect, i): [string, Rect] => [`row ${i}`, rect]),
        buttons: [],
      };
    },
  },
  {
    name: "Vendor panel",
    rects(viewport) {
      const layout = vendorPanelLayout(viewport);
      return {
        panel: layout.panel,
        closeHint: closeHintOf(layout.panel, VENDOR_PANEL, viewport),
        closeButton: layout.closeButton,
        parts: [
          ["goods grid", layout.goods],
          ["inventory grid", layout.inventory],
        ],
        buttons: [],
      };
    },
  },
  {
    name: "Waypoint list",
    rects(viewport) {
      const rows = waypointListSheet(world, areaDisplayNames).length;
      const layout = waypointListLayout(viewport, rows);
      return {
        panel: layout.panel,
        closeHint: closeHintOf(layout.panel, WAYPOINT_LIST, viewport),
        closeButton: layout.closeButton,
        parts: layout.rows.map((rect, i): [string, Rect] => [`row ${i}`, rect]),
        buttons: [],
      };
    },
  },
  {
    name: "Dialogue panel",
    rects(viewport) {
      const layout = dialogueLayout(viewport, DIALOGUE_BUTTONS);
      return {
        panel: layout.panel,
        closeHint: closeHintOf(layout.panel, DIALOGUE, viewport),
        closeButton: layout.closeButton,
        parts: [
          ["body", layout.body],
          ...layout.buttons.map((rect, i): [string, Rect] => [
            `button ${i}`,
            rect,
          ]),
        ],
        buttons: [],
      };
    },
  },
];

/** A circle's bounding square. */
function squareOf(circle: {
  x: number;
  y: number;
  radius: number;
  rim: number;
}) {
  const reach = circle.radius + circle.rim;
  return {
    x: circle.x - reach,
    y: circle.y - reach,
    w: 2 * reach,
    h: 2 * reach,
  };
}

/**
 * What a panel must leave uncovered on `viewport`, by name. The Compact
 * Layout's panel fills the screen over the orbs, the Level Up button and
 * the Experience bar by design, so there only the buttons a panel leaves in
 * reach are listed. The Mini Map is not listed at all: it hides while any
 * panel is open.
 */
function hudToClear(viewport: Viewport): [string, Rect][] {
  const { slots } = skillBarLayout(viewport);
  const { columns } = beltStripLayout(viewport);
  const { buttons, townPortal } = panelButtonsLayout(viewport);
  const reach: [string, Rect][] = [
    ...Object.entries(slots).map(([slot, rect]): [string, Rect] => [
      `Skill Bar ${slot}`,
      rect,
    ]),
    ...columns.map((rect, column): [string, Rect] => [
      `Belt Column ${column}`,
      rect,
    ]),
    ...Object.entries(buttons).map(([panel, rect]): [string, Rect] => [
      `${panel} button`,
      rect,
    ]),
    ["Town Portal button", townPortal],
  ];
  if (viewport.compact) return reach;
  const { life, mana } = orbsLayout(viewport);
  return [
    ...reach,
    ["Life orb", squareOf(life)],
    ["Mana orb", squareOf(mana)],
    ["Level Up button", heroPanelLayout(viewport).levelUp],
    ["Experience bar", experienceBarLayout(viewport)],
  ];
}

/** Every layout the test covers: each screen size, in the layout it takes. */
const LAYOUTS = [
  ...DESKTOP_SCREENS.map((screen) => ({ compact: false, screen })),
  ...PHONES.map((screen) => ({ compact: true, screen })),
].map(({ compact, screen }) => ({
  label: `${screen.width}×${screen.height} ${compact ? "Compact Layout" : "desktop"}`,
  compact,
  viewport: viewportOf(screen),
}));

/** Rounding slack for rects laid out in fractions of a pixel (CSS px). */
const EPSILON = 1e-6;

/** Whether `a` and `b` share more than rounding's worth of area. */
function overlapsForReal(a: Rect, b: Rect): boolean {
  return overlaps(
    {
      x: a.x + EPSILON,
      y: a.y + EPSILON,
      w: a.w - 2 * EPSILON,
      h: a.h - 2 * EPSILON,
    },
    b,
  );
}

function expectInside(rect: Rect, outer: Rect, name: string) {
  expect(rect.x, `${name} left`).toBeGreaterThanOrEqual(outer.x - EPSILON);
  expect(rect.y, `${name} top`).toBeGreaterThanOrEqual(outer.y - EPSILON);
  expect(rect.x + rect.w, `${name} right`).toBeLessThanOrEqual(
    outer.x + outer.w + EPSILON,
  );
  expect(rect.y + rect.h, `${name} bottom`).toBeLessThanOrEqual(
    outer.y + outer.h + EPSILON,
  );
}

function expectApart(parts: [string, Rect][]) {
  for (const [i, [name, rect]] of parts.entries()) {
    for (const [other, otherRect] of parts.slice(i + 1)) {
      expect(overlapsForReal(rect, otherRect), `${name} and ${other}`).toBe(
        false,
      );
    }
  }
}

describe.each(LAYOUTS)("every panel at $label", ({ compact, viewport }) => {
  const screen = { x: 0, y: 0, w: viewport.width, h: viewport.height };

  it("takes the layout its size is listed for", () => {
    expect(viewport.compact).toBe(compact);
    expect(viewport.rotateNotice).toBeNull();
  });

  it.each(
    PANELS_UNDER_TEST,
  )("lays out the $name inside the screen, its parts apart, clear of its close hint", ({
    rects,
  }) => {
    const { panel, closeHint, closeButton, parts, buttons } = rects(viewport);

    expectInside(panel, screen, "panel");
    expectInside(closeHint, panel, "close hint");
    expectInside(closeButton, panel, "×");
    for (const [name, rect] of [...parts, ...buttons]) {
      expectInside(rect, panel, name);
    }
    expectApart([...parts, ["×", closeButton], ["close hint", closeHint]]);
    for (const [name, rect] of buttons) {
      expectApart([
        [name, rect],
        ["×", closeButton],
        ["close hint", closeHint],
      ]);
    }
  });

  it.each(PANELS_UNDER_TEST)("keeps the $name clear of the HUD", ({
    rects,
  }) => {
    const { panel } = rects(viewport);

    for (const [name, rect] of hudToClear(viewport)) {
      expect(overlapsForReal(panel, rect), name).toBe(false);
    }
  });
});
