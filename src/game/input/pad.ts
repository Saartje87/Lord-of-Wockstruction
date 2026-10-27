import type { CursorPoint } from "../cursor";
import { anyPanelOpen, type OpenPanels } from "../menus";
import type { ItemId } from "../sim/inventory";
import { type SkillBarSlot, skillInSlot } from "../sim/skillBar";
import { distance, type Vec } from "../sim/vec";
import type { MonsterId, Order, World } from "../sim/world";
import { inputTuning } from "../tuning/input";
import {
  type FocusDirection,
  type FocusSpot,
  moveFocus,
  refocus,
} from "./focus";
import { pickTarget } from "./target";

/**
 * A pad button, named as on an Xbox-style controller: the face buttons, the
 * bumpers and triggers, View and Menu, and the D-pad's four directions. The
 * touch controls stand in for the same buttons.
 */
export type PadButton =
  | "a"
  | "b"
  | "x"
  | "y"
  | "lb"
  | "rb"
  | "lt"
  | "rt"
  | "view"
  | "menu"
  | "up"
  | "down"
  | "left"
  | "right";

/**
 * The pad as read this frame, whatever device it comes from: the stick's
 * direction on screen (x right, y down, of length up to 1) and the buttons
 * that went down since the last frame, are down now, and went up since.
 */
export type PadSnapshot = {
  stick: Vec;
  pressed: readonly PadButton[];
  held: readonly PadButton[];
  released: readonly PadButton[];
};

/** A snapshot of a pad left alone: the stick at rest, no button down. */
export const restingPad: PadSnapshot = {
  stick: { x: 0, y: 0 },
  pressed: [],
  held: [],
  released: [],
};

/**
 * The controller and the touch controls read as one pad: the stick pushed
 * further, and the buttons of either, let go only once neither holds them.
 */
export function bothPads(
  controller: PadSnapshot,
  touch: PadSnapshot,
): PadSnapshot {
  const union = (first: readonly PadButton[], second: readonly PadButton[]) => [
    ...new Set([...first, ...second]),
  ];
  const held = union(controller.held, touch.held);
  const further = (stick: Vec) => Math.hypot(stick.x, stick.y);
  return {
    stick:
      further(touch.stick) > further(controller.stick)
        ? touch.stick
        : controller.stick,
    pressed: union(controller.pressed, touch.pressed),
    held,
    released: union(controller.released, touch.released).filter(
      (button) => !held.includes(button),
    ),
  };
}

/**
 * Pad state between frames: when each held button last ordered, and whether
 * the stick is out of its dead zone.
 */
export type PadInput = {
  /** When each button last ordered while held (ms); absent when not held. */
  lastOrderMs: Partial<Record<PadButton, number>>;
  /** Whether the stick was pushed past the dead zone last frame. */
  stickPushed: boolean;
  /** The spot the Focus last rested on, if it has. */
  focus: FocusSpot | null;
  /** Whether the Focus shows: from a press of the pad until `hideFocus`. */
  focusShown: boolean;
};

/** The D-pad directions, which a push of the stick stands in for in menus. */
export const DIRECTIONS = ["up", "down", "left", "right"] as const;
type PadDirection = (typeof DIRECTIONS)[number] & FocusDirection;

/** The Skill Bar slot each Skill button casts. */
const SKILL_BUTTONS = [
  ["x", "key1"],
  ["y", "key2"],
  ["b", "key3"],
  ["rb", "key4"],
  ["rt", "right"],
] as const satisfies readonly (readonly [PadButton, SkillBarSlot])[];

/** The pad button that casts the Skill in Skill Bar slot `slot`. */
export function castButton(slot: SkillBarSlot): PadButton {
  const found = SKILL_BUTTONS.find(([, cast]) => cast === slot);
  if (!found) throw new Error(`No pad button casts ${slot}`);
  return found[0];
}

/** The D-pad directions that drink from Belt Columns 1 to 4, in turn. */
const DRINK_BUTTONS = ["left", "up", "right", "down"] as const;

/** The D-pad direction that drinks from Belt Column `column` (from 0). */
export function drinkButton(column: number): PadButton {
  const button = DRINK_BUTTONS[column];
  if (!button) throw new Error(`No pad button drinks from column ${column}`);
  return button;
}

/**
 * How the pad sees the screen, as last drawn, the World, as last stepped,
 * and the menus, as this frame found them.
 */
export type PadView = {
  /** Maps a canvas point (CSS px) to tile units. */
  toTile(screen: Vec): Vec;
  /** The World as last stepped, which auto-aim picks the Target from. */
  world: World;
  /** Which panels are open: while any is, the Hero stands still. */
  menus: OpenPanels;
  /** The Focus spots of the panel that has the Focus, as last drawn. */
  focusSpots: readonly FocusSpot[];
};

