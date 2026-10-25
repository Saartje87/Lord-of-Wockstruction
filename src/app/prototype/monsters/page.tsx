// PROTOTYPE (throwaway) for ticket #82: Monster behaviour. Lives only on the
// prototype/monster-behaviour branch.

import { Suspense } from "react";
import { MonsterPrototype } from "./monster-prototype";

export default function Page() {
  return (
    <Suspense>
      <MonsterPrototype />
    </Suspense>
  );
}
