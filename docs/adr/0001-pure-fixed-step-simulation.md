# Pure, fixed-step simulation separated from Pixi

The game logic lives in `src/game/sim/` as pure TypeScript with no Pixi import. It advances in fixed 1/60 s steps inside the `requestAnimationFrame` loop: each frame runs 0..n steps from accumulated time, and rendering interpolates between the last two steps. Input reaches the simulation only as **orders** (such as `MoveTo` and `Attack`). The simulation reports what happened as **events** (such as `HitLanded` and `MonsterDied`) that the Pixi renderer turns into effects. We chose this so that melee timing is exact and identical on every machine (a hit authored at 140 ms always lands on the same step, and a frame hitch can't tunnel through walls or skip an attack), and so that fights can be replayed in Vitest from a script of orders.

## Considered Options

- **Variable step (one step per frame with the frame's `dt`)**: about one step (~16 ms) less visual latency, but timing varies by refresh rate and hitches, and tests would need fake clocks and tolerances. Rejected. If latency ever matters, we raise the step rate (for example to 120 Hz) rather than going variable.
- **An ECS library (bitecs, miniplex)**: overkill for one Hero and about a dozen Monsters. Entities are plain typed data (`Hero`, `Monster[]` with stable ids) updated by system functions, which keeps a later move to ECS possible.
- **Mixing game state into Pixi display objects** (how the throwaway feel prototype works): untestable without a browser, and it couples logic to the renderer.

## Consequences

- Each entity keeps its previous-step position for interpolation, and the renderer draws at most one step behind the simulation.
- Hitstop pauses the whole simulation for whole steps.
- Durations and speeds are authored in human units (ms, tiles/s) and converted to steps once.
