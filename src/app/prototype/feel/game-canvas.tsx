"use client";

// PROTOTYPE (throwaway): mounts the feel sandbox, using the guarded-destroy pattern from #75.

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { type FeelSnapshot, startFeelGame } from "./sim";
import type { FeelConfig } from "./variants";

export default function GameCanvas({
  config,
  onSnapshot,
}: {
  config: FeelConfig;
  onSnapshot: (s: FeelSnapshot) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef(onSnapshot);
  snapRef.current = onSnapshot;

  useEffect(() => {
    const host = hostRef.current as HTMLDivElement;
    const app = new Application();
    let cancelled = false;
    let game: ReturnType<typeof startFeelGame> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const ready = app
      .init({
        resizeTo: window,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        background: "#111114",
        antialias: true,
      })
      .then(() => {
        if (cancelled) return;
        host.appendChild(app.canvas);
        game = startFeelGame(app, config);
        poll = setInterval(() => game && snapRef.current(game.snapshot()), 100);
      });

    return () => {
      cancelled = true;
      ready.finally(() => {
        clearInterval(poll);
        game?.stop();
        app.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true },
        );
      });
    };
  }, [config]);

  return <div ref={hostRef} style={{ position: "fixed", inset: 0 }} />;
}
