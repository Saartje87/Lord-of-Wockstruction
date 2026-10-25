"use client";

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { advance, createClock } from "./clock";
import { areas, tilesets } from "./content";
import { attachPointer, createPointerInput, poll } from "./input/pointer";
import { loadArt } from "./render/art";
import { createRenderer } from "./render/renderer";
import { isFloor } from "./sim/area";
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
      const world = createWorld({ areas, tilesets, seed: Date.now() });
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
      let orders: Order[] = [];
      let last = performance.now();

      attachPointer(app.canvas, input, listeners.signal);

      const tick = (now: number) => {
        const { orders: newOrders, click } = poll(input, now, {
          toTile: renderer.screenToTile,
          monsterAt: renderer.monsterAt,
        });
        orders.push(...newOrders);
        const area = world.areas[world.areaName];
        if (click && isFloor(area, click)) renderer.markClick(click, now);

        // Orders wait for the next step, which may be a frame away.
        const { steps, alpha } = advance(clock, now - last);
        last = now;
        for (let i = 0; i < steps; i++) {
          renderer.react(step(world, orders), now);
          orders = [];
        }
        renderer.draw(world, alpha, input.screen, now);
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