/** What the pad asks of this frame. */
export type PadPoll = {
  orders: Order[];
  /** The Target, for the renderer to show. */
  target: MonsterId | null;
  /** The buttons pressed this frame, for the menus. */
  presses: PadButton[];
  /** The spot the Focus rests on, while it shows in an open panel. */
  focus: FocusSpot | null;
  /** A click to give, as the left button's press and release would. */
  click: CursorPoint | null;
  /** A right-click to give, as the right button would. */
  rightClick: CursorPoint | null;
};

/** Pad state before any frame: nothing held, the Focus nowhere yet. */
export function createPadInput(): PadInput {
  return {
    lastOrderMs: {},
    stickPushed: false,
    focus: null,
    focusShown: false,
  };
}

/**
 * Hides the Focus, as input other than the pad is used, until the pad is
 * pressed again. It stays on its spot meanwhile.
 */
export function hideFocus(input: PadInput) {
  input.focusShown = false;
}

/**
 * Called once per frame, as `poll` is for the pointer. Returns the orders
 * for the sim and the Target, for the renderer to show.
 *
 * The stick walks the Hero in the direction it points on screen, in tiles,
 * for as long as it is pushed past the dead zone; nothing once let go, which
 * stops the Hero. The Target is the nearest Monster within reach ahead of
 * the stick (inside the cone) while it is pushed, and with it at rest the
 * nearest within reach whichever way it lies (`pickTarget`). A attacks the
 * Target; with none it picks up the nearest Ground Item within
 * `groundItemReach`; with neither it does nothing. Held, A acts again every
 * `retargetMs`, picking the Target afresh, and the stick keeps walking, so
 * the Hero walks between swings.
 *
 * X, Y, B and RB cast the Skills in the four keyed Skill Bar slots and RT
 * the right-click slot's, at the Target, or with none at a point
 * `castDistance` ahead (of the stick while pushed, else of the Hero's
 * facing). Held, they cast again every `retargetMs`, and the stick keeps
 * walking between casts, for kiting. An empty slot casts nothing. The D-pad's
 * left, up, right and down drink from Belt Columns 1 to 4, and LB opens a
 * Town Portal, once a press.
 *
 * While a panel is open the Hero stands still and nothing is ordered.
 * Instead, once the pad has been pressed, the Focus shows on a spot of
 * `focusSpots`, where it last rested, else the spot nearest there, else the
 * first (`refocus`); the press that shows it does nothing more. The D-pad
 * and a push of the stick move it (`moveFocus`); A clicks the spot
 * (lifting, putting down or pressing), X right-clicks it (Equipping or
 * drinking) or clicks its second hit if it has one (picking up a learned
 * Skill) and Y clicks off the panel there,
 * dropping a Held Item, each once a press. During Death, A sends the Hero
 * back to Town, once a press, and nothing else is ordered. Neither shows a
 * Target.
 *
 * `presses` are the buttons pressed this frame, for the menus (`pressPad`),
 * with a push of the stick past the dead zone counted, once until it comes
 * back to rest, as a press of the D-pad direction nearest it.
 */
export function pollPad(
  input: PadInput,
  snapshot: PadSnapshot,
  nowMs: number,
  view: PadView,
): PadPoll {
  const presses = [...snapshot.pressed, ...stickPress(input, snapshot.stick)];
  const wasShown = input.focusShown;
  if (presses.length > 0) input.focusShown = true;
  const { world } = view;
  const none = { target: null, focus: null, click: null, rightClick: null };
  if (anyPanelOpen(view.menus)) {
    const focus = steerFocus(input, presses, view.focusSpots, wasShown);
    return { ...none, ...focus, orders: [], presses };
  }
  if (world.death) {
    const back = snapshot.pressed.includes("a");
    const orders: Order[] = back ? [{ type: "Continue" }] : [];
    return { ...none, orders, presses };
  }
  const walk = walkDirection(snapshot.stick, view);
  const facing = {
    x: Math.cos(world.hero.facing),
    y: Math.sin(world.hero.facing),
  };
  const target = pickTarget(world, walk);
  const action = target !== null ? attack(target) : pickUpNear(world);
  // The walk goes first, so an Attack or Cast after it in the same step
  // isn't cancelled by it; while a swing or cast roots the Hero, the sim
  // holds the walk back until it ends, so the Hero kites between them.
  const orders: Order[] = walk ? [{ type: "Walk", direction: walk }] : [];
  if (actsNow(input, snapshot, "a", nowMs) && action) orders.push(action);
  const aim = castPoint(world, target, walk ?? facing);
  for (const [button, slot] of SKILL_BUTTONS) {
    const acts = actsNow(input, snapshot, button, nowMs);
    if (acts && skillInSlot(world, slot)) {
      orders.push({ type: "Cast", slot, target: { ...aim } });
    }
  }
  DRINK_BUTTONS.forEach((button, column) => {
    if (snapshot.pressed.includes(button)) {
      orders.push({ type: "DrinkFromBelt", column });
    }
  });
  if (snapshot.pressed.includes("lb")) orders.push({ type: "OpenTownPortal" });
  return { ...none, orders, target, presses };
}

