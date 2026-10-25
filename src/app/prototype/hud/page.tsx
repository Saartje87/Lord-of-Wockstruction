// PROTOTYPE (throwaway) for ticket #86: HUD variants. Lives only on the
// prototype/hud branch.

import { Suspense } from "react";
import { HudPrototype } from "./hud-prototype";

export default function Page() {
  return (
    <Suspense>
      <HudPrototype />
    </Suspense>
  );
}
