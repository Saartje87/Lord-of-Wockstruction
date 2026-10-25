// PROTOTYPE (throwaway) for ticket #77: movement + melee feel. Lives only on the
// prototype/movement-combat-feel branch.

import { Suspense } from "react";
import { FeelPrototype } from "./feel-prototype";

export default function Page() {
  return (
    <Suspense>
      <FeelPrototype />
    </Suspense>
  );
}
