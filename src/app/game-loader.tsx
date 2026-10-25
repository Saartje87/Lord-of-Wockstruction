"use client";

import dynamic from "next/dynamic";

// Pixi needs `window`, so the game never renders on the server.
const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

export function GameLoader() {
  return <GameCanvas />;
}
