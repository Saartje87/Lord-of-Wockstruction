# Only the Town Portal's Area is kept, frozen while the Hero is away

Superseded by [ADR 0005](0005-every-area-is-kept-until-the-session-ends.md).

Every Area is rebuilt fresh from its definition when the Hero arrives: Monsters back at their spawns, no Corpses, Projectiles or Ground Items. A Town Portal is only worth having if the Hero can go back to the fight and the loot they left, so the Combat Area a Town Portal stands in becomes the **Kept Area**: on leaving it, by the Town Portal or an Exit, its state is set aside unchanged, and arriving there again restores it instead of rebuilding it. Nothing in it moves, heals or counts down while it is set aside. It stops being kept when the Town Portal closes, and the Save never holds it. We chose this so that the one feature that needs persistence gets it, while every other Area keeps its simple, fresh-on-arrival rule and the World only ever simulates one Area at a time.

## Considered Options

- **Every Area keeps its state**, as in Diablo 2: the world would feel more solid, but Areas would never refill, the World would carry every visited Area, and the Save would have to decide what of them to keep. Rejected for now.
- **Fresh on return**, the Town Portal only saving the walk back: no new state at all, but going to Town and back would reset an Area, which turns the Town Portal into a way to escape a fight and refill it. Rejected.
- **The Kept Area keeps running while the Hero is in Town**: Monsters would finish Returning and heal, which is what happens anyway; simulating an Area the Hero isn't in adds a second running Area for no gain. Rejected.

## Consequences

- Walking back to the Kept Area by Exits finds it kept too, so a Town Portal is never lost by taking the long way round.
- Opening a Town Portal in another Area closes the old one, and the old Area is fresh the next time the Hero arrives there.
