# Wiablo

A single-player, browser-based hack and slash action RPG inspired by Diablo 1 and 2.

## Language

**Vertical Slice**:
The first playable version: one Town, one Combat Area, and the core loop between them.
_Avoid_: MVP, demo

**Hero**:
The single character the player controls.
_Avoid_: Player (the person), character, avatar

**Town**:
A safe Area where no combat happens and where the Hero starts and returns after death.
_Avoid_: Hub, village

**Combat Area**:
An Area outside Town where Monsters live and combat happens.
_Avoid_: Level, dungeon, zone, map

**Area**:
A distinct place the Hero can be in; Town and Combat Areas are both Areas.
_Avoid_: Level, zone, map, scene

**Exit**:
A zone in an Area that, when the Hero walks into it, takes the Hero to an Entry in another Area.
_Avoid_: Portal, door, transition, warp

**Entry**:
A named place in an Area where the Hero appears on arriving; the Entry named `start` is where the Hero begins.
_Avoid_: Spawn point (that's for Monsters), arrival

**Monster**:
A hostile creature that attacks the Hero and can be killed.
_Avoid_: Enemy, mob, NPC

**Leash**:
How far a Monster will chase the Hero from where it was placed before it gives up and starts Returning.
_Avoid_: Tether, chase range, aggro range

**Returning**:
A Monster walking back to where it was placed after giving up on the Hero, ignoring them on the way and healing to full on arrival; it happens past the Leash or on the Hero's Death.
_Avoid_: Resetting, evading, retreating

**NPC**:
A non-hostile character in Town.
_Avoid_: Villager, townsperson

**Life**:
The Hero's or a Monster's health; reaching zero means death.
_Avoid_: HP, health

**Death**:
The Hero's state once their Life reaches zero: they lie where they fell, and Monsters leave them be, until the player sends them back to Town.
_Avoid_: Game over, defeat

**In Combat**:
The Hero's state while they have dealt or taken damage in the last few seconds, or while a Monster is chasing them; outside it, the Hero slowly regains Life.
_Avoid_: Aggro, engaged

**Corpse**:
What remains of a dead Monster, lying in its Area until the Hero leaves.
_Avoid_: Body, remains

**Experience**:
What the Hero earns by killing Monsters; enough of it raises the Hero's Level.
_Avoid_: XP, EXP

**Level**:
How far the Hero has advanced, from 1 up, raised by earning Experience; reaching a new Level also fills the Hero's Life.
_Avoid_: Character level, rank (and never a place: that's an Area)

**Attribute**:
One of the Hero's three permanent traits, Strength, Dexterity and Vitality, raised only by spending Attribute Points.
_Avoid_: Stat

**Attribute Point**:
What the Hero gains five of on each new Level, kept until the player spends it to raise an Attribute by one; a spent point can't be taken back.
_Avoid_: Stat point

**Attack Rating**:
How accurate the Hero's swings are, raised by Dexterity; set against a Monster's Defense it gives the chance to hit.
_Avoid_: Accuracy, to-hit

**Defense**:
How hard a Monster is to hit, set against the Hero's Attack Rating.
_Avoid_: Armor, AC, evasion

**Miss**:
A swing that plays out in full but deals no damage because it failed its chance to hit.
_Avoid_: Dodge, whiff

**Save**:
The Hero's kept progress (Level, Experience, Attributes and unspent Attribute Points), written whenever it changes; there is only one, and loading it starts the Hero in Town.
_Avoid_: Save file, slot, profile, checkpoint
