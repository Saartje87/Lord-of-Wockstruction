# Auto-aim lives in input; the simulation only learns to walk in a direction

With a controller or a touch screen there is no cursor, so the Hero walks where the stick points and attacks and Skills go to a **Target** picked by auto-aim. The simulation gets one new order, to walk in a direction (given each step the stick is held, stopping when it is let go). Picking the Target stays in input: it reads the World as last stepped, picks the nearest Monster ahead of the Hero within reach, and sends the same `Attack` and `Cast` orders the mouse sends today, aimed at that Monster or at a point a fixed distance ahead. We chose this so that the simulation stays unaware of devices, replays from a script of orders keep working unchanged, and auto-aim can be tuned or swapped without touching combat.

## Considered Options

- **Auto-aim in the simulation** (orders like "attack ahead"): the aim would be exact on the step it resolves, but the simulation would gain device-shaped orders, and the Target would have to be reported back for the renderer to highlight it. Rejected.
- **A virtual cursor moved by the stick**, so nothing below input changes: no new order at all, but it plays badly in combat. Rejected.

## Consequences

- The Target is picked from the last stepped World, at most one step behind the simulation; a Monster dying in that step makes the `Attack` order fall through as it would for a mouse click on it.
- Walking in a direction is the only order that has to be resent while held; `MoveTo` stays for mouse and Ground Item pickup.
