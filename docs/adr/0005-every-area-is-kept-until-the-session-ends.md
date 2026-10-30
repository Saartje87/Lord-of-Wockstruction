# Every Area is kept until the Session ends

Supersedes [ADR 0003](0003-only-the-town-portals-area-is-kept.md).

With Acts (a Town, a Main Path of Combat Areas, Side Areas, Quests and Waypoints), the Hero crosses the same Areas again and again: walking back from a Waypoint, coming back from Town after a Death, and heading out again for a Quest. If an Area were rebuilt on every arrival, it would refill behind the Hero each time, and the world would feel disposable. So every Area is kept for the whole Session. It is built fresh the first time the Hero arrives in a Session and is then set aside unchanged whenever they leave, by any way out: Monsters (alive, wounded or dead), Corpses, Ground Items and what of it is Explored. Nothing in it moves, heals or counts down while it is set aside, so only the Hero's current Area is simulated. A Session ends at Quit to Start Screen or when the game is closed, and the next Session starts every Area fresh with all its Monsters back. That is how the Hero farms Monsters and Unique Monsters again. The Save never keeps an Area. Only Quest state carries over: what a Done Quest has put away for good, such as its Bone Altars, stays away.

## Considered Options

- **Only the Town Portal's Area is kept** (ADR 0003): the least state to carry, but Areas refill behind the Hero whenever they take an Exit back, and Waypoint travel would reset everything it touches.
- **Areas kept in the Save too**: the world would never refill, so farming would need a new reset rule, and the Save would grow with every Area visited. Rejected.
- **Areas keep running while the Hero is away**: Monsters would only finish Returning and heal, and a second running Area adds cost for no gain. Rejected, as in ADR 0003.

## Consequences

- The Kept Area as a separate idea goes away. The Town Portal is just a gateway, since its Area is kept like every other.
- The World holds every Area visited in the Session. It never simulates more than one.
- The Hero's Death doesn't end a Session. The Monsters that killed them are still there, healed and back at home, and any Ground Items still where they lay.
- Quit to Start Screen, then Continue, is how a player gets fresh Areas.
