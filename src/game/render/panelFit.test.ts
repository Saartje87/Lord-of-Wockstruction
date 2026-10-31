import { describe, expect, it } from "vitest";
import { areaDisplayNames, createShippedWorld } from "../content";
import { canShareScreen, PANELS, type Panel } from "../menus";
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
import { miniMapLayout } from "./miniMap";
import { orbsLayout } from "./orbs";
import { panelButtonsLayout } from "./panelButtons";
import { QUEST_PANEL, questPanelLayout, questPanelSheet } from "./questPanel";
import { skillBarLayout } from "./skillBar";
import {
  fullRooms,
  SKILL_TREE_PANEL,
  skillTreePanelLayout,
} from "./skillTreePanel";
import { touchControlsLayout } from "./touchControls";
import { MIN_CELL_HIT, TOUCH_HIT_AREA, touchHitRect } from "./touchHitArea";
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
   * × and the close hint. A button's touch hit area stays inside the third
   * rect, if given.
   */
  buttons: [string, Rect, Rect?][];
  /** Its grid cells, one per size: the Inventory's, Equipment slots, Belt cells and Vendor's. */
  cells: [string, Rect][];
};

/** A panel the test covers: add a new panel to `PANELS_UNDER_TEST` to cover it. */
type PanelUnderTest = {
  name: string;
  /** The panel as the menus know it, if it may share the screen with another. */
  panel?: Panel;
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
    panel: "hero",
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
      /** Row `row`'s band across the panel, which a button's touch hit area stays in. */
      const bandOf = (row: number): Rect => {
        const { y, h } = heroPanelRow(viewport, row);
        return { x: layout.panel.x, y, w: layout.panel.w, h };
      };
      const attributeBand = (attribute: (typeof ATTRIBUTES)[number]) =>
        bandOf(PANEL_ROWS.attributes + ATTRIBUTES.indexOf(attribute));
      return {
        panel: layout.panel,
        closeHint: layout.closeHint,
        closeButton: layout.closeButton,
        parts: rows.map((row) => [`row ${row}`, heroPanelRow(viewport, row)]),
        buttons: [
          ...ATTRIBUTES.flatMap((attribute): [string, Rect, Rect][] => [
            [
              `${attribute} +`,
              layout.raise[attribute],
              attributeBand(attribute),
            ],
            [
              `${attribute} −`,
              layout.lower[attribute],
              attributeBand(attribute),
            ],
          ]),
          ["Accept", layout.accept, bandOf(PANEL_ROWS.attributePoints)],
        ],
        cells: [],
      };
    },
  },
  ...BELT_ROWS.map(
    (beltRows): PanelUnderTest => ({
      name: `Inventory panel, ${beltRows} Belt rows`,
      panel: "inventory",
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
          cells: [
            [
              "grid cell",
              {
                x: layout.grid.x,
                y: layout.grid.y,
                w: layout.cell,
                h: layout.cell,
              },
            ],
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
        };
      },
    }),
  ),
  {
    name: "Skill Tree",
    panel: "skillTree",
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
          ([skill, rect]): [string, Rect, Rect] => [
            `${skill} +`,
            rect,
            layout.panel,
          ],
        ),
        cells: [],
      };
    },
  },
  {
    name: "Quest panel",
    panel: "quest",
    rects(viewport) {
      const layout = questPanelLayout(viewport, questPanelSheet(world).length);
      return {
        panel: layout.panel,
        closeHint: closeHintOf(layout.panel, QUEST_PANEL, viewport),
        closeButton: layout.closeButton,
        parts: layout.rows.map((rect, i): [string, Rect] => [`row ${i}`, rect]),
        buttons: [],
        cells: [],
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
        cells: [
          [
            "cell",
            {
              x: layout.goods.x,
              y: layout.goods.y,
              w: layout.cell,
              h: layout.cell,
            },
          ],
        ],
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
        cells: [],
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
        cells: [],
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

/** `rect` grown about its middle to at least `TOUCH_HIT_AREA` each way. */
function grownToTouch(rect: Rect): Rect {
  const w = Math.max(rect.w, TOUCH_HIT_AREA);
  const h = Math.max(rect.h, TOUCH_HIT_AREA);
  return {
    x: rect.x - (w - rect.w) / 2,
    y: rect.y - (h - rect.h) / 2,
    w,
    h,
  };
}

/**
 * Expects the Touch hit area of a button drawn at `rect` to be
 * `TOUCH_HIT_AREA` each way, and wherever it is less, to be so because the
 * halfway rule stops it at a neighbour in `neighbours` or the area it must
 * stay `within` ends.
 */
function expectTouchHitArea(
  name: string,
  rect: Rect,
  neighbours: Rect[],
  within?: Rect,
) {
  const hit = touchHitRect(rect, neighbours, within);
  expect(hit.x, `${name} hit area keeps the button`).toBeLessThanOrEqual(
    rect.x + EPSILON,
  );
  expect(hit.y, `${name} hit area keeps the button`).toBeLessThanOrEqual(
    rect.y + EPSILON,
  );
  expect(hit.x + hit.w, `${name} hit area keeps the button`).toBeGreaterThan(
    rect.x + rect.w - EPSILON,
  );
  expect(hit.y + hit.h, `${name} hit area keeps the button`).toBeGreaterThan(
    rect.y + rect.h - EPSILON,
  );
  const grown = grownToTouch(rect);
  const axes = [
    { pos: "x", size: "w", other: "y", otherSize: "h" },
    { pos: "y", size: "h", other: "x", otherSize: "w" },
  ] as const;
  for (const { pos, size, other, otherSize } of axes) {
    if (hit[size] >= TOUCH_HIT_AREA - EPSILON) continue;
    const need = TOUCH_HIT_AREA - rect[size];
    const gapOf = (a: Rect, b: Rect, axis: "x" | "y", length: "w" | "h") =>
      Math.max(
        b[axis] - (a[axis] + a[length]),
        a[axis] - (b[axis] + b[length]),
      );
    const cutByWithin =
      within !== undefined &&
      (grown[pos] < within[pos] - EPSILON ||
        grown[pos] + grown[size] > within[pos] + within[size] + EPSILON);
    const cutByNeighbour = neighbours.some(
      (n) =>
        !overlaps(rect, n) &&
        (!within || overlaps(within, n)) &&
        gapOf(rect, n, other, otherSize) < TOUCH_HIT_AREA - rect[otherSize] &&
        gapOf(rect, n, pos, size) < need - EPSILON &&
        gapOf(rect, n, pos, size) >= gapOf(rect, n, other, otherSize),
    );
    expect(
      cutByWithin || cutByNeighbour,
      `${name} hit area is ${hit[size]} px ${size === "w" ? "wide" : "tall"} with nothing to stop it`,
    ).toBe(true);
  }
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

  it.each(
    PANELS_UNDER_TEST,
  )("keeps the $name's grid cells at least MIN_CELL_HIT", ({ rects }) => {
    for (const [name, cell] of rects(viewport).cells) {
      expect(cell.w, `${name} width`).toBeGreaterThanOrEqual(MIN_CELL_HIT);
      expect(cell.h, `${name} height`).toBeGreaterThanOrEqual(MIN_CELL_HIT);
    }
  });

  it.each(
    PANELS_UNDER_TEST,
  )("keeps the $name's buttons' Touch hit area, as far as the halfway rule allows", ({
    rects,
  }) => {
    const { closeButton, parts, buttons, cells } = rects(viewport);
    const targets: [string, Rect, Rect?][] = [["×", closeButton], ...buttons];
    for (const [name, rect, within] of targets) {
      const neighbours = [
        ...parts.map(([, other]) => other),
        ...cells.map(([, other]) => other),
        ...targets.map(([, other]) => other),
        ...hudToClear(viewport).map(([, other]) => other),
      ].filter((other) => other !== rect);
      expectTouchHitArea(name, rect, neighbours, within);
    }
  });
});

describe.each(LAYOUTS)("the HUD's buttons at $label", ({ viewport }) => {
  it("keep their Touch hit area, as far as the halfway rule allows", () => {
    const { buttons, townPortal } = panelButtonsLayout(viewport);
    const controls = touchControlsLayout(viewport);
    const { life, mana } = orbsLayout(viewport);
    const targets: [string, Rect][] = [
      ...Object.entries(buttons).map(([panel, rect]): [string, Rect] => [
        `${panel} button`,
        rect,
      ]),
      ["Town Portal button", townPortal],
      ["pause button", controls.pause],
    ];
    const stops = [
      ...Object.values(skillBarLayout(viewport).slots),
      ...beltStripLayout(viewport).columns,
      heroPanelLayout(viewport).levelUp,
      squareOf(life),
      squareOf(mana),
      experienceBarLayout(viewport),
      miniMapLayout(viewport),
      controls.attack,
      ...Object.values(controls.skills),
    ];
    for (const [name, rect] of targets) {
      const neighbours = [
        ...stops,
        ...targets.map(([, other]) => other).filter((other) => other !== rect),
      ];
      expectTouchHitArea(name, rect, neighbours);
    }
  });
});

describe.each(
  DESKTOP_SCREENS,
)("panels open together at $width×$height", (screen) => {
  const viewport = viewportOf(screen);
  const pairs = PANELS.flatMap((panel, i) =>
    PANELS.slice(i + 1).map((other) => [panel, other] as const),
  ).filter(([panel, other]) =>
    canShareScreen({ compact: false }, panel, other),
  );

  it("include the Hero panel with each other panel", () => {
    for (const other of PANELS.filter((panel) => panel !== "hero")) {
      expect(
        pairs.some(([a, b]) => a === "hero" && b === other),
        other,
      ).toBe(true);
    }
  });

  it.each(pairs)("keep the %s panel and the %s panel apart", (panel, other) => {
    const under = (key: Panel) =>
      PANELS_UNDER_TEST.filter((candidate) => candidate.panel === key);
    for (const first of under(panel)) {
      for (const second of under(other)) {
        expect(
          overlapsForReal(
            first.rects(viewport).panel,
            second.rects(viewport).panel,
          ),
          `${first.name} and ${second.name}`,
        ).toBe(false);
      }
    }
  });
});
