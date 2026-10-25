"use client";

// PROTOTYPE (throwaway): mounts the HUD sandbox, using the guarded-destroy pattern from #75.

import { Application } from "pixi.js";
import { useEffect, useRef } from "react";
import { type HudView, type MonsterSnapshot, startHudGame } from "./sim";
import { type HudConfig, MONSTERS } from "./variants";

export type GameHandle = { view: () => HudView };

export default function GameCanvas({
  hud,
  onSnapshot,
  handleRef,
  blocked,
  toggleMenu,
}: {
  hud: HudConfig;
  onSnapshot: (s: MonsterSnapshot) => void;
  handleRef: React.RefObject<GameHandle | null>;
  blocked: () => boolean;
  toggleMenu: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onSnapshot, blocked, toggleMenu });
  cb.current = { onSnapshot, blocked, toggleMenu };

  useEffect(() => {
    const host = hostRef.current as HTMLDivElement;
    const app = new Application();
    let cancelled = false;
    let game: ReturnType<typeof startHudGame> | undefined;
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
        game = startHudGame(app, { ...MONSTERS }, hud, {
          blocked: () => cb.current.blocked(),
          toggleMenu: () => cb.current.toggleMenu(),
        });
        handleRef.current = game;
        poll = setInterval(
          () => game && cb.current.onSnapshot(game.snapshot()),
          100,
        );
      });

    return () => {
      cancelled = true;
      handleRef.current = null;
      ready.finally(() => {
        clearInterval(poll);
        game?.stop();
        app.destroy(
          { removeView: true, releaseGlobalResources: true },
          { children: true },
        );
      });
    };
  }, [hud, handleRef]);

  return <div ref={hostRef} style={{ position: "fixed", inset: 0 }} />;
}
