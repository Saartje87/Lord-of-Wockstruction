"use client";

import dynamic from "next/dynamic";

// three.js needs `window`, so the prototype never renders on the server.
const Prototype3d = dynamic(() => import("@/game/prototype3d/Prototype3d"), {
  ssr: false,
});

export function Prototype3dLoader() {
  return <Prototype3d />;
}
