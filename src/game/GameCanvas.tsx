"use client";

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { pressButton } from "./buttonPress";
import { advance, createClock } from "./clock";
import { areaDisplayNames, areas, tilesets } from "./content";
import {
  type CursorPoint,
  clickCursor,
  createCursor,
  forTheWorld,
  pressCursor,
  releaseCursor,
  settleCursor,
} from "./cursor";
import { browserFullscreen } from "./fullscreen";
import {
  createActiveInput,
  padTouched,
  pointerWay,
  reportInput,
} from "./input/activeInput";
import { readGamepad } from "./input/gamepad";
import { castKeyOrder, drinkKeyOrder } from "./input/keys";
import {
  bothPads,
  createPadInput,
  hideFocus,
  type PadButton,
  pollPad,
} from "./input/pad";
import {
  attachPointer,
  cancel,
  claimPress,
  createPointerInput,
  poll,
  takeRelease,
  takeRightClick,
} from "./input/pointer";
import {
  cancelTap,
  createTapInput,
  tapDown,
  tapPointer,
  tapUp,
} from "./input/tap";
import { attachTouch, createTouchControls, readTouch } from "./input/touch";
import {
  clickPaused,
  createMenus,
  currentPanel,
  fitMenus,
  type MenuRequest,
  type Menus,
  pressKey,
  pressPad,
  reactMenus,
  tapRotateNotice,
} from "./menus";
import { gameTime, togglePause } from "./pause";
import { loadArt } from "./render/art";
import { inventoryRightClickOrder } from "./render/inventoryPanel";
import { panelFocusSpots } from "./render/panelFocus";
import { createRenderer } from "./render/renderer";
import {
  touchControlsLayout,
  touchControlsShown,
} from "./render/touchControls";
import {
  browserStorage,
  changesSave,
  readSave,
  removeSave,
  saveOf,
  writeSave,
} from "./save";
import { isFloor } from "./sim/area";
import { cursorItemOf } from "./sim/inventory";
import type { Vec } from "./sim/vec";
import { createWorld, type Order, step } from "./sim/world";
import { viewportOf } from "./viewport";

