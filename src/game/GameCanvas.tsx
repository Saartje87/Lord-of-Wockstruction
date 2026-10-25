"use client";

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { advance, createClock } from "./clock";
import { areas, tilesets } from "./content";
import {
  attachPointer,
  cancel,
  createPointerInput,
  poll,
  release,
} from "./input/pointer";
import { clickPaused, createMenus, pressKey } from "./menus";
import { gameTime } from "./pause";
import { loadArt } from "./render/art";
import { createRenderer } from "./render/renderer";
import {
  browserStorage,
  changesProgress,
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
        gear: save?.gear,
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

      const renderer = createRenderer(app, art);
      const clock = createClock();
      const input = createPointerInput();
      const menus = createMenus();
      const { pause } = menus;
      let orders: Order[] = [];
      let last = performance.now();

      attachPointer(app.canvas, input, listeners.signal);
      // Keys and clicks on the pause menu go to the menus; a click anywhere
      // else on it resumes. Any other click or key press goes on from the
      // death screen, but for a click on the Hero panel or the Level Up
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
        let pressed = clickedAt !== null;
        let newHero = false;
        for (const key of keys) {
          const used = pressKey(menus, key, realNow);
          if (used === null) pressed = true;
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
        const {
          orders: newOrders,
          click,
          panel,
        } = poll(input, now, {
          toTile: renderer.screenToTile,
          monsterAt: renderer.monsterAt,
          panelAt: renderer.panelAt,
        });
        orders.push(...newOrders);
        // A click on the panel never orders the Hero about: Level Up opens
        // it and a + spends a point, while the game runs on.
        if (panel) {
          pressed = false;
          if (panel.button?.type === "levelUp") menus.heroPanelOpen = true;
          if (panel.button?.type === "raise") {
            const { attribute } = panel.button;
            orders.push({ type: "SpendAttributePoint", attribute });
          }
        }
        if (pressed && world.death && !pause.paused) {
          orders.push({ type: "Continue" });
          // So holding on after the click doesn't steer in Town.
          release(input);
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
          if (changesProgress(events)) writeSave(storage, saveOf(world));
          renderer.react(events, now);
          orders = [];
        }
        // No hover outline or nameplate under the menu or the panel.
        const pointer =
          pause.paused || (input.screen && renderer.panelAt(input.screen))
            ? null
            : input.screen;
        renderer.draw(world, alpha, pointer, now, menus);
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
