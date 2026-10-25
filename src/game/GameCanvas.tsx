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
import { createPause, gameTime, pressKey, togglePause } from "./pause";
import { loadArt } from "./render/art";
import { createRenderer } from "./render/renderer";
import {
  browserStorage,
  changesProgress,
  readSave,
  removeSave,
  writeSave,
} from "./save";
import { isFloor } from "./sim/area";
import { createWorld, type Order, progressOf, step } from "./sim/world";

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
      let world = createWorld({
        areas,
        tilesets,
        seed: Date.now(),
        progress: readSave(storage),
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
      const pause = createPause();
      let orders: Order[] = [];
      let last = performance.now();

      attachPointer(app.canvas, input, listeners.signal);
      // Esc opens and closes the pause menu, and a click closes it too; the
      // menu's own keys go to `pressKey`. Any other click or key press goes
      // on from the death screen.
      let clicked = false;
      let keys: string[] = [];
      app.canvas.addEventListener(
        "pointerdown",
        () => {
          clicked = true;
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
        let pressed = clicked || keys.some((key) => key !== "Escape");
        const wasPaused = pause.paused;
        let newHero = false;
        for (const key of keys) {
          if (pressKey(pause, key, realNow) === "newHero") newHero = true;
        }
        if (clicked && wasPaused && pause.paused) togglePause(pause, realNow);
        if (pause.paused !== wasPaused) {
          // Neither the closing click nor a hold from before the pause
          // orders the Hero about.
          cancel(input);
          pressed = false;
        }
        clicked = false;
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
        const { orders: newOrders, click } = poll(input, now, {
          toTile: renderer.screenToTile,
          monsterAt: renderer.monsterAt,
        });
        orders.push(...newOrders);
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
          if (changesProgress(events)) writeSave(storage, progressOf(world));
          renderer.react(events, now);
          orders = [];
        }
        // No hover outline or nameplate under the menu.
        const pointer = pause.paused ? null : input.screen;
        renderer.draw(world, alpha, pointer, now, pause);
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
