"use client";

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { advance, createClock } from "./clock";
import { areaDisplayNames, areas, tilesets } from "./content";
import {
  createCursor,
  forTheWorld,
  pressCursor,
  releaseCursor,
  settleCursor,
} from "./cursor";
import { castKeyOrder, drinkKeyOrder } from "./input/keys";
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
  acceptPendingPoints,
  addPendingPoint,
  clickClose,
  clickLevelUp,
  clickPanelButton,
  clickPaused,
  createMenus,
  type Menus,
  pressKey,
  reactMenus,
  removePendingPoint,
} from "./menus";
import { gameTime } from "./pause";
import { loadArt } from "./render/art";
import { inventoryRightClickOrder } from "./render/inventoryPanel";
import { createRenderer } from "./render/renderer";
import {
  browserStorage,
  changesSave,
  readSave,
  removeSave,
  saveOf,
  writeSave,
} from "./save";
import { isFloor } from "./sim/area";
import type { Vec } from "./sim/vec";
import { createWorld, type Order, step } from "./sim/world";

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

      const renderer = createRenderer(app, art, areaDisplayNames);
      const clock = createClock();
      const input = createPointerInput();
      const menus = createMenus();
      const { pause } = menus;
      let orders: Order[] = [];
      let last = performance.now();
      /** What the cursor holds besides the Held Item. */
      let cursor = createCursor();

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

      const tick = (realNow: number) => {
        const wasPaused = pause.paused;
        const inventoryWasOpen = menus.inventoryOpen;
        let pressed = clickedAt !== null;
        let newHero = false;
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
          if (used === "newHero") newHero = true;
        }
        if (clickedAt && wasPaused && pause.paused) {
          const choice = renderer.menuChoiceAt(clickedAt, pause.confirming);
          if (clickPaused(menus, choice, realNow) === "newHero") newHero = true;
        }
        if (wasPaused || pause.paused) {
          // Neither a click on the menu nor a hold from before the pause
          // orders the Hero about.
          cancel(input);
          pressed = false;
        }
        clickedAt = null;
        keys = [];
        if (newHero) {
          // Confirmed in the menu: the Save goes, and a fresh Level 1 Hero
          // starts in Town.
          removeSave(storage);
          world = createWorld({ areas, tilesets, seed: Date.now() });
          orders = [];
        }
        // Stands still while paused, so the clock owes no steps for it and
        // the World and every effect hold still.
        const now = gameTime(pause, realNow);
        const scene = { world, screen: app.screen };
        // Whether the Hero lies in Death, for the clicks and the cursor; the
        // World doesn't step again until after them.
        const heroDead = world.death !== null;
        // The cursor sees a press first: one on the panels and HUD, or one
        // that puts down or drops what it holds, is not for the World.
        const pressedAt = input.pressedAt;
        const panel = pressedAt && renderer.panelAt(pressedAt);
        // A press that puts down or lets go of a Held Skill does only that.
        const heldSkillAtPress = cursor.heldSkill;
        if (pressedAt) {
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
        // A press on a panel's button never orders the Hero about, nor goes
        // on from their Death: Level Up opens the Hero or Skill Tree panel
        // (but for a dead Hero), a + on the Skill Tree spends a point while
        // the Hero panel's +, − and Accept plan and spend Pending Attribute
        // Points, and a panel's × or Panel button shuts it as its key does
        // (a Panel button opening it too), while the game
        // runs on. A press that put down or let go of a Held Skill does none
        // of that; one on a Panel button keeps it held, as the key would.
        const landedSkill =
          heldSkillAtPress !== null && cursor.heldSkill === null;
        if (panel && "button" in panel && !landedSkill) {
          const { button } = panel;
          if (button?.type === "levelUp") {
            const { attributePoints, skillPoints } = world.hero.progress;
            clickLevelUp(menus, { heroDead, attributePoints, skillPoints });
          }
          // + and − only plan Pending Attribute Points; Accept spends them.
          if (button?.type === "raise") {
            const { attributePoints } = world.hero.progress;
            addPendingPoint(menus, button.attribute, {
              heroDead,
              attributePoints,
            });
          }
          if (button?.type === "lower") {
            removePendingPoint(menus, button.attribute);
          }
          if (button?.type === "accept") {
            const accept = acceptPendingPoints(menus);
            if (accept) orders.push(accept);
          }
          if (button?.type === "close") clickClose(menus, button.panel);
          // A Panel button opens or shuts its panel as its key does.
          if (button?.type === "panelButton") {
            clickPanelButton(menus, button.panel, { heroDead });
          }
          if (button?.type === "learn") {
            orders.push({ type: "SpendSkillPoint", skill: button.skill });
          }
        }
        // A pause or the Hero's Death lets go of a Held Skill, before its
        // release could land it.
        cursor = settleCursor(cursor, { paused: pause.paused, heroDead });
        // Where the left button went up, even off the canvas.
        const released = takeRelease(input);
        if (released) {
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
          const events = step(world, orders);
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
        // No hover outline, nameplate or tooltip under the menu.
        const pointer = pause.paused ? null : input.screen;
        renderer.draw(
          world,
          alpha,
          pointer,
          now,
          menus,
          cursor.heldSkill,
          cursor.heldSkillSlot,
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