/**
 * Moves the Focus over `spots` for this frame's `presses` and gives the
 * clicks they ask for, as `pollPad` describes: nothing while it doesn't
 * show, nor unless it already showed before this frame (`wasShown`).
 */
function steerFocus(
  input: PadInput,
  presses: readonly PadButton[],
  spots: readonly FocusSpot[],
  wasShown: boolean,
): Pick<PadPoll, "focus" | "click" | "rightClick"> {
  const { focus: last } = input;
  let focus = refocus(spots, last);
  input.focus = focus ?? last;
  if (!focus || !input.focusShown) {
    return { focus: null, click: null, rightClick: null };
  }
  if (!wasShown) return { focus, click: null, rightClick: null };
  for (const press of presses) {
    const direction = DIRECTIONS.find((one) => one === press);
    if (direction) focus = moveFocus(spots, focus, direction);
  }
  input.focus = focus;
  const { at, hit } = focus;
  const drop = { at, hit: { drop: true } } as const;
  const click = presses.includes("a")
    ? { at, hit }
    : presses.includes("y")
      ? drop
      : null;
  if (presses.includes("x") && focus.secondHit) {
    return { focus, click: { at, hit: focus.secondHit }, rightClick: null };
  }
  const rightClick = presses.includes("x") ? { at, hit } : null;
  return { focus, click, rightClick };
}

/**
 * The D-pad direction a push of `stick` past the dead zone stands in for, as
 * it goes past; nothing while it stays pushed or rests. Keeps whether it is
 * pushed in `input`.
 */
function stickPress(input: PadInput, stick: Vec): PadDirection[] {
  const pushed = Math.hypot(stick.x, stick.y) > inputTuning.stickDeadZone;
  const fresh = pushed && !input.stickPushed;
  input.stickPushed = pushed;
  if (!fresh) return [];
  if (Math.abs(stick.x) >= Math.abs(stick.y)) {
    return [stick.x > 0 ? "right" : "left"];
  }
  return [stick.y > 0 ? "down" : "up"];
}

/**
 * Whether held `button` acts this frame: on a fresh press, or every
 * `retargetMs` while held. Keeps its clock in `input`.
 */
function actsNow(
  input: PadInput,
  snapshot: PadSnapshot,
  button: PadButton,
  nowMs: number,
): boolean {
  const last = input.lastOrderMs[button];
  if (!snapshot.held.includes(button)) {
    delete input.lastOrderMs[button];
    return false;
  }
  if (
    snapshot.pressed.includes(button) ||
    last === undefined ||
    nowMs - last >= inputTuning.retargetMs
  ) {
    input.lastOrderMs[button] = nowMs;
    return true;
  }
  return false;
}

/**
 * Where a Skill is cast: at the Target, or with none `castDistance` from the
 * Hero along `ahead` (tiles, any length).
 */
function castPoint(world: World, target: MonsterId | null, ahead: Vec): Vec {
  const monster = world.monsters.find(({ id }) => id === target);
  if (monster) return monster.pos;
  const { pos } = world.hero;
  const length = Math.hypot(ahead.x, ahead.y) || 1;
  const away = inputTuning.castDistance / length;
  return { x: pos.x + ahead.x * away, y: pos.y + ahead.y * away };
}

/**
 * The direction in tiles the stick walks the Hero, or null when it rests
 * inside the dead zone.
 */
function walkDirection(stick: Vec, view: PadView): Vec | null {
  if (Math.hypot(stick.x, stick.y) <= inputTuning.stickDeadZone) return null;
  // The view maps points; the direction is between two of them.
  const from = view.toTile({ x: 0, y: 0 });
  const to = view.toTile(stick);
  return { x: to.x - from.x, y: to.y - from.y };
}

const attack = (monster: MonsterId): Order => ({ type: "Attack", monster });

/** A pick-up of the nearest Ground Item within reach of the Hero, if any. */
function pickUpNear(world: World): Order | null {
  let nearest: { id: ItemId; away: number } | null = null;
  for (const { item, pos } of world.groundItems) {
    const away = distance(world.hero.pos, pos);
    if (away > inputTuning.groundItemReach) continue;
    if (nearest && away >= nearest.away) continue;
    nearest = { id: item.id, away };
  }
  return nearest && { type: "PickUp", groundItem: nearest.id };
}
