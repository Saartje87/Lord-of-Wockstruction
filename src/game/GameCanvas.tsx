"use client";

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { town } from "./areas/town";
import { advance, createClock } from "./clock";
import { createRenderer } from "./render/renderer";
import { createWorld, step } from "./sim/world";

/** Mounts the Pixi Application and runs the fixed-step loop. */
export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const app = new Application();
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
    init.then(() => {
      if (cancelled) return;
      container.appendChild(app.canvas);

      const world = createWorld({ areas: { town }, seed: Date.now() });
      const renderer = createRenderer(app, world.areas[world.areaName]);
      const clock = createClock();
      let last = performance.now();

      const tick = (now: number) => {
        const { steps, alpha } = advance(clock, now - last);
        last = now;
        for (let i = 0; i < steps; i++) step(world, []);
        renderer.draw(world, alpha);
        app.render();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      // A failed `init()` already surfaces through the chain above.
      init.then(
        () => app.destroy(true, { children: true }),
        () => {},
      );
    };
  }, []);

  return <div ref={host} />;
}