/** Mounts the Pixi Application and runs the fixed-step loop. */
export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const app = new Application();
    const listeners = new AbortController();
    let cancelled = false;
    let frame = 0;

    // StrictMode and `cacheComponents` can run this cleanup before `init()`
    // settles, so destroy only once it has.
    const init = app.init({
      resizeTo: window,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      background: 0x0b0a08,
      autoStart: false,
    });
    init.then(async () => {
      if (cancelled) return;
      const storage = browserStorage();
      // The Save's Hero, or a fresh one when there's no Save.
      const save = readSave(storage);
      let world = createWorld({
        areas,
        tilesets,
        seed: Date.now(),
        progress: save?.progress,
        belongings: save?.belongings,
      });
      const usedTilesets = Object.values(world.areas).map(
        (area) => area.tileset,
      );
      const art = await loadArt(
        [...new Set(usedTilesets)].filter((name) => name !== null),
        app.renderer.resolution,
      );
      if (cancelled) return;
      container.appendChild(app.canvas);

      // The way the player last played, which the hints name the buttons of.
      const activeInput = createActiveInput();
      // What the fingers hold of the touch controls.
      const touch = createTouchControls();
      const renderer = createRenderer(
        app,
        art,
        areaDisplayNames,
        activeInput,
        touch,
      );
      const clock = createClock();
      const input = createPointerInput();
      const menus = createMenus();
      const { pause } = menus;
      const fullscreen = browserFullscreen(listeners.signal);
      let orders: Order[] = [];
      const padInput = createPadInput();
      /** The controller's buttons held last frame. */
      let padHeld: readonly PadButton[] = [];
      let last = performance.now();
      /** What the cursor holds besides the Held Item. */
      let cursor = createCursor();
      /** A touch on the panels and the HUD, acted on as it lifts. */
      const tap = createTapInput();

      // Each input event tells the Active Input the way it came by, first,
      // so the touch that makes it touch can already be the touch
      // controls'. The controller is told of in the loop, as it's read there.
      for (const type of ["pointerdown", "pointermove"] as const) {
        window.addEventListener(
          type,
          (e) => {
            if (e.target !== app.canvas) return;
            reportInput(activeInput, {
              type: "used",
              way: pointerWay(e.pointerType),
            });
          },
          { capture: true, signal: listeners.signal },
        );
      }
      // A touch on the touch controls, shown and not under a panel, the HUD
      // or a Ground Item's label, is theirs and never the pointer's.
      attachTouch(
        app.canvas,
        touch,
        (at) =>
          touchControlsShown(activeInput.way, menus) &&
          !renderer.panelAt(at) &&
          renderer.groundLabelAt(at) === null
            ? touchControlsLayout(viewportOf(app.screen), menus)
            : null,
        listeners.signal,
      );
      attachPointer(app.canvas, input, listeners.signal);
      // Keys and clicks on the pause menu go to the menus; a click anywhere
      // else on it resumes. Any other click or key press goes on from the
      // Hero's Death, but for a click on the Hero panel or the Level Up
      // button.
      let clickedAt: Vec | null = null;
      let keys: string[] = [];
      app.canvas.addEventListener(
        "pointerdown",
        (e) => {
          clickedAt = { x: e.offsetX, y: e.offsetY };
        },
        { signal: listeners.signal },
      );
      window.addEventListener(
        "keydown",
        (e) => {
          if (!e.repeat) keys.push(e.key);
        },
        { signal: listeners.signal },
      );
      window.addEventListener(
        "keydown",
        () =>
          reportInput(activeInput, { type: "used", way: "mouseAndKeyboard" }),
        { signal: listeners.signal },
      );
      /** Whether the controller went while it was the Active Input. */
      let controllerLost = false;
      window.addEventListener(
        "gamepaddisconnected",
        () => {
          const event = { type: "controllerDisconnected" } as const;
          if (reportInput(activeInput, event).pause) controllerLost = true;
        },
        { signal: listeners.signal },
      );
      window.addEventListener(
        "gamepadconnected",
        () => {
          reportInput(activeInput, { type: "controllerConnected" });
        },
        { signal: listeners.signal },
      );

      const tick = (realNow: number) => {
        const wasPaused = pause.paused;
        const inventoryWasOpen = menus.inventoryOpen;
        // Read every frame, so a resize into the Compact Layout shuts all
        // but the latest panel at once, the Inventory's Held Item going back
        // as it would by hand, and the Rotate Notice pauses the World before
        // any key or click this frame, which it then takes for nothing.
        const viewport = viewportOf(app.screen);
        fitMenus(menus, viewport, realNow);
        // Read every frame too, so leaving fullscreen the browser's way (Esc,
        // the back gesture) turns the Fullscreen button back at once.
        menus.fullscreen = fullscreen.read();
        // A controller gone while it was played opens the pause menu, so the
        // Hero isn't killed while it's plugged back in.
        if (controllerLost && !pause.paused) togglePause(pause, realNow);
        controllerLost = false;
        let pressed = clickedAt !== null;
        /** What the menus asked for this frame, carried out below. */
        const requests = new Set<MenuRequest>();
        for (const key of keys) {
          const hero = { heroDead: world.death !== null };
          const used = pressKey(menus, key, realNow, hero);
          if (used === null) {
            pressed = true;
            // Keys Q/W/E/R cast at the cursor.
            const cursor = input.screen && renderer.screenToTile(input.screen);
            const cast = castKeyOrder(key, cursor);
            if (cast) orders.push(cast);
            // Keys 1–4 drink from the Belt Columns.
            const drink = drinkKeyOrder(key);
            if (drink) orders.push(drink);
          }
          if (used === "newHero") requests.add(used);
        }
        // The controller, read every frame so its buttons' presses and
        // releases are seen, and polled with the panels as the keys left
        // them, before its own presses open or shut any: B shutting a panel
        // casts nothing. It auto-aims from the World as last stepped (ADR
        // 0002).
        // The touch controls stand in for the same pad, and were told of as
        // touches.
        const controller = readGamepad(padHeld);
        padHeld = controller.held;
        if (padTouched(controller)) {
          reportInput(activeInput, { type: "used", way: "controller" });
        }
        const pad = bothPads(controller, readTouch(touch));
        // The Focus shows only while the controller is the Active Input, so
        // the mouse's pointer shows otherwise.
        if (activeInput.way !== "controller") hideFocus(padInput);
        const polled = pollPad(padInput, pad, gameTime(pause, realNow), {
          toTile: renderer.screenToTile,
          world,
          menus,
          focusSpots: panelFocusSpots(
            currentPanel(menus),
            world,
            viewport,
            menus.pendingPoints,
          ),
        });
        for (const button of polled.presses) {
          const hero = { heroDead: world.death !== null };
          const used = pressPad(menus, button, realNow, hero);
          if (used !== null && used !== "handled") requests.add(used);
        }
        if (clickedAt && wasPaused && pause.paused) {
          const choice = renderer.menuChoiceAt(
            clickedAt,
            pause.confirming,
            menus.fullscreen,
          );
          const asked = clickPaused(menus, choice, realNow);
          if (asked !== null) requests.add(asked);
        }
        if (clickedAt && menus.rotateNotice) {
          // Only a tap on the notice's Fullscreen button gets through.
          const choice = renderer.rotateNoticeChoiceAt(
            clickedAt,
            menus.fullscreen,
          );
          const asked = tapRotateNotice(menus, choice);
          if (asked !== null) requests.add(asked);
        }
        if (requests.has("fullscreen")) {
          // Only ever from the player's own click, tap or press, which the
          // browser asks of fullscreen; it may still refuse.
          fullscreen.toggle();
        }
        if (wasPaused || pause.paused) {
          // Neither a click on the menu nor a hold from before the pause
          // orders the Hero about.
          cancel(input);
          cancelTap(tap);
          pressed = false;
        }
        clickedAt = null;
        keys = [];
        if (requests.has("newHero")) {
          // Confirmed in the menu: the Save goes, and a fresh Level 1 Hero
          // starts in Town.
          removeSave(storage);
          world = createWorld({ areas, tilesets, seed: Date.now() });
          orders = [];
        }
        // Stands still while paused, so the clock owes no steps for it and
        // the World and every effect hold still.
        const now = gameTime(pause, realNow);
        const scene = { world, screen: viewport, way: activeInput.way };
        // Whether the Hero lies in Death, for the cursor; the World doesn't
        // step again until after it.
        const heroDead = world.death !== null;
        // The cursor sees a press first: one on the panels and HUD, or one
        // that puts down or drops what it holds, is not for the World.
        const pressedAt = input.pressedAt;
        const panel = pressedAt && renderer.panelAt(pressedAt);
        // A press that puts down or lets go of a Held Skill does only that.
        const heldSkillAtPress = cursor.heldSkill;
        // On touch, a touch on the panels and the HUD acts only as it lifts:
        // a tap clicks there, a long press shows the tooltip.
        const tapping =
          pressedAt !== null && panel !== null && activeInput.way === "touch";
        if (pressedAt && tapping) {
          tapDown(tap, { at: pressedAt, hit: panel }, realNow);
          claimPress(input);
          pressed = false;
        } else if (pressedAt) {
          const press = { at: pressedAt, hit: panel };
          const outcome = pressCursor(cursor, press, scene);
          cursor = outcome.cursor;
          orders.push(...outcome.orders);
          if (outcome.taken) {
            claimPress(input);
            pressed = false;
          }
        }
        const { orders: newOrders, click } = poll(input, now, {
          toTile: renderer.screenToTile,
          monsterAt: renderer.monsterAt,
          groundLabelAt: renderer.groundLabelAt,
          groundItemAt: renderer.groundItemAt,
          panelAt: (at) => forTheWorld(renderer.panelAt(at)),
        });
        orders.push(...newOrders);
        // A walk in a direction is for the steps of this frame only, each of
        // them, so it goes apart from the other orders. The controller orders
        // nothing while paused, nor for the Rotate Notice.
        const padOrders = wasPaused || pause.paused ? [] : polled.orders;
        const walking = padOrders.filter((order) => order.type === "Walk");
        orders.push(...padOrders.filter((order) => order.type !== "Walk"));
        // A press on a button on a panel or the HUD changes the menus or
        // orders a point spent. A press that put down or let go of a Held Skill does none
        // of that; one on a Panel button keeps it held, as the key would.
        const landedSkill =
          heldSkillAtPress !== null && cursor.heldSkill === null;
        if (panel && "button" in panel && !landedSkill && !tapping) {
          orders.push(...pressButton(menus, world, panel.button));
        }
        // A pause or the Hero's Death lets go of a Held Skill, before its
        // release could land it.
        cursor = settleCursor(cursor, { paused: pause.paused, heroDead });
        // Clicks the cursor at `point`, as a tap or the Focus pressed does,
        // pressing the button there unless it lands a Held Skill.
        const clickAt = (point: CursorPoint) => {
          const landing = cursor.heldSkill;
          const outcome = clickCursor(cursor, point, scene);
          cursor = outcome.cursor;
          orders.push(...outcome.orders);
          const { hit } = point;
          const landed = landing !== null && cursor.heldSkill === null;
          if (hit && "button" in hit && !landed) {
            orders.push(...pressButton(menus, world, hit.button));
          }
        };
        // Where the left button went up, even off the canvas; a touch on
        // the panels, lifting, taps there unless it was a long press.
        const released = takeRelease(input);
        if (released && tap.down) {
          const tapped = tapUp(tap, realNow);
          if (tapped) clickAt(tapped);
        } else if (released) {
          const hit = released.at && renderer.panelAt(released.at);
          const release = { ...released, hit };
          const outcome = releaseCursor(cursor, release, scene);
          cursor = outcome.cursor;
          orders.push(...outcome.orders);
        }
        // A right-click on the Inventory equips or unequips the Item under
        // it, and on any other panel does nothing; off the panels, `poll`
        // made it a cast.
        const rightAt = takeRightClick(input);
        const rightHit = rightAt && renderer.panelAt(rightAt);
        if (rightHit && !("button" in rightHit)) {
          const order = inventoryRightClickOrder(world, rightHit);
          if (order) orders.push(order);
        }
        // The Focus pressed clicks or right-clicks its spot, as the mouse
        // would there; nothing while paused.
        const focusClick = pause.paused || wasPaused ? null : polled.click;
        if (focusClick) clickAt(focusClick);
        const focusRight = pause.paused || wasPaused ? null : polled.rightClick;
        if (focusRight?.hit && !("button" in focusRight.hit)) {
          const order = inventoryRightClickOrder(world, focusRight.hit);
          if (order) orders.push(order);
        }
        // After the keys and clicks, any of which may have shut it: I, its
        // × or Panel button, or T, Level Up or the Skill Tree's Panel button
        // opening the Skill Tree in its place.
        returnOnShut(orders, inventoryWasOpen, menus);
        if (pressed && world.death && !pause.paused) {
          orders.push({ type: "Continue" });
          // So holding on after the click doesn't steer in Town.
          claimPress(input);
        }
        pressed = false;
        const area = world.areas[world.areaName];
        if (click && !world.death && isFloor(area, click)) {
          renderer.markClick(click, now);
        }

        // Orders wait for the next step, which may be a frame away.
        const { steps, alpha } = advance(clock, now - last);
        last = now;
        for (let i = 0; i < steps; i++) {
          const events = step(world, [...orders, ...walking]);
          if (changesSave(events)) writeSave(storage, saveOf(world));
          renderer.react(events, now);
          // The Hero's Death closes the panels. The World has already put
          // back an Item held then, so the return sent as the Inventory
          // shuts finds nothing to do, and is harmless.
          const inventoryOpen = menus.inventoryOpen;
          reactMenus(menus, events);
          orders = [];
          returnOnShut(orders, inventoryOpen, menus);
        }
        // No hover outline, nameplate or tooltip under the menu. While it
        // shows, the Focus stands in for the pointer, so its Item's tooltip
        // and the Held Item show there.
        const focus =
          pause.paused || currentPanel(menus) === null ? null : polled.focus;
        // On touch, a long press shows the tooltip, and a Held Item or Held
        // Skill stays where it was tapped up once the finger lifts.
        const holding =
          cursorItemOf(world) !== null || cursor.heldSkill !== null;
        const touched = tapPointer(tap, realNow, {
          holding,
          screen: input.screen,
        });
        const pointing = activeInput.way === "touch" ? touched : input.screen;
        const pointer = pause.paused ? null : (focus?.at ?? pointing);
        renderer.draw(
          world,
          alpha,
          pointer,
          now,
          menus,
          cursor.heldSkill,
          cursor.heldSkillSlot,
          pause.paused ? null : polled.target,
          focus?.rect ?? null,
        );
        app.render();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      listeners.abort();
      // A failed `init()` already surfaces through the chain above.
      init.then(
        () => app.destroy(true, { children: true }),
        () => {},
      );
    };
  }, []);

  return <div ref={host} />;
}

/**
 * Orders an Item held as the Inventory shuts back where it came from, if it
 * `wasOpen` and the menus have it shut now.
 */
function returnOnShut(orders: Order[], wasOpen: boolean, menus: Menus) {
  if (wasOpen && !menus.inventoryOpen) {
    orders.push({ type: "ReturnCursorItem" });
  }
}
